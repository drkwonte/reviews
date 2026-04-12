export const SENT_NOTIFICATION_BODY_PREVIEW_LENGTH = 80
export const SENT_NOTIFICATION_FETCH_LIMIT = 500

export interface SentNotificationRow {
  id: string
  target_user_id: string | null
  title: string
  body: string
  link: string | null
  sent_by: string | null
  created_at: string
  category: string | null
  type: string | null
}

export interface SentNotificationGroup {
  groupKey: string
  scope: 'global' | 'targeted'
  title: string
  body: string
  link: string | null
  sentBy: string | null
  /** 가장 이른 생성 시각 (동일 발송 묶음 내) */
  created_at: string
  rows: SentNotificationRow[]
}

/** 동일 분·동일 본문·동일 발신으로 삽입된 다건을 한 발송으로 묶습니다. */
function buildGroupKey(row: SentNotificationRow): string {
  const scope = row.target_user_id === null ? 'g' : 't'
  const minute = row.created_at.slice(0, 16)
  return `${scope}|${minute}|${row.title}|${row.body}|${row.sent_by ?? ''}|${row.link ?? ''}`
}

export function groupSentNotifications(rows: SentNotificationRow[]): SentNotificationGroup[] {
  const map = new Map<string, SentNotificationRow[]>()
  for (const r of rows) {
    const key = buildGroupKey(r)
    const list = map.get(key)
    if (list) list.push(r)
    else map.set(key, [r])
  }

  const groups: SentNotificationGroup[] = []
  for (const [groupKey, groupRows] of map) {
    const sorted = [...groupRows].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const first = sorted[0]
    groups.push({
      groupKey,
      scope: first.target_user_id === null ? 'global' : 'targeted',
      title: first.title,
      body: first.body,
      link: first.link,
      sentBy: first.sent_by,
      created_at: first.created_at,
      rows: sorted,
    })
  }

  groups.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return groups
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}
