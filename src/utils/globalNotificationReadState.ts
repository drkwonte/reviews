const STORAGE_KEY_PREFIX = 'nextime_global_notification_reads'

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`
}

export function loadReadGlobalNotificationIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map(String))
  } catch {
    return new Set()
  }
}

export function markGlobalNotificationRead(userId: string, notificationId: string): void {
  const next = loadReadGlobalNotificationIds(userId)
  next.add(notificationId)
  localStorage.setItem(storageKey(userId), JSON.stringify([...next]))
}

export function isGlobalNotificationRead(userId: string, notificationId: string): boolean {
  return loadReadGlobalNotificationIds(userId).has(notificationId)
}
