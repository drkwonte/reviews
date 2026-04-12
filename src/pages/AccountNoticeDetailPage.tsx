import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/common/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  isGlobalNotificationRead,
  markGlobalNotificationRead,
} from '@/utils/globalNotificationReadState'

interface NoticeDetail {
  id: string
  target_user_id: string | null
  title: string
  body: string
  link: string | null
  created_at: string
  is_read: boolean
  category: string
  type: string
}

const SETTINGS_NOTICES_HREF = '/settings?tab=notices'

export default function AccountNoticeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [row, setRow] = useState<NoticeDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, target_user_id, title, body, link, created_at, is_read, category, type')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        setRow(null)
        setLoadError('이 공지를 찾을 수 없습니다.')
        return
      }

      const allowed = data.target_user_id === null || data.target_user_id === user.id
      if (!allowed) {
        setRow(null)
        setLoadError('이 공지를 볼 권한이 없습니다.')
        return
      }

      setRow({
        id: String(data.id),
        target_user_id: data.target_user_id,
        title: data.title,
        body: data.body,
        link: data.link,
        created_at: data.created_at,
        is_read: data.is_read,
        category: data.category,
        type: data.type,
      })
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : '불러오기에 실패했습니다.')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    if (!authLoading && user?.id) void load()
  }, [authLoading, user?.id, load])

  const isRead = (n: NoticeDetail): boolean => {
    if (!user?.id) return n.is_read
    if (n.target_user_id) return n.is_read
    return isGlobalNotificationRead(user.id, n.id)
  }

  const handleMarkRead = async () => {
    if (!row || !user?.id) return
    setMarking(true)
    try {
      if (row.target_user_id) {
        const { error } = await supabase.rpc('mark_my_notification_read', {
          p_id: Number(row.id),
        })
        if (error) throw error
      } else {
        markGlobalNotificationRead(user.id, row.id)
      }
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '처리에 실패했습니다.')
    } finally {
      setMarking(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <main className="container max-w-2xl px-4 py-8 mx-auto">
        <Button variant="ghost" className="mb-6 rounded-xl font-bold gap-2 -ml-2" asChild>
          <Link to={SETTINGS_NOTICES_HREF}>
            <ArrowLeft className="h-4 w-4" />
            공지 목록으로
          </Link>
        </Button>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : loadError || !row ? (
          <Card className="rounded-3xl border-border">
            <CardContent className="py-12 text-center space-y-4">
              <p className="font-bold text-muted-foreground">{loadError ?? '공지를 찾을 수 없습니다.'}</p>
              <Button className="rounded-xl font-bold" onClick={() => navigate(SETTINGS_NOTICES_HREF)}>
                목록으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden">
            <CardHeader className="space-y-4 border-b border-border bg-muted/20">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.target_user_id === null ? 'default' : 'secondary'} className="font-black text-[10px]">
                  {row.target_user_id === null ? '전체' : '나에게'}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                  {row.category}
                </Badge>
                {!isRead(row) && (
                  <Badge variant="destructive" className="text-[10px] font-black">
                    NEW
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl font-black leading-tight">{row.title}</CardTitle>
              <time className="text-xs font-bold text-muted-foreground block">
                {format(new Date(row.created_at), 'yyyy-MM-dd HH:mm')}
              </time>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">{row.body}</div>
              {row.link && (
                <a
                  href={row.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary underline"
                >
                  링크 열기 <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {!isRead(row) && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl font-bold"
                    disabled={marking}
                    onClick={() => void handleMarkRead()}
                  >
                    {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : '읽음 처리'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
