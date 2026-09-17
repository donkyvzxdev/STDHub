import { isTauriRuntime } from '../lib/tauriFs'

/**
 * Local reminders. Uses the notification plugin on device; everywhere else
 * it degrades silently (nothing to schedule against). Permission is only
 * ever requested from an explicit user action with context (§39).
 */
export async function notificationsSupported(): Promise<boolean> {
  if (!isTauriRuntime()) return false
  try {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    await isPermissionGranted()
    return true
  } catch {
    return false
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauriRuntime()) return false
  try {
    const { isPermissionGranted, requestPermission } = await import(
      '@tauri-apps/plugin-notification'
    )
    if (await isPermissionGranted()) return true
    return (await requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export async function scheduleReminder(
  id: number,
  title: string,
  body: string,
  atSeconds: number,
): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false
  try {
    const { sendNotification, Schedule } = await import(
      '@tauri-apps/plugin-notification'
    )
    sendNotification({
      id,
      title,
      body,
      schedule: Schedule.at(new Date(atSeconds * 1000)),
    })
    return true
  } catch {
    return false
  }
}

export async function cancelReminder(id: number): Promise<void> {
  if (!isTauriRuntime()) return
  try {
    const { cancel } = await import('@tauri-apps/plugin-notification')
    cancel([id])
  } catch {
    // ignore
  }
}

/** Stable numeric id derived from the event id (for cancel/schedule pairs). */
export function reminderIdFor(eventId: string): number {
  let hash = 0
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash * 31 + eventId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 1000000
}

/** Epoch seconds for `date` + `time` minus lead minutes (null when none). */
export function reminderAtSeconds(
  date: string,
  time: string,
  remindMinutes: number,
): number | null {
  if (remindMinutes < 0 || time === '') return null
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const at = new Date(y, m - 1, d, h, min).getTime() - remindMinutes * 60000
  return Math.floor(at / 1000)
}
