use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_fs::FsExt;

/// Grants the frontend recursive fs scope for ONE user-picked folder.
/// Only existing directories are accepted; paths are canonicalized first
/// (resolving `..` and symlinks). Nothing else is allow-listed at runtime.
#[tauri::command]
fn grant_folder_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let canonical =
        std::fs::canonicalize(&path).map_err(|e| format!("invalid path: {e}"))?;
    if !canonical.is_dir() {
        return Err("not a directory".to_string());
    }
    app.fs_scope()
        .allow_directory(&canonical, true)
        .map_err(|e| format!("scope error: {e}"))?;
    Ok(())
}

/// Validates a user-picked folder (canonicalized: symlinks/`..` resolved,
/// must exist and be a directory) and returns a shell-friendly form of it.
/// `canonicalize` yields verbatim (`\\?\`) paths on Windows, which shells
/// display raw (`...FileSystem::\\?\C:\...`) and which break tools that join
/// paths with `/`, use `..`, or string-match drives — so the verbatim
/// prefix is stripped for anything a shell or tool will see. Scope grants
/// (`grant_folder_scope`) intentionally keep using the canonical form.
fn runnable_cwd(path: &str) -> Result<std::path::PathBuf, String> {
    let canonical =
        std::fs::canonicalize(path).map_err(|e| format!("invalid path: {e}"))?;
    if !canonical.is_dir() {
        return Err("not a directory".to_string());
    }
    Ok(pretty_path(&canonical))
}

#[cfg(target_os = "windows")]
fn pretty_path(canonical: &std::path::Path) -> std::path::PathBuf {
    let text = canonical.display().to_string();
    if let Some(rest) = text.strip_prefix("\\\\?\\UNC\\") {
        return std::path::PathBuf::from(format!("\\\\{rest}"));
    }
    if let Some(rest) = text.strip_prefix("\\\\?\\") {
        return std::path::PathBuf::from(rest);
    }
    canonical.to_path_buf()
}

#[cfg(not(target_os = "windows"))]
fn pretty_path(canonical: &std::path::Path) -> std::path::PathBuf {
    canonical.to_path_buf()
}

/// Opens a native terminal window rooted at a user-picked folder.
/// Fixed binaries and arguments per OS — no shell, no user input reaches a
/// command line. Returns "opened", or an error when nothing launches.
#[tauri::command]
fn open_external_terminal(path: String) -> Result<String, String> {
    let cwd = runnable_cwd(&path)?;

    #[cfg(target_os = "windows")]
    {
        if std::process::Command::new("wt")
            .arg("-d")
            .arg(&cwd)
            .spawn()
            .is_ok()
        {
            return Ok("opened".to_string());
        }
        // Single quotes escaped for the PowerShell string literal.
        let at_dir = cwd.display().to_string().replace('\'', "''");
        if std::process::Command::new("powershell.exe")
            .arg("-NoLogo")
            .arg("-NoExit")
            .arg("-Command")
            .arg(format!("Set-Location -LiteralPath '{at_dir}'"))
            .spawn()
            .is_ok()
        {
            return Ok("opened".to_string());
        }
        return Err("launch failed".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        if std::process::Command::new("open")
            .args(["-a", "Terminal"])
            .arg(&canonical)
            .spawn()
            .is_ok()
        {
            return Ok("opened".to_string());
        }
        return Err("launch failed".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        const TERMINALS: &[(&str, &[&str])] = &[
            ("gnome-terminal", &["--working-directory"]),
            ("konsole", &["--workdir"]),
            ("xfce4-terminal", &["--working-directory"]),
        ];
        for (bin, flags) in TERMINALS {
            let probe = std::process::Command::new(bin)
                .arg("--version")
                .output();
            if !probe.map(|o| o.status.success()).unwrap_or(false) {
                continue;
            }
            let mut cmd = std::process::Command::new(bin);
            for flag in *flags {
                cmd.arg(flag);
            }
            if cmd.arg(&canonical).spawn().is_ok() {
                return Ok("opened".to_string());
            }
        }
        return Err("launch failed".to_string());
    }

    #[allow(unreachable_code)]
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("unsupported platform".to_string());
    }
}

/// One live integrated terminal: the master side (for resize), a writer for
/// keystrokes, and a killer to stop the shell. The reader lives on its own
/// thread and forwards output through `terminal-output` events.
struct TerminalEntry {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn portable_pty::ChildKiller + Send + Sync>,
}

#[derive(Default)]
struct TerminalState(Mutex<HashMap<String, TerminalEntry>>);

/// Spawns an integrated terminal shell rooted at a user-picked folder.
/// The shell is fixed per OS — PowerShell on Windows, `$SHELL` (or `sh`) on
/// Unix — so no user input ever reaches a command line here. `cwd` is
/// canonicalized and must be an existing directory, like `grant_folder_scope`.
/// Output streams back through `terminal-output` events; exit through
/// `terminal-exit`.
#[tauri::command]
fn terminal_spawn(
    app: tauri::AppHandle,
    state: tauri::State<TerminalState>,
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    if id.is_empty() || id.len() > 64 {
        return Err("bad id".to_string());
    }
    let cwd = runnable_cwd(&cwd)?;
    let pair = native_pty_system()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("pty error: {e}"))?;
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = CommandBuilder::new("powershell.exe");
        c.args(["-NoLogo"]);
        c
    };
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "sh".to_string());
        CommandBuilder::new(shell)
    };
    cmd.cwd(cwd);
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn error: {e}"))?;
    let killer = child.clone_killer();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("reader error: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("writer error: {e}"))?;
    state
        .0
        .lock()
        .map_err(|_| "state error".to_string())?
        .insert(
            id.clone(),
            TerminalEntry {
                master: pair.master,
                writer,
                killer,
            },
        );
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app.emit(
                        "terminal-output",
                        serde_json::json!({ "id": id, "data": data }),
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("terminal-exit", serde_json::json!({ "id": id }));
    });
    Ok(())
}

/// Sends keystrokes to a live integrated terminal.
#[tauri::command]
fn terminal_write(
    state: tauri::State<TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut map = state
        .0
        .lock()
        .map_err(|_| "state error".to_string())?;
    let entry = map
        .get_mut(&id)
        .ok_or_else(|| "unknown terminal".to_string())?;
    entry
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("write error: {e}"))?;
    entry
        .writer
        .flush()
        .map_err(|e| format!("write error: {e}"))?;
    Ok(())
}

/// Informs a live integrated terminal of its new size in columns/rows.
#[tauri::command]
fn terminal_resize(
    state: tauri::State<TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.0.lock().map_err(|_| "state error".to_string())?;
    let entry = map
        .get(&id)
        .ok_or_else(|| "unknown terminal".to_string())?;
    entry
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("resize error: {e}"))?;
    Ok(())
}

/// Stops a live integrated terminal and releases its PTY.
#[tauri::command]
fn terminal_kill(
    state: tauri::State<TerminalState>,
    id: String,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|_| "state error".to_string())?;
    if let Some(mut entry) = map.remove(&id) {
        let _ = entry.killer.kill();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            grant_folder_scope,
            open_external_terminal,
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill
        ])
        .manage(TerminalState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod terminal_tests {
    use super::*;
    use std::time::{Duration, Instant};

    /// Proves the real PTY mechanism on this machine: spawns the same fixed
    /// shell the app uses, round-trips keystrokes, and requires the shell to
    /// actually EXECUTE (a `PID=<digits>` line can only come from running
    /// code — the pty input-echo never contains digits there).
    #[test]
    fn pty_spawns_shell_and_executes() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("openpty works");
        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = CommandBuilder::new("powershell.exe");
            c.args(["-NoLogo"]);
            c
        };
        #[cfg(not(target_os = "windows"))]
        let mut cmd = CommandBuilder::new(
            std::env::var("SHELL").unwrap_or_else(|_| "sh".to_string()),
        );
        let mut child = pair.slave.spawn_command(cmd).expect("shell spawns");
        let mut reader = pair.master.try_clone_reader().expect("reader");
        let mut writer = pair.master.take_writer().expect("writer");
        let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        #[cfg(target_os = "windows")]
        writer
            .write_all(b"echo \"PID=$PID\"\r")
            .expect("write echo");
        #[cfg(not(target_os = "windows"))]
        writer.write_all(b"echo \"PID=$$\"\n").expect("write echo");
        writer.flush().expect("flush");
        let deadline = Instant::now() + Duration::from_secs(25);
        let mut acc = Vec::new();
        // PSReadLine asks for the cursor position (`ESC[6n`) during startup
        // and waits for a `ESC[{row};{col}R` reply before drawing the first
        // prompt. A real terminal emulator (xterm.js in the app) answers
        // automatically; this bare test must answer by hand.
        let mut answered = 0usize;
        loop {
            let left = deadline
                .checked_duration_since(Instant::now())
                .unwrap_or(Duration::ZERO);
            if left.is_zero() {
                break;
            }
            match rx.recv_timeout(left) {
                Ok(chunk) => acc.extend_from_slice(&chunk),
                Err(_) => break,
            }
            let text = String::from_utf8_lossy(&acc);
            let asked = text.match_indices("\u{1b}[6n").count();
            while answered < asked {
                writer.write_all(b"\x1b[1;1R").ok();
                writer.flush().ok();
                answered += 1;
            }
            if pid_executed(&text) {
                break;
            }
        }
        let _ = child.kill();
        let text = String::from_utf8_lossy(&acc).into_owned();
        assert!(
            pid_executed(&text),
            "shell executed our command; got: {text}"
        );
    }

    #[test]
    fn pretty_path_strips_verbatim_prefix() {
        use std::path::{Path, PathBuf};
        #[cfg(target_os = "windows")]
        {
            assert_eq!(
                pretty_path(Path::new("\\\\?\\C:\\x\\rhythm game")),
                PathBuf::from("C:\\x\\rhythm game"),
            );
            assert_eq!(
                pretty_path(Path::new("\\\\?\\UNC\\srv\\share")),
                PathBuf::from("\\\\srv\\share"),
            );
            assert_eq!(
                pretty_path(Path::new("C:\\x")),
                PathBuf::from("C:\\x"),
            );
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(
                pretty_path(Path::new("/tmp/x")),
                PathBuf::from("/tmp/x"),
            );
        }
    }

    /// A `PID=<digits>` line proves execution: the pty input-echo only ever
    /// contains the literal `$PID`/`$$` text, never digits.
    fn pid_executed(text: &str) -> bool {        text.match_indices("PID=").any(|(i, _)| {
            text[i + 4..]
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_digit())
        })
    }
}
