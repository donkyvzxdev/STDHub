/* STDHub web — Notebook: files (demo/localStorage/opener), editor,
   toolbar, StudyMD notebook view, pen drawing. Classic script. */
'use strict';

const NotebookView = {
  files: new Map(),   // path -> { name, content, dirty }
  dirHandle: null,
  demoMode: false,
  open: [],
  activePath: null,
  modes: {},          // path -> 'edit' | 'read'
  el: null,
  ui: {},

  title: function () { return I18n.t('app.notebook'); },

  seedDemo: function () {
    const guia = [
      '# Guia de estudos',
      '',
      '==fotossíntese== e ++clorofila++ e $x^2$',
      '',
      ':::flashcard',
      'Quanto é 2+2?',
      '---',
      '4',
      ':::',
      '',
      ':::quiz',
      'Capital do Brasil?',
      '- [ ] São Paulo',
      '- [x] Brasília',
      ':::',
      '',
      '```calc',
      '2*(3+4)',
      'sqrt(16)',
      '```',
      '',
      '#stdcalc 39 * 37 =',
      '',
      '#stdmarker revise hoje /stdmarker e siga',
      '',
      '- [ ] ler capítulo 3',
      '- [x] resumo pronto',
      '',
      ':::dica',
      'Revise os flashcards antes da prova.',
      ':::',
      '',
    ].join('\n');
    this.files.set('guia.stmd', { name: 'guia.stmd', content: guia, dirty: false });
    this.files.set('ideias.md', { name: 'ideias.md', content: '# Ideias\n\n- [ ] ...\n', dirty: false });
  },

  persistDemo: function () {
    if (!this.demoMode && !this.dirHandle) return;
    if (this.dirHandle) return; // real folder: saved on demand
    try {
      const obj = {};
      this.files.forEach((f, p) => { obj[p] = f.content; });
      window.localStorage.setItem('stdhub.web.files', JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  },

  restoreDemo: function () {
    try {
      const raw = window.localStorage.getItem('stdhub.web.files');
      if (!raw) return false;
      const obj = JSON.parse(raw);
      Object.keys(obj).forEach((p) => {
        this.files.set(p, { name: p.split('/').pop(), content: obj[p], dirty: false });
      });
      return this.files.size > 0;
    } catch (e) {
      return false;
    }
  },

  mount: function (el) {
    this.el = el;
    el.innerHTML =
      '<div class="nb-wrap">' +
      '<div class="nb-cols">' +
      '<div class="nb-tree" data-tree></div>' +
      '<div class="nb-edit-col">' +
      '<div class="nb-filetabs" data-filetabs></div>' +
      '<div class="nb-toolbar" data-toolbar hidden></div>' +
      '<div class="nb-edit-col" data-editor style="flex:1;min-height:0;display:flex;flex-direction:column"></div>' +
      '</div>' +
      '</div>' +
      '<dialog class="web-modal" data-newfile><form method="dialog" class="modal-stack">' +
      '<label class="small muted" data-newfile-label></label>' +
      '<input data-newfile-input />' +
      '<div class="modal-actions"><button class="btn btn-secondary btn-sm" value="cancel" data-newfile-cancel></button>' +
      '<button class="btn btn-primary btn-sm" value="ok" data-newfile-ok></button></div>' +
      '</form></dialog>' +
      '<dialog class="web-modal wide" data-ink><div class="modal-stack">' +
      '<div class="ink-tools" data-ink-tools></div>' +
      '<canvas id="inkCanvas" width="880" height="440"></canvas>' +
      '<div class="modal-actions"><button class="btn btn-secondary btn-sm" data-ink-clear></button>' +
      '<button class="btn btn-outline btn-sm" data-ink-cancel></button>' +
      '<button class="btn btn-primary btn-sm" data-ink-ok></button></div>' +
      '</div></dialog>' +
      '</div>';
    this.ui = {
      tree: el.querySelector('[data-tree]'),
      filetabs: el.querySelector('[data-filetabs]'),
      toolbar: el.querySelector('[data-toolbar]'),
      editor: el.querySelector('[data-editor]'),
      newfile: el.querySelector('[data-newfile]'),
      ink: el.querySelector('[data-ink]'),
    };
    this.ui.newfile.querySelector('[data-newfile-label]').textContent = I18n.t('app.fileName');
    this.ui.newfile.querySelector('[data-newfile-cancel]').textContent = I18n.t('app.cancel');
    this.ui.newfile.querySelector('[data-newfile-ok]').textContent = I18n.t('app.create');
    this.render();
  },

  onLang: function () {
    if (!this.el) return;
    this.ui.newfile.querySelector('[data-newfile-label]').textContent = I18n.t('app.fileName');
    this.render();
  },

  /* ---------- files ---------- */

  useDemo: function () {
    this.demoMode = true;
    this.dirHandle = null;
    this.files.clear();
    if (!this.restoreDemo()) this.seedDemo();
    this.open = [];
    this.activePath = null;
    this.render();
  },

  openFolder: async function () {
    if (!window.showDirectoryPicker) {
      this.useDemo();
      return;
    }
    try {
      const dir = await window.showDirectoryPicker();
      this.dirHandle = dir;
      this.demoMode = false;
      this.files.clear();
      await this.readDir(dir, '', 0);
      this.open = [];
      this.activePath = null;
      this.render();
    } catch (e) { /* picker cancelled */ }
  },

  readDir: async function (dir, prefix, depth) {
    if (depth > 3) return;
    for await (const entry of dir.values()) {
      const path = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          if (file.size > 200 * 1024) continue;
          const text = await file.text();
          if (text.includes('�')) continue;
          this.files.set(path, { name: entry.name, content: text, dirty: false, handle: entry });
        } catch (e) { /* skip */ }
      } else if (entry.kind === 'directory') {
        await this.readDir(entry, path, depth + 1);
      }
    }
  },

  saveFile: async function (path) {
    const f = this.files.get(path);
    if (!f) return;
    if (f.handle) {
      try {
        const w = await f.handle.createWritable();
        await w.write(f.content);
        await w.close();
      } catch (e) { /* ignore */ }
    }
    f.dirty = false;
    this.persistDemo();
    this.render();
  },

  createFile: function (name) {
    const clean = Stmd.ensureStudyExtension(name || 'sem-titulo');
    if (this.files.has(clean)) return clean;
    this.files.set(clean, { name: clean.split('/').pop(), content: '', dirty: false });
    this.persistDemo();
    this.render();
    return clean;
  },

  openFile: function (path) {
    if (!this.open.includes(path)) this.open.push(path);
    this.activePath = path;
    this.render();
  },

  activeFile: function () {
    return this.activePath ? this.files.get(this.activePath) || null : null;
  },

  /* ---------- render ---------- */

  render: function () {
    if (!this.el) return;
    this.renderTree();
    this.renderTabs();
    this.renderEditor();
  },

  renderTree: function () {
    const t = this.ui.tree;
    t.innerHTML = '';
    if (!this.files.size) {
      const empty = document.createElement('div');
      empty.className = 'center-hint';
      const p1 = document.createElement('p');
      p1.innerHTML = '<strong>' + this.esc(I18n.t('app.noFolder')) + '</strong>';
      const p2 = document.createElement('p');
      p2.className = 'muted small';
      p2.textContent = I18n.t('app.noFolderHint');
      const b1 = document.createElement('button');
      b1.className = 'btn btn-primary btn-sm';
      b1.textContent = I18n.t('app.openFolder');
      b1.addEventListener('click', () => this.openFolder());
      const b2 = document.createElement('button');
      b2.className = 'btn btn-outline btn-sm';
      b2.textContent = I18n.t('app.useDemo');
      b2.addEventListener('click', () => this.useDemo());
      empty.append(p1, p2, b1, b2);
      empty.style.display = 'flex';
      empty.style.flexDirection = 'column';
      empty.style.gap = '0.5rem';
      t.appendChild(empty);
      return;
    }
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:0.25rem;margin-bottom:0.5rem';
    const add = document.createElement('button');
    add.className = 'btn btn-ghost btn-sm';
    add.textContent = '+ ' + I18n.t('app.newFile');
    add.addEventListener('click', () => this.askNewFile());
    bar.appendChild(add);
    t.appendChild(bar);
    Array.from(this.files.keys()).sort().forEach((path) => {
      const f = this.files.get(path);
      const b = document.createElement('button');
      b.className = 'nb-tree-row' + (path === this.activePath ? ' active' : '');
      b.textContent = (Stmd.isStmdFile(f.name) ? '📓 ' : '📄 ') + path + (f.dirty ? ' •' : '');
      b.addEventListener('click', () => this.openFile(path));
      t.appendChild(b);
    });
  },

  askNewFile: function () {
    const dlg = this.ui.newfile;
    const input = dlg.querySelector('[data-newfile-input]');
    input.value = '';
    dlg.showModal();
    input.focus();
    dlg.querySelector('[data-newfile-ok]').onclick = (e) => {
      e.preventDefault();
      const path = this.createFile(input.value.trim());
      dlg.close();
      this.openFile(path);
    };
  },

  esc: function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  renderTabs: function () {
    const bar = this.ui.filetabs;
    bar.innerHTML = '';
    this.open.forEach((path) => {
      const f = this.files.get(path);
      if (!f) return;
      const tab = document.createElement('div');
      tab.className = 'tab' + (path === this.activePath ? ' active' : '');
      const label = document.createElement('button');
      label.textContent = f.name + (f.dirty ? ' •' : '');
      label.addEventListener('click', () => { this.activePath = path; this.render(); });
      const save = document.createElement('button');
      save.className = 'x';
      save.textContent = '💾';
      save.title = I18n.t('app.save');
      save.addEventListener('click', (e) => { e.stopPropagation(); this.saveFile(path); });
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '×';
      x.title = I18n.t('app.close');
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open = this.open.filter((p) => p !== path);
        if (this.activePath === path) this.activePath = this.open.length ? this.open[this.open.length - 1] : null;
        this.render();
      });
      tab.append(label, save, x);
      bar.appendChild(tab);
    });
    if (this.activeFile() && Stmd.isStmdFile(this.activeFile().name) && this.activePath) {
      const modes = document.createElement('div');
      modes.className = 'nb-mode';
      const mode = this.modes[this.activePath] || 'edit';
      const bEdit = document.createElement('button');
      bEdit.className = 'nb-tool' + (mode === 'edit' ? ' active' : '');
      bEdit.textContent = '✏️';
      bEdit.title = I18n.t('app.edit');
      bEdit.setAttribute('aria-label', I18n.t('app.edit'));
      bEdit.style.background = mode === 'edit' ? 'var(--muted)' : '';
      bEdit.addEventListener('click', () => { this.modes[this.activePath] = 'edit'; this.render(); });
      const bRead = document.createElement('button');
      bRead.className = 'nb-tool';
      bRead.textContent = '📖';
      bRead.title = I18n.t('app.readMode');
      bRead.setAttribute('aria-label', I18n.t('app.readMode'));
      bRead.style.background = mode === 'read' ? 'var(--muted)' : '';
      bRead.addEventListener('click', () => { this.modes[this.activePath] = 'read'; this.render(); });
      modes.append(bEdit, bRead);
      bar.appendChild(modes);
    }
  },

  renderEditor: function () {
    const host = this.ui.editor;
    const bar = this.ui.toolbar;
    host.innerHTML = '';
    const f = this.activeFile();
    if (!f || !this.activePath) {
      host.innerHTML = '<div class="center-hint muted">' + this.esc(I18n.t('app.noTabs')) + '</div>';
      bar.hidden = true;
      return;
    }
    const isStmd = Stmd.isStmdFile(f.name);
    const mode = this.modes[this.activePath] || 'edit';
    if (isStmd && mode === 'read') {
      bar.hidden = true;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-height:0;display:flex';
      wrap.innerHTML = Stmd.renderNotebook(f.content);
      host.appendChild(wrap);
      this.bindNotebook(wrap);
      return;
    }
    if (isStmd) {
      bar.hidden = false;
      this.renderToolbar();
    } else {
      bar.hidden = true;
    }
    const ta = document.createElement('textarea');
    ta.className = 'nb-textarea';
    ta.value = f.content;
    ta.setAttribute('aria-label', f.name);
    ta.spellcheck = false;
    const path = this.activePath;
    ta.addEventListener('input', () => {
      const file = this.files.get(path);
      if (!file) return;
      file.content = ta.value;
      file.dirty = true;
      this.persistDemo();
      this.renderTabs();
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveFile(path);
      }
    });
    host.appendChild(ta);
  },

  /* ---------- toolbar ---------- */

  renderToolbar: function () {
    const bar = this.ui.toolbar;
    bar.innerHTML = '';
    const tools = [
      ['B', 'app.toolBold', () => this.wrapSel('**', '**')],
      ['I', 'app.toolItalic', () => this.wrapSel('*', '*')],
      ['==', 'app.toolHighlight', () => this.wrapSel('==', '==')],
      ['++', 'app.toolUnderline', () => this.wrapSel('++', '++')],
      ['$', 'app.toolMath', () => this.wrapSel('$', '$')],
      ['H', 'app.toolHeading', () => this.insertAt('## ')],
      ['❝', 'app.toolQuote', () => this.insertAt('> ')],
      ['☰', 'app.toolList', () => this.insertAt('- ')],
      ['☐', 'app.toolTask', () => this.insertAt('- [ ] ')],
      ['🔗', 'app.toolLink', () => this.wrapSel('[', '](https://)')],
      ['▦', 'app.toolTable', () => this.insertAt('| A | B |\n| --- | --- |\n| 1 | 2 |')],
      ['🗂', 'app.toolFlash', () => this.insertAt(':::flashcard\npergunta\n---\nresposta\n:::')],
      ['☑', 'app.toolQuiz', () => this.insertAt(':::quiz\npergunta\n- [ ] opção 1\n- [x] opção certa\n:::')],
      ['🧮', 'app.toolCalc', () => this.insertAt('```calc\n2*(3+4)\n```')],
      ['📌', 'app.toolCallout', () => this.insertAt(':::nota\ntexto\n:::')],
      ['ƒx', 'app.toolInlineCalc', () => this.wrapSel('#stdcalc ', ' =')],
      ['✎', 'app.toolInlineMarker', () => this.wrapSel('#stdmarker ', ' /stdmarker')],
      ['🖊', 'app.toolDrawing', () => this.openInk()],
    ];
    tools.forEach((def, i) => {
      if (i === 5 || i === 11 || i === 15) {
        const sep = document.createElement('span');
        sep.className = 'nb-sep';
        bar.appendChild(sep);
      }
      const b = document.createElement('button');
      b.className = 'nb-tool';
      b.textContent = def[0];
      b.title = I18n.t(def[1]);
      b.setAttribute('aria-label', I18n.t(def[1]));
      b.addEventListener('click', def[2]);
      bar.appendChild(b);
    });
  },

  currentTextarea: function () {
    return this.ui.editor.querySelector('textarea');
  },

  pushEdit: function (value, selStart, selEnd) {
    const ta = this.currentTextarea();
    const f = this.activeFile();
    if (!ta || !f || !this.activePath) return;
    ta.value = value;
    f.content = value;
    f.dirty = true;
    ta.focus();
    ta.setSelectionRange(selStart, selEnd);
    this.persistDemo();
    this.renderTabs();
  },

  wrapSel: function (before, after) {
    const ta = this.currentTextarea();
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    this.pushEdit(
      ta.value.slice(0, s) + before + sel + after + ta.value.slice(e),
      sel ? s + before.length + sel.length + after.length : s + before.length,
      sel ? s + before.length + sel.length + after.length : s + before.length,
    );
  },

  insertAt: function (text) {
    const ta = this.currentTextarea();
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStartSnip = /^(#{1,6}\s|> |-(\s\[[ x]\])?\s?)/.test(text);
    if (lineStartSnip) {
      const lineBegin = ta.value.lastIndexOf('\n', s - 1) + 1;
      const lineText = ta.value.slice(lineBegin, s);
      const insert = lineText.trim() === '' ? text : '\n' + text;
      const at = lineText.trim() === '' ? lineBegin : lineBegin;
      this.pushEdit(
        ta.value.slice(0, at) + insert + ta.value.slice(lineText.trim() === '' ? s : lineBegin),
        at + insert.length, at + insert.length,
      );
      return;
    }
    this.pushEdit(ta.value.slice(0, s) + text + ta.value.slice(s), s + text.length, s + text.length);
  },

  /* ---------- notebook interactivity ---------- */

  bindNotebook: function (root) {
    const rerender = () => {
      const f = this.activeFile();
      if (!f) return;
      root.innerHTML = Stmd.renderNotebook(f.content);
    };
    root.addEventListener('click', (e) => {
      const flash = e.target.closest('[data-flash]');
      if (flash && root.contains(flash)) {
        const front = flash.querySelector('.nb-flash-front');
        const back = flash.querySelector('.nb-flash-back');
        if (!front || !back) return;
        const showingFront = !front.hidden;
        front.hidden = showingFront;
        back.hidden = !showingFront;
        return;
      }
      const check = e.target.closest('[data-quiz-check]');
      if (check && root.contains(check)) {
        const quiz = check.closest('[data-quiz]');
        const opts = Array.from(quiz.querySelectorAll('.nb-opt'));
        let ok = 0;
        opts.forEach((opt) => {
          const box = opt.querySelector('input');
          const correct = opt.dataset.correct === '1';
          const picked = box.checked;
          box.disabled = true;
          const verdict = opt.querySelector('.nb-verdict');
          const good = picked === correct;
          if (good) ok++;
          opt.classList.add(good ? 'ok' : 'bad');
          if (!picked && correct) opt.classList.add('missed');
          verdict.hidden = false;
          verdict.textContent = good ? I18n.t('app.correct') : I18n.t('app.wrong');
          verdict.classList.add(good ? 'ok' : 'bad');
        });
        const foot = quiz.querySelector('.nb-quiz-foot');
        foot.innerHTML = '';
        const score = document.createElement('span');
        score.className = 'muted small';
        score.textContent = I18n.t('app.score', { ok: ok, total: opts.length });
        const retry = document.createElement('button');
        retry.className = 'btn btn-ghost btn-sm';
        retry.textContent = '↻ ' + I18n.t('app.retry');
        retry.addEventListener('click', rerender);
        foot.append(score, retry);
      }
    });
    root.addEventListener('change', (e) => {
      const box = e.target.closest('input[data-task-line]');
      if (!box || !root.contains(box)) return;
      this.toggleTaskLine(Number(box.dataset.taskLine));
    });
  },

  toggleTaskLine: function (lineNo) {
    const f = this.activeFile();
    if (!f || !this.activePath) return;
    const lines = f.content.split('\n');
    const cur = lines[lineNo];
    if (!cur) return;
    const next = cur.replace(/^(\s*[-*]\s*)\[( |x|X)\]/, function (_m, pre, mark) {
      return pre + '[' + (mark === ' ' ? 'x' : ' ') + ']';
    });
    if (next === cur) return;
    lines[lineNo] = next;
    f.content = lines.join('\n');
    f.dirty = true;
    this.persistDemo();
    this.render();
  },

  /* ---------- pen drawing ---------- */

  ink: { drawing: false, last: null, color: '#111111', width: 5 },

  openInk: function () {
    const dlg = this.ui.ink;
    const canvas = dlg.querySelector('#inkCanvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const tools = dlg.querySelector('[data-ink-tools]');
    tools.innerHTML = '';
    ['#111111', '#2563eb', '#dc2626', '#16a34a', '#eab308'].forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (c === this.ink.color ? ' on' : '');
      b.style.backgroundColor = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => {
        this.ink.color = c;
        tools.querySelectorAll('.swatch').forEach((s) => s.classList.remove('on'));
        b.classList.add('on');
      });
      tools.appendChild(b);
    });
    dlg.querySelector('[data-ink-clear]').textContent = I18n.t('app.clear');
    dlg.querySelector('[data-ink-cancel]').textContent = I18n.t('app.cancel');
    dlg.querySelector('[data-ink-ok]').textContent = I18n.t('app.insert');
    const self = this;
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      };
    }
    canvas.onpointerdown = (e) => {
      const c = canvas.getContext('2d');
      if (!c) return;
      self.ink.drawing = true;
      self.ink.last = pos(e);
      canvas.setPointerCapture(e.pointerId);
      c.strokeStyle = self.ink.color;
      c.lineWidth = self.ink.width;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(self.ink.last.x, self.ink.last.y);
      c.lineTo(self.ink.last.x + 0.1, self.ink.last.y + 0.1);
      c.stroke();
    };
    canvas.onpointermove = (e) => {
      if (!self.ink.drawing) return;
      const c = canvas.getContext('2d');
      if (!c) return;
      const p = pos(e);
      c.strokeStyle = self.ink.color;
      c.lineWidth = self.ink.width;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(self.ink.last.x, self.ink.last.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      self.ink.last = p;
    };
    const stop = () => { self.ink.drawing = false; self.ink.last = null; };
    canvas.onpointerup = stop;
    canvas.onpointercancel = stop;
    dlg.querySelector('[data-ink-clear]').onclick = () => {
      const c = canvas.getContext('2d');
      if (!c) return;
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, canvas.width, canvas.height);
    };
    dlg.querySelector('[data-ink-cancel]').onclick = () => dlg.close();
    dlg.querySelector('[data-ink-ok]').onclick = () => {
      const url = canvas.toDataURL('image/png');
      dlg.close();
      const ta = self.currentTextarea();
      if (ta) {
        const s = ta.selectionStart;
        const md = Stmd.drawingMarkdown(url) + '\n';
        self.pushEdit(ta.value.slice(0, s) + md + ta.value.slice(s), s + md.length, s + md.length);
      }
    };
    dlg.showModal();
  },
};

window.NotebookView = NotebookView;
