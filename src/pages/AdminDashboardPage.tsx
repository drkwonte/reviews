import { useEffect, useState, useMemo, useCallback } from 'react'
import { 
  Database, 
  Bell, 
  ArrowUpRight, 
  HardDrive,
  Activity,
  Save,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  Clock,
  Calendar,
  User as UserIcon,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Sheet, 
  SheetContent, 
} from '@/components/ui/sheet'
import { AppHeader } from '@/components/common/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  insertGlobalNotification,
  insertTargetedNotifications,
  NOTIFICATION_TITLE_MAX_LENGTH,
  NOTIFICATION_LINK_MAX_LENGTH,
} from '@/services/adminNotifications'
import { format } from 'date-fns'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AdminSentNotificationsPanel } from '@/components/admin/AdminSentNotificationsPanel'

type BroadcastAudience = 'global' | 'selected'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [settings, setSettings] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userPayments, setUserPayments] = useState<any[]>([])
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [broadcastAudience, setBroadcastAudience] = useState<BroadcastAudience>('global')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementLink, setAnnouncementLink] = useState('')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(() => new Set())
  const [isSendingNotice, setIsSendingNotice] = useState(false)

  const [sheetNoticeTitle, setSheetNoticeTitle] = useState('')
  const [sheetNoticeBody, setSheetNoticeBody] = useState('')
  const [isSheetNoticeSending, setIsSheetNoticeSending] = useState(false)
  const [notificationLogReloadKey, setNotificationLogReloadKey] = useState(0)

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    try {
      // 1. 통계 데이터 (최근 30일)
      const { data: statsData } = await supabase
        .from('admin_stats_daily')
        .select('*')
        .order('stat_date', { ascending: true })
        .limit(30)
      
      // 2. 유저 오버뷰 (업데이트된 뷰에서 조회)
      const { data: userData } = await supabase
        .from('admin_user_overview')
        .select('*')
        .order('joined_at', { ascending: false })

      // 3. 앱 설정
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .order('key', { ascending: true })

      if (statsData) setStats(statsData)
      if (userData) setUsers(userData)
      if (settingsData) setSettings(settingsData)
    } catch (e) {
      console.error('Admin data fetch failed:', e)
    }
  }

  const fetchUserDetails = async (userId: string) => {
    setIsDetailLoading(true)
    try {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (data) setUserPayments(data)
    } catch (e) {
      console.error('User details fetch failed:', e)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
      
      if (error) throw error
      alert('설정이 성공적으로 저장되었습니다.')
      fetchAdminData()
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`)
    }
  }

  const toggleRecipient = useCallback((userId: string, checked: boolean) => {
    setSelectedRecipientIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }, [])

  const selectAllRecipients = useCallback(() => {
    setSelectedRecipientIds(new Set(users.map((u) => String(u.user_id))))
  }, [users])

  const clearRecipientSelection = useCallback(() => {
    setSelectedRecipientIds(new Set())
  }, [])

  useEffect(() => {
    if (selectedUser?.user_id) {
      setSheetNoticeTitle('')
      setSheetNoticeBody('')
    }
  }, [selectedUser?.user_id])

  const handleSendBroadcast = async () => {
    if (!user?.id) {
      alert('로그인 정보를 확인할 수 없습니다.')
      return
    }
    setIsSendingNotice(true)
    try {
      const payload = {
        title: announcementTitle,
        body: announcementBody,
        link: announcementLink.trim() || null,
        sentBy: user.id,
      }
      if (broadcastAudience === 'global') {
        await insertGlobalNotification(payload, 'system')
        alert('전체 공지가 등록되었습니다.')
        setAnnouncementTitle('')
        setAnnouncementBody('')
        setAnnouncementLink('')
        setNotificationLogReloadKey((k) => k + 1)
      } else {
        const ids = [...selectedRecipientIds]
        await insertTargetedNotifications(ids, payload, 'personal')
        alert(`${ids.length}명에게 공지를 보냈습니다.`)
        setAnnouncementTitle('')
        setAnnouncementBody('')
        setAnnouncementLink('')
        clearRecipientSelection()
        setNotificationLogReloadKey((k) => k + 1)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류'
      alert(`발송 실패: ${message}`)
    } finally {
      setIsSendingNotice(false)
    }
  }

  const handleSendSheetNotice = async () => {
    if (!user?.id || !selectedUser?.user_id) {
      alert('대상 회원 또는 로그인 정보를 확인할 수 없습니다.')
      return
    }
    setIsSheetNoticeSending(true)
    try {
      await insertTargetedNotifications(
        [String(selectedUser.user_id)],
        {
          title: sheetNoticeTitle,
          body: sheetNoticeBody,
          link: null,
          sentBy: user.id,
        },
        'personal',
      )
      alert('해당 회원에게 공지를 보냈습니다.')
      setSheetNoticeTitle('')
      setSheetNoticeBody('')
      setNotificationLogReloadKey((k) => k + 1)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류'
      alert(`발송 실패: ${message}`)
    } finally {
      setIsSheetNoticeSending(false)
    }
  }

  const chartData = useMemo(() => {
    return stats.map(s => ({
      date: format(new Date(s.stat_date), 'MM/dd'),
      revenue: s.revenue_today,
      users: s.total_users,
      notes: s.total_notes
    }))
  }, [stats])

  const latestStats = stats[stats.length - 1] || {}

  const formatByteSize = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-500 hover:bg-emerald-600 rounded-full text-[10px] font-black uppercase">Active</Badge>
      case 'canceled': return <Badge variant="outline" className="text-amber-500 border-amber-500 rounded-full text-[10px] font-black uppercase">Canceled</Badge>
      case 'expired': return <Badge variant="secondary" className="rounded-full text-[10px] font-black uppercase">Expired</Badge>
      case 'past_due': return <Badge variant="destructive" className="rounded-full text-[10px] font-black uppercase">Late</Badge>
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 transition-colors duration-300">
      <AppHeader />

      <div className="container py-10 px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2 uppercase flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-rose-500" /> Admin Control
            </h1>
            <p className="text-muted-foreground font-bold tracking-tight">서비스 관리 및 시스템 통합 대시보드</p>
          </div>
          <Button variant="outline" onClick={fetchAdminData} className="h-12 px-6 rounded-xl border-border hover:bg-muted font-bold">
            새로고침
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-card border border-border p-1.5 rounded-2xl h-14 w-full md:w-auto overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="overview" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">실시간 지표</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">회원 관리</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">시스템 설정</TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">공지 발송</TabsTrigger>
            <TabsTrigger value="notification-history" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">발송 기록</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Users</span>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground">{latestStats.total_users || 0}</span>
                    <span className="text-xs font-bold text-muted-foreground">명</span>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                    <ArrowUpRight size={14} /> 오늘 +{latestStats.new_users_today || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Storage & DB</span>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <HardDrive size={14} className="text-muted-foreground" />
                      <span className="text-xl font-black text-foreground">{formatByteSize(latestStats.total_storage_bytes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-muted-foreground" />
                      <span className="text-xl font-black text-foreground">{formatByteSize(latestStats.db_size_bytes)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Revenue Today</span>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground">{(latestStats.revenue_today || 0).toLocaleString()}</span>
                    <span className="text-xs font-bold text-muted-foreground">원</span>
                  </div>
                  <div className="mt-4 text-[11px] font-bold text-muted-foreground">
                    이번 달 누적: {(latestStats.revenue_month || 0).toLocaleString()}원
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card transition-all hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Notes</span>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground">{latestStats.total_notes || 0}</span>
                    <span className="text-xs font-bold text-muted-foreground">개</span>
                  </div>
                  <div className="mt-4 text-[11px] font-bold text-muted-foreground">
                    유료 회원: {latestStats.premium_users || 0}명
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border shadow-xl rounded-[2.5rem] overflow-hidden bg-card transition-all">
              <CardHeader className="p-8 border-b border-border">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Activity className="h-6 w-6 text-primary" /> 성장 및 수익 트렌드 (최근 30일)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A98E70" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#A98E70" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#A98E70" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <p className="text-sm font-bold text-muted-foreground">
                공지 수신자로 선택된 회원:{' '}
                <span className="text-foreground">{selectedRecipientIds.size}</span>명
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold"
                  onClick={selectAllRecipients}
                  disabled={users.length === 0}
                >
                  전체 선택
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold"
                  onClick={clearRecipientSelection}
                  disabled={selectedRecipientIds.size === 0}
                >
                  선택 해제
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl font-bold bg-primary text-primary-foreground"
                  disabled={selectedRecipientIds.size === 0}
                  onClick={() => {
                    setBroadcastAudience('selected')
                    setActiveTab('notifications')
                  }}
                >
                  공지 탭에서 발송 ({selectedRecipientIds.size}명)
                </Button>
              </div>
            </div>
            <Card className="border border-border shadow-xl rounded-[2.5rem] overflow-hidden bg-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50 h-16">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 px-4 font-black text-xs uppercase text-center text-foreground/70">
                        선택
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase px-8 text-foreground/70">사용자 정보</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center text-foreground/70">플랜 및 상태</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center text-foreground/70">노트 / 용량</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center text-foreground/70 underline decoration-primary/30 underline-offset-4">구독 만료일</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center text-foreground/70">가입일</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow 
                        key={u.user_id} 
                        className="h-20 hover:bg-muted/30 border-b border-border/50 cursor-pointer group transition-colors"
                        onClick={() => {
                          setSelectedUser(u)
                          fetchUserDetails(u.user_id)
                        }}
                      >
                        <TableCell
                          className="w-12 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selectedRecipientIds.has(String(u.user_id))}
                              onCheckedChange={(v) => toggleRecipient(String(u.user_id), v === true)}
                              aria-label={`${u.name} 공지 수신자 선택`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-8">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={u.current_plan === 'premium' ? 'default' : 'secondary'} className="rounded-full font-black uppercase text-[9px] px-2">
                              {u.current_plan}
                            </Badge>
                            {getStatusBadge(u.subscription_status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{u.note_count}개</span>
                            <span className="text-[10px] text-muted-foreground">{formatByteSize(u.storage_usage_bytes)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.current_period_end ? (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-foreground">
                                {format(new Date(u.current_period_end), 'yyyy-MM-dd')}
                              </span>
                              <span className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter">
                                {new Date(u.current_period_end) < new Date() ? 'EXPIRED' : 'ACTIVE'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground font-bold">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-muted-foreground">
                          {format(new Date(u.joined_at), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell>
                          <ChevronRight size={18} className="text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {settings.map((s) => (
              <Card key={s.key} className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card p-8 flex flex-col justify-between group transition-all hover:border-primary/30">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-black tracking-widest text-[9px] uppercase border-primary/30 text-primary">System Config</Badge>
                    {s.value_type === 'boolean' && (
                      <Switch 
                        checked={s.value === 'true'} 
                        onCheckedChange={(checked) => handleUpdateSetting(s.key, checked ? 'true' : 'false')}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground mb-1">{s.key}</h3>
                    <p className="text-sm text-muted-foreground font-medium">{s.description}</p>
                  </div>
                </div>
                
                <div className="mt-10 flex items-center gap-4">
                  {s.value_type !== 'boolean' && (
                    <>
                      <Input 
                        defaultValue={s.value} 
                        className="flex-1 h-12 rounded-xl bg-muted/20 border-border" 
                        onBlur={(e) => {
                          if (e.target.value !== s.value) handleUpdateSetting(s.key, e.target.value)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl text-muted-foreground group-hover:text-primary transition-colors">
                        <Save size={20} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="max-w-2xl border border-border shadow-xl rounded-[2.5rem] bg-card p-10 mx-auto">
              <CardHeader className="px-0 pt-0 pb-8 border-b border-border">
                <CardTitle className="text-2xl font-black flex items-center gap-3">
                  <Bell className="h-8 w-8 text-primary" /> 전송 센터
                </CardTitle>
                <p className="text-sm text-muted-foreground font-medium mt-2">
                  전체 공지는 모든 회원에게, 선택 공지는 회원 관리에서 체크한 회원에게만 전달됩니다.
                </p>
              </CardHeader>
              <CardContent className="px-0 pt-8 space-y-8">
                <div className="space-y-3">
                  <span className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                    수신 대상
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={broadcastAudience === 'global' ? 'default' : 'outline'}
                      className="rounded-xl font-bold"
                      onClick={() => setBroadcastAudience('global')}
                    >
                      전체 회원
                    </Button>
                    <Button
                      type="button"
                      variant={broadcastAudience === 'selected' ? 'default' : 'outline'}
                      className="rounded-xl font-bold"
                      onClick={() => setBroadcastAudience('selected')}
                    >
                      선택한 회원만 ({selectedRecipientIds.size}명)
                    </Button>
                  </div>
                  {broadcastAudience === 'selected' && (
                    <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          아래에서 수신자를 고르거나, 회원 관리 탭에서 선택할 수 있습니다.
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="font-bold"
                            onClick={selectAllRecipients}
                            disabled={users.length === 0}
                          >
                            전체 선택
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="font-bold"
                            onClick={clearRecipientSelection}
                            disabled={selectedRecipientIds.size === 0}
                          >
                            해제
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card divide-y divide-border/50">
                        {users.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground font-medium">회원 목록이 없습니다.</p>
                        ) : (
                          users.map((u) => {
                            const id = String(u.user_id)
                            return (
                              <label
                                key={id}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                              >
                                <Checkbox
                                  checked={selectedRecipientIds.has(id)}
                                  onCheckedChange={(v) => toggleRecipient(id, v === true)}
                                />
                                <span className="text-sm font-bold text-foreground">{u.name}</span>
                                <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notice-title" className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                    공지 제목
                  </Label>
                  <Input
                    id="notice-title"
                    placeholder="사용자에게 보낼 제목을 입력하세요"
                    className="h-14 rounded-2xl bg-muted/20 border-border"
                    maxLength={NOTIFICATION_TITLE_MAX_LENGTH}
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {announcementTitle.length} / {NOTIFICATION_TITLE_MAX_LENGTH}
                  </p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="notice-body" className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                    내용
                  </Label>
                  <Textarea
                    id="notice-body"
                    placeholder="전송할 상세 메시지를 작성하세요"
                    className="min-h-[200px] rounded-2xl bg-muted/20 border-border p-6 text-foreground resize-none focus-visible:ring-primary"
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="notice-link" className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                    링크 (선택)
                  </Label>
                  <Input
                    id="notice-link"
                    placeholder="https://..."
                    className="h-12 rounded-2xl bg-muted/20 border-border"
                    maxLength={NOTIFICATION_LINK_MAX_LENGTH}
                    value={announcementLink}
                    onChange={(e) => setAnnouncementLink(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="w-full h-16 rounded-2xl bg-foreground text-background font-black text-lg hover:opacity-90 shadow-2xl disabled:opacity-60"
                  disabled={
                    isSendingNotice ||
                    (broadcastAudience === 'selected' && selectedRecipientIds.size === 0)
                  }
                  onClick={handleSendBroadcast}
                >
                  <MessageSquare className="mr-2 h-6 w-6" />
                  {broadcastAudience === 'global'
                    ? isSendingNotice
                      ? '발송 중...'
                      : '전체 공지 발송하기'
                    : isSendingNotice
                      ? '발송 중...'
                      : `선택한 ${selectedRecipientIds.size}명에게 발송`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notification-history">
            <AdminSentNotificationsPanel reloadSignal={notificationLogReloadKey} />
          </TabsContent>
        </Tabs>
      </div>

      {/* 회원 상세 조회 Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto bg-card border-l border-border p-0 rounded-l-[3.5rem] shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.25)]">
          <div className="h-48 bg-gradient-to-br from-rose-500/20 via-primary/10 to-card p-10 flex items-end">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center border-4 border-card">
                <UserIcon size={48} className="text-rose-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-foreground tracking-tighter">{selectedUser?.name}</h2>
                <p className="font-bold text-muted-foreground/80 flex items-center gap-2">
                  <MessageSquare size={16} /> {selectedUser?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-10">
            {/* 구독 현황 카드 */}
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-8 bg-muted/20 border-none rounded-[2.5rem] shadow-inner">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-3">Current Plan Status</span>
                <div className="flex flex-col gap-2">
                  <span className="text-3xl font-black text-foreground uppercase tracking-tight">{selectedUser?.current_plan}</span>
                  <div className="flex">{getStatusBadge(selectedUser?.subscription_status)}</div>
                </div>
              </Card>
              <Card className="p-8 bg-muted/20 border-none rounded-[2.5rem] shadow-inner">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-3">Revenue Value</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-foreground tracking-tighter">{(selectedUser?.total_paid || 0).toLocaleString()}</span>
                  <span className="text-sm font-bold text-muted-foreground">KRW</span>
                </div>
              </Card>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <Clock className="text-rose-500 h-6 w-6" /> 구독 타임라인
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-6 rounded-3xl border border-border bg-card hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <Calendar size={20} className="text-muted-foreground" />
                    <span className="font-bold">최초 서비스 가입일</span>
                  </div>
                  <span className="font-black text-lg">{selectedUser?.joined_at && format(new Date(selectedUser.joined_at), 'yyyy-MM-dd')}</span>
                </div>
                <div className="flex items-center justify-between p-6 rounded-3xl border border-border bg-card hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <Activity size={20} className="text-muted-foreground" />
                    <span className="font-bold">가장 최근 구독 시작</span>
                  </div>
                  <span className="font-black text-lg">
                    {selectedUser?.subscription_started_at ? format(new Date(selectedUser.subscription_started_at), 'yyyy-MM-dd') : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-6 rounded-3xl border border-rose-500/40 bg-rose-500/5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <Bell size={20} className="text-rose-500" />
                    <span className="font-black text-rose-500 underline decoration-rose-500/20 underline-offset-8 text-lg text-rose-500">다음 결제 / 만료일</span>
                  </div>
                  <span className="font-black text-2xl text-rose-500">
                    {selectedUser?.current_period_end ? format(new Date(selectedUser.current_period_end), 'yyyy-MM-dd') : '-'}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="opacity-50" />

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black flex items-center gap-3">
                  <CreditCard className="text-primary h-6 w-6" /> 결제 히스토리
                </h3>
                <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary uppercase px-3 py-1">Secure Logs</Badge>
              </div>

              {isDetailLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-3xl" />)}
                </div>
              ) : userPayments.length > 0 ? (
                <div className="space-y-4">
                  {userPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-6 rounded-3xl bg-muted/10 border border-transparent hover:border-border transition-all group">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                          p.status === 'paid' ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white" : "bg-muted text-muted-foreground"
                        )}>
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <p className="text-lg font-black tracking-tight">{p.amount.toLocaleString()}원</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{p.merchant_uid}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <Badge variant={p.status === 'paid' ? 'default' : 'secondary'} className={cn(
                          "text-[10px] font-black uppercase px-2",
                          p.status === 'paid' && "bg-emerald-500"
                        )}>
                          {p.status}
                        </Badge>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-tighter">
                          {p.paid_at ? format(new Date(p.paid_at), 'yyyy-MM-dd HH:mm') : format(new Date(p.created_at), 'yyyy-MM-dd')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-24 text-center space-y-6 border-4 border-dashed border-muted/30 rounded-[3rem] bg-muted/5">
                  <Database className="h-16 w-16 text-muted-foreground/20 mx-auto animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-black text-xl">NO TRANSACTION DATA</p>
                    <p className="text-muted-foreground/60 text-sm font-bold">아직 결제된 내역이 발견되지 않았습니다.</p>
                  </div>
                </div>
              )}
            </div>

            <Separator className="opacity-50" />

            <div className="space-y-6">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <Bell className="text-primary h-6 w-6" /> 이 회원에게 공지
              </h3>
              <p className="text-sm text-muted-foreground font-medium">
                이 회원에게만 보이는 알림을 보냅니다. (다른 회원에게는 표시되지 않습니다.)
              </p>
              <div className="space-y-3">
                <Label htmlFor="sheet-notice-title" className="text-xs font-black uppercase text-muted-foreground">
                  제목
                </Label>
                <Input
                  id="sheet-notice-title"
                  className="h-12 rounded-2xl bg-muted/20 border-border"
                  maxLength={NOTIFICATION_TITLE_MAX_LENGTH}
                  value={sheetNoticeTitle}
                  onChange={(e) => setSheetNoticeTitle(e.target.value)}
                  placeholder="공지 제목"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="sheet-notice-body" className="text-xs font-black uppercase text-muted-foreground">
                  내용
                </Label>
                <Textarea
                  id="sheet-notice-body"
                  className="min-h-[120px] rounded-2xl bg-muted/20 border-border resize-none"
                  value={sheetNoticeBody}
                  onChange={(e) => setSheetNoticeBody(e.target.value)}
                  placeholder="전달할 메시지"
                />
              </div>
              <Button
                type="button"
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-base hover:opacity-95 disabled:opacity-50"
                disabled={isSheetNoticeSending}
                onClick={handleSendSheetNotice}
              >
                {isSheetNoticeSending ? '발송 중...' : '이 회원에게 공지 보내기'}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-20 rounded-3xl font-black text-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/20 mt-4"
            >
              <ExternalLink className="mr-3 h-7 w-7" /> 회원 상세 로그 분석 (Advanced)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
