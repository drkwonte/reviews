import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { History, RefreshCw, ChevronDown, Eye, Users, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  groupSentNotifications,
  SENT_NOTIFICATION_BODY_PREVIEW_LENGTH,
  SENT_NOTIFICATION_FETCH_LIMIT,
  truncateText,
  type SentNotificationGroup,
  type SentNotificationRow,
} from '@/utils/groupSentNotifications'

interface ProfileMini {
  id: string
  name: string
  email: string
}

interface AdminSentNotificationsPanelProps {
  /** 부모에서 발송 성공 시 증가시키면 목록을 다시 불러옵니다. */
  reloadSignal: number
}

export function AdminSentNotificationsPanel({ reloadSignal }: AdminSentNotificationsPanelProps) {
  const [groups, setGroups] = useState<SentNotificationGroup[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileMini>>({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const [detailGroup, setDetailGroup] = useState<SentNotificationGroup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { data: rawRows, error } = await supabase
        .from('notifications')
        .select('id, target_user_id, title, body, link, sent_by, category, type, created_at')
        .order('created_at', { ascending: false })
        .limit(SENT_NOTIFICATION_FETCH_LIMIT)

      if (error) throw new Error(error.message)

      const rows: SentNotificationRow[] = (rawRows ?? []).map((r) => ({
        id: String(r.id),
        target_user_id: r.target_user_id,
        title: r.title,
        body: r.body,
        link: r.link,
        sent_by: r.sent_by,
        created_at: r.created_at,
        category: r.category,
        type: r.type,
      }))

      const idSet = new Set<string>()
      for (const r of rows) {
        if (r.target_user_id) idSet.add(r.target_user_id)
        if (r.sent_by) idSet.add(r.sent_by)
      }

      let profiles: ProfileMini[] = []
      if (idSet.size > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', [...idSet])

        if (profError) throw new Error(profError.message)
        profiles = (profData ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
        }))
      }

      const pmap: Record<string, ProfileMini> = {}
      for (const p of profiles) {
        pmap[p.id] = p
      }
      setProfileMap(pmap)
      setGroups(groupSentNotifications(rows))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'
      setErrorMessage(msg)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadSignal])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const senderLabel = useMemo(
    () => (id: string | null) => {
      if (!id) return '—'
      const p = profileMap[id]
      return p ? `${p.name} (${p.email})` : id.slice(0, 8) + '…'
    },
    [profileMap],
  )

  const recipientSummary = (g: SentNotificationGroup) => {
    if (g.scope === 'global') {
      return { label: '전체 회원', icon: Globe }
    }
    return { label: `${g.rows.length}명`, icon: Users }
  }

  return (
    <Card className="border border-border shadow-xl rounded-[2.5rem] overflow-hidden bg-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-border p-8">
        <div>
          <CardTitle className="text-2xl font-black flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            발송 기록
          </CardTitle>
          <p className="text-sm text-muted-foreground font-medium mt-2">
            최근 {SENT_NOTIFICATION_FETCH_LIMIT}건까지 표시합니다. 동일 시각·내용으로 보낸 다건은 한 줄로 묶어
            대상만 펼쳐 볼 수 있습니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl font-bold gap-2"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          새로고침
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {errorMessage && (
          <div className="m-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-bold text-destructive">
            {errorMessage}
          </div>
        )}
        {loading && !errorMessage ? (
          <div className="p-16 text-center text-muted-foreground font-bold animate-pulse">불러오는 중…</div>
        ) : groups.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <p className="font-black text-lg text-muted-foreground">발송된 공지가 없습니다.</p>
            <p className="text-sm text-muted-foreground">공지 발송 탭에서 공지를 내면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 font-black text-xs uppercase" />
                <TableHead className="font-black text-xs uppercase text-foreground/70">발송 시각</TableHead>
                <TableHead className="font-black text-xs uppercase text-foreground/70">제목</TableHead>
                <TableHead className="font-black text-xs uppercase text-foreground/70 min-w-[200px]">
                  내용 미리보기
                </TableHead>
                <TableHead className="font-black text-xs uppercase text-center text-foreground/70">대상</TableHead>
                <TableHead className="font-black text-xs uppercase text-foreground/70">발신</TableHead>
                <TableHead className="w-24 text-center font-black text-xs uppercase text-foreground/70">
                  상세
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const sum = recipientSummary(g)
                const Icon = sum.icon
                const expanded = expandedKeys.has(g.groupKey)
                return (
                  <Fragment key={g.groupKey}>
                    <TableRow className="h-16 hover:bg-muted/30 border-b border-border/50 group">
                      <TableCell className="align-middle">
                        {g.scope === 'targeted' && g.rows.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg"
                            onClick={() => toggleExpand(g.groupKey)}
                            aria-expanded={expanded}
                            title="대상 목록 펼치기"
                          >
                            <ChevronDown
                              className={cn('h-5 w-5 transition-transform', expanded && 'rotate-180')}
                            />
                          </Button>
                        ) : (
                          <span className="inline-block w-9" />
                        )}
                      </TableCell>
                      <TableCell className="align-middle text-sm font-bold whitespace-nowrap">
                        {format(new Date(g.created_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="align-middle font-bold text-foreground max-w-[180px]">
                        <span className="line-clamp-2">{g.title}</span>
                      </TableCell>
                      <TableCell className="align-middle text-sm text-muted-foreground max-w-[280px]">
                        {truncateText(g.body, SENT_NOTIFICATION_BODY_PREVIEW_LENGTH)}
                      </TableCell>
                      <TableCell className="align-middle text-center">
                        <Badge
                          variant={g.scope === 'global' ? 'default' : 'secondary'}
                          className="font-black text-[10px] uppercase gap-1 rounded-full px-2.5 py-1"
                        >
                          <Icon className="h-3 w-3" />
                          {sum.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle text-xs text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{senderLabel(g.sentBy)}</span>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg font-bold gap-1 h-9"
                          onClick={() => setDetailGroup(g)}
                        >
                          <Eye className="h-4 w-4" />
                          보기
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && g.scope === 'targeted' && g.rows.length > 1 && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="p-6">
                          <p className="text-xs font-black uppercase text-muted-foreground mb-3 tracking-wider">
                            수신자 ({g.rows.length}명)
                          </p>
                          <ul className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto text-sm">
                            {g.rows.map((r) => {
                              const uid = r.target_user_id
                              const p = uid ? profileMap[uid] : null
                              return (
                                <li
                                  key={r.id}
                                  className="rounded-xl border border-border/60 bg-card px-3 py-2 font-medium"
                                >
                                  {p ? (
                                    <>
                                      <span className="font-bold text-foreground">{p.name}</span>
                                      <span className="text-muted-foreground text-xs block">{p.email}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs font-mono text-muted-foreground">{uid}</span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!detailGroup} onOpenChange={(open) => !open && setDetailGroup(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          {detailGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-black pr-8">{detailGroup.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1 text-left">
                    <p className="text-xs font-bold text-muted-foreground">
                      {format(new Date(detailGroup.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </p>
                    <p className="text-xs font-bold">
                      발신:{' '}
                      <span className="text-foreground">{senderLabel(detailGroup.sentBy)}</span>
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">본문</p>
                  <p className="text-sm font-medium whitespace-pre-wrap rounded-xl bg-muted/30 p-4 border border-border">
                    {detailGroup.body}
                  </p>
                </div>
                {detailGroup.link && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">링크</p>
                    <a
                      href={detailGroup.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-primary break-all underline"
                    >
                      {detailGroup.link}
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">대상</p>
                  {detailGroup.scope === 'global' ? (
                    <p className="text-sm font-bold flex items-center gap-2">
                      <Globe className="h-4 w-4" /> 모든 로그인 사용자 (전체 공지)
                    </p>
                  ) : (
                    <ul className="max-h-52 overflow-y-auto space-y-2 rounded-xl border border-border p-3 bg-muted/20">
                      {detailGroup.rows.map((r) => {
                        const uid = r.target_user_id
                        const p = uid ? profileMap[uid] : null
                        return (
                          <li key={r.id} className="text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                            {p ? (
                              <>
                                <span className="font-bold">{p.name}</span>
                                <span className="text-muted-foreground text-xs block">{p.email}</span>
                              </>
                            ) : (
                              <span className="font-mono text-xs">{uid}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold">
                  DB 행 {detailGroup.rows.length}건 · 유형 {detailGroup.scope === 'global' ? '전체' : '지정'}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
