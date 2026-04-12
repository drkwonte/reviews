import { supabase } from '@/lib/supabase'

export const NOTIFICATION_TITLE_MAX_LENGTH = 200
export const NOTIFICATION_LINK_MAX_LENGTH = 500
export const NOTIFICATION_INSERT_CHUNK_SIZE = 100

export type NotificationCategory = 'system' | 'personal'

export interface AdminNoticePayload {
  title: string
  body: string
  link: string | null
  sentBy: string
}

function normalizePayload(payload: AdminNoticePayload): AdminNoticePayload {
  const title = payload.title.trim()
  const body = payload.body.trim()
  const link = payload.link?.trim() || null
  if (title.length === 0 || body.length === 0) {
    throw new Error('제목과 내용을 모두 입력해 주세요.')
  }
  if (title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    throw new Error(`제목은 ${NOTIFICATION_TITLE_MAX_LENGTH}자 이하여야 합니다.`)
  }
  if (link && link.length > NOTIFICATION_LINK_MAX_LENGTH) {
    throw new Error(`링크는 ${NOTIFICATION_LINK_MAX_LENGTH}자 이하여야 합니다.`)
  }
  return { title, body, link, sentBy: payload.sentBy }
}

/** 전체 공지: target_user_id NULL → RLS로 모든 로그인 사용자가 조회 가능 */
export async function insertGlobalNotification(
  raw: AdminNoticePayload,
  category: NotificationCategory = 'system',
): Promise<void> {
  const payload = normalizePayload(raw)
  const { error } = await supabase.from('notifications').insert({
    target_user_id: null,
    type: 'info',
    category,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    sent_by: payload.sentBy,
  })
  if (error) throw new Error(error.message)
}

/** 지정 회원에게 각각 한 행씩 알림 생성 */
export async function insertTargetedNotifications(
  userIds: string[],
  raw: AdminNoticePayload,
  category: NotificationCategory = 'personal',
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    throw new Error('받는 사람을 한 명 이상 선택해 주세요.')
  }
  const payload = normalizePayload(raw)
  const rows = uniqueIds.map((target_user_id) => ({
    target_user_id,
    type: 'info' as const,
    category,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    sent_by: payload.sentBy,
  }))

  for (let i = 0; i < rows.length; i += NOTIFICATION_INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + NOTIFICATION_INSERT_CHUNK_SIZE)
    const { error } = await supabase.from('notifications').insert(chunk)
    if (error) throw new Error(error.message)
  }
}
