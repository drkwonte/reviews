import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  User,
  Bell,
  CreditCard,
  KeyRound,
  Loader2,
  Megaphone,
  UserCircle,
} from 'lucide-react'
import { AppHeader } from '@/components/common/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  USER_LEVEL_OPTIONS,
  USER_LEVEL_SELECT_VALUE_NONE,
  USER_LEVEL_CUSTOM,
} from '@/constants/userProfile'
import {
  isGlobalNotificationRead,
  markGlobalNotificationRead,
} from '@/utils/globalNotificationReadState'

const PASSWORD_MIN_LENGTH = 8

const SETTINGS_TAB_IDS = ['profile', 'security', 'notices', 'billing'] as const
type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number]

function isSettingsTabId(value: string | null): value is SettingsTabId {
  return value !== null && SETTINGS_TAB_IDS.includes(value as SettingsTabId)
}

interface UserPlanStatusRow {
  user_id: string
  email: string
  user_type: string
  current_plan: string
  current_period_end: string | null
  subscription_status: string | null
}

interface UserNotificationRow {
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

export default function SettingsPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => {
    const t = searchParams.get('tab')
    return isSettingsTabId(t) ? t : 'profile'
  })

  const [name, setName] = useState('')
  const [levelMode, setLevelMode] = useState<string>(USER_LEVEL_SELECT_VALUE_NONE)
  const [levelCustom, setLevelCustom] = useState('')
  const [marketingAgreed, setMarketingAgreed] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [planStatus, setPlanStatus] = useState<UserPlanStatusRow | null>(null)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [billingLoading, setBillingLoading] = useState(true)

  const [notices, setNotices] = useState<UserNotificationRow[]>([])
  const [noticesLoading, setNoticesLoading] = useState(true)
  const [noticeActionId, setNoticeActionId] = useState<string | null>(null)

  const hasEmailPasswordLogin = useMemo(
    () => Boolean(user?.identities?.some((i) => i.provider === 'email')),
    [user],
  )

  useEffect(() => {
    const t = searchParams.get('tab')
    if (isSettingsTabId(t)) setActiveTab(t)
    else if (t === null || t === '') setActiveTab('profile')
  }, [searchParams])

  const handleSettingsTabChange = (value: string) => {
    if (!isSettingsTabId(value)) return
    setActiveTab(value)
    if (value === 'profile') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: value }, { replace: true })
    }
  }

  useEffect(() => {
    if (!profile) return
    setName(profile.name)
    setMarketingAgreed(profile.marketing_agreed)
    const raw = profile.user_level?.trim() ?? ''
    const preset = USER_LEVEL_OPTIONS.find(
      (o) => o.value === raw && o.value !== USER_LEVEL_SELECT_VALUE_NONE && o.value !== USER_LEVEL_CUSTOM,
    )
    if (!raw) {
      setLevelMode(USER_LEVEL_SELECT_VALUE_NONE)
      setLevelCustom('')
    } else if (preset) {
      setLevelMode(preset.value)
      setLevelCustom('')
    } else {
      setLevelMode(USER_LEVEL_CUSTOM)
      setLevelCustom(raw)
    }
  }, [profile])

  const loadBilling = useCallback(async () => {
    if (!user?.id) return
    setBillingLoading(true)
    try {
      const [planRes, subRes, payRes] = await Promise.all([
        supabase.from('user_plan_status').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('payment_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (planRes.data) setPlanStatus(planRes.data as UserPlanStatusRow)
      if (subRes.data) setSubscriptions(subRes.data)
      if (payRes.data) setPayments(payRes.data)
    } catch (e) {
      console.error('Billing load failed:', e)
    } finally {
      setBillingLoading(false)
    }
  }, [user?.id])

  const loadNotices = useCallback(async () => {
    if (!user?.id) return
    setNoticesLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, target_user_id, title, body, link, created_at, is_read, category, type')
        .or(`target_user_id.eq.${user.id},target_user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setNotices(
        (data ?? []).map((r) => ({
          id: String(r.id),
          target_user_id: r.target_user_id,
          title: r.title,
          body: r.body,
          link: r.link,
          created_at: r.created_at,
          is_read: r.is_read,
          category: r.category,
          type: r.type,
        })),
      )
    } catch (e) {
      console.error('Notices load failed:', e)
      setNotices([])
    } finally {
      setNoticesLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadBilling()
  }, [loadBilling])

  useEffect(() => {
    void loadNotices()
  }, [loadNotices])

  const resolveUserLevelForSave = (): string | null => {
    if (levelMode === USER_LEVEL_SELECT_VALUE_NONE) return null
    if (levelMode === USER_LEVEL_CUSTOM) {
      const t = levelCustom.trim()
      return t.length > 0 ? t : null
    }
    return levelMode
  }

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      alert('이름을 입력해 주세요.')
      return
    }
    setProfileSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: trimmedName,
          user_level: resolveUserLevelForSave(),
          marketing_agreed: marketingAgreed,
        })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      alert('프로필이 저장되었습니다.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '저장에 실패했습니다.'
      alert(msg)
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      alert(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`)
      return
    }
    if (newPassword !== confirmPassword) {
      alert('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      alert('비밀번호가 변경되었습니다.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '변경에 실패했습니다.'
      alert(msg)
    } finally {
      setPasswordSaving(false)
    }
  }

  const noticeRead = (n: UserNotificationRow): boolean => {
    if (!user?.id) return n.is_read
    if (n.target_user_id) return n.is_read
    return isGlobalNotificationRead(user.id, n.id)
  }

  const handleMarkNoticeRead = async (n: UserNotificationRow) => {
    if (!user?.id) return
    setNoticeActionId(n.id)
    try {
      if (n.target_user_id) {
        const { error } = await supabase.rpc('mark_my_notification_read', {
          p_id: Number(n.id),
        })
        if (error) throw error
      } else {
        markGlobalNotificationRead(user.id, n.id)
      }
      await loadNotices()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '처리에 실패했습니다.'
      alert(msg)
    } finally {
      setNoticeActionId(null)
    }
  }

  if (authLoading || (!profile && user)) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!profile || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background pb-20 transition-colors duration-300">
      <AppHeader />

      <main className="container max-w-4xl px-4 py-10 mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <UserCircle className="h-9 w-9 text-primary" />
            내 계정
          </h1>
          <p className="text-muted-foreground font-bold mt-2">
            프로필·공지·구독을 한곳에서 관리합니다. (대시보드 학습 요약과는 별도입니다.)
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleSettingsTabChange} className="space-y-8">
          <TabsList className="bg-card border border-border p-1.5 rounded-2xl h-auto flex-wrap w-full justify-start gap-1">
            <TabsTrigger value="profile" className="rounded-xl font-bold px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="h-4 w-4 mr-2 inline" />
              프로필
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl font-bold px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <KeyRound className="h-4 w-4 mr-2 inline" />
              보안
            </TabsTrigger>
            <TabsTrigger value="notices" className="rounded-xl font-bold px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bell className="h-4 w-4 mr-2 inline" />
              공지
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl font-bold px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-2 inline" />
              구독
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="rounded-3xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black">프로필</CardTitle>
                <CardDescription className="font-medium">
                  이름·학년(학습 단계)·마케팅 수신 여부는 Supabase <code className="text-xs">profiles</code> 테이블과
                  연동됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="acct-email">이메일</Label>
                  <Input
                    id="acct-email"
                    value={user.email ?? profile.email}
                    disabled
                    className="rounded-xl bg-muted/40 font-medium"
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    이메일 변경은 계정 보안 정책상 별도 절차가 필요할 수 있습니다.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acct-name">이름</Label>
                  <Input
                    id="acct-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>학년 / 학습 단계</Label>
                  <Select value={levelMode} onValueChange={setLevelMode}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_LEVEL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {levelMode === USER_LEVEL_CUSTOM && (
                    <Input
                      placeholder="예: 검정고시 준비"
                      value={levelCustom}
                      onChange={(e) => setLevelCustom(e.target.value)}
                      className="rounded-xl"
                      maxLength={64}
                    />
                  )}
                  <p className="text-xs text-muted-foreground font-medium">
                    <code className="text-xs">user_level</code> 필드에 저장되며 통계·추천 등에 활용할 수 있습니다.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                  <div>
                    <Label htmlFor="marketing" className="text-base font-bold">
                      마케팅 정보 수신
                    </Label>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                      이벤트·업데이트 소식 (선택)
                    </p>
                  </div>
                  <Switch
                    id="marketing"
                    checked={marketingAgreed}
                    onCheckedChange={setMarketingAgreed}
                  />
                </div>
                <Button
                  type="button"
                  className="rounded-xl font-black h-12"
                  onClick={() => void handleSaveProfile()}
                  disabled={profileSaving}
                >
                  {profileSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : '프로필 저장'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="rounded-3xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black">비밀번호</CardTitle>
                <CardDescription className="font-medium">
                  이메일로 가입한 계정만 비밀번호를 설정·변경할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!hasEmailPasswordLogin ? (
                  <p className="text-sm font-bold text-muted-foreground rounded-2xl border border-dashed border-border p-6">
                    현재 계정은 Google 등 소셜 로그인으로 연결되어 있어, 이 화면에서 비밀번호를 변경할 수 없습니다.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="new-pw">새 비밀번호</Label>
                      <Input
                        id="new-pw"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-pw">새 비밀번호 확인</Label>
                      <Input
                        id="confirm-pw"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {PASSWORD_MIN_LENGTH}자 이상 권장. Supabase Auth에 반영됩니다.
                    </p>
                    <Button
                      type="button"
                      className="rounded-xl font-black h-12"
                      onClick={() => void handlePasswordChange()}
                      disabled={passwordSaving}
                    >
                      {passwordSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : '비밀번호 변경'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notices" className="space-y-6">
            <Card className="rounded-3xl border-border shadow-sm">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <Megaphone className="h-6 w-6 text-primary" />
                    공지사항
                  </CardTitle>
                  <CardDescription className="font-medium mt-2">
                    전체 공지와 나에게 온 알림을 확인합니다. 개별 알림은 읽음 처리 시 DB에 반영되고, 전체 공지 읽음은 이
                    기기에만 저장됩니다.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold"
                  onClick={() => void loadNotices()}
                  disabled={noticesLoading}
                >
                  {noticesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '새로고침'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {noticesLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : notices.length === 0 ? (
                  <p className="text-center text-muted-foreground font-bold py-12">표시할 공지가 없습니다.</p>
                ) : (
                  <ul className="space-y-3">
                    {notices.map((n) => {
                      const read = noticeRead(n)
                      const isGlobal = n.target_user_id === null
                      return (
                        <li
                          key={n.id}
                          className={cn(
                            'rounded-2xl border p-5 transition-colors',
                            read ? 'border-border bg-muted/20' : 'border-primary/30 bg-primary/5',
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={isGlobal ? 'default' : 'secondary'} className="font-black text-[10px]">
                                {isGlobal ? '전체' : '나에게'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                {n.category}
                              </Badge>
                              {!read && (
                                <Badge variant="destructive" className="text-[10px] font-black">
                                  NEW
                                </Badge>
                              )}
                            </div>
                            <time className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                              {format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')}
                            </time>
                          </div>
                          <h3 className="font-black text-lg text-foreground mb-2 line-clamp-2">{n.title}</h3>
                          <p className="text-sm text-foreground/90 font-medium leading-relaxed line-clamp-3 break-words">
                            {n.body}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="rounded-xl font-bold"
                              asChild
                            >
                              <Link to={`/settings/notices/${n.id}`}>자세히 보기</Link>
                            </Button>
                            {!read && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-xl font-bold"
                                disabled={noticeActionId === n.id}
                                onClick={() => void handleMarkNoticeRead(n)}
                              >
                                {noticeActionId === n.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  '읽음 처리'
                                )}
                              </Button>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-medium mt-2">
                            링크·전체 본문은 상세 페이지에서 확인할 수 있습니다.
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card className="rounded-3xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black">구독·요금제</CardTitle>
                <CardDescription className="font-medium">
                  <code className="text-xs">user_plan_status</code> 뷰와 <code className="text-xs">subscriptions</code>·
                  <code className="text-xs">payment_orders</code> 테이블을 조회합니다. PG 연동 후 결제·해지 UI를 이어 붙일 수
                  있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {billingLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border p-6 bg-muted/10 space-y-3">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                        현재 플랜
                      </p>
                      <div className="flex flex-wrap items-baseline gap-3">
                        <span className="text-3xl font-black uppercase">
                          {planStatus?.current_plan ?? 'basic'}
                        </span>
                        {planStatus?.subscription_status && (
                          <Badge className="font-black text-[10px] uppercase rounded-full">
                            {planStatus.subscription_status}
                          </Badge>
                        )}
                      </div>
                      {planStatus?.current_period_end && (
                        <p className="text-sm font-bold text-muted-foreground">
                          다음 갱신·만료 참고일:{' '}
                          <span className="text-foreground">
                            {format(new Date(planStatus.current_period_end), 'yyyy-MM-dd HH:mm')}
                          </span>
                        </p>
                      )}
                      {!planStatus?.current_period_end && (
                        <p className="text-sm font-bold text-muted-foreground">
                          활성 구독 기간이 없습니다. 무료(Basic) 플랜으로 이용 중일 수 있습니다.
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="font-black text-lg mb-3">구독 이력</h3>
                      {subscriptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-medium">저장된 구독 행이 없습니다.</p>
                      ) : (
                        <ul className="space-y-2">
                          {subscriptions.map((s) => (
                            <li
                              key={s.id}
                              className="rounded-xl border border-border px-4 py-3 text-sm font-medium flex flex-wrap gap-x-4 gap-y-1"
                            >
                              <span className="font-black">{s.plan}</span>
                              <span className="text-muted-foreground">{s.status}</span>
                              <span className="text-muted-foreground">
                                {s.current_period_end
                                  ? `만료 ${format(new Date(s.current_period_end), 'yyyy-MM-dd')}`
                                  : ''}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {s.billing_interval === 'yearly' ? '연간' : '월간'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-black text-lg mb-3">결제 내역</h3>
                      {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground font-medium">결제 기록이 없습니다.</p>
                      ) : (
                        <ul className="space-y-2">
                          {payments.map((p) => (
                            <li
                              key={p.id}
                              className="rounded-xl border border-border px-4 py-3 flex flex-wrap justify-between gap-2 text-sm"
                            >
                              <span className="font-black">{Number(p.amount).toLocaleString()}원</span>
                              <Badge variant="outline" className="font-black text-[10px] uppercase">
                                {p.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground w-full sm:w-auto">
                                {p.paid_at
                                  ? format(new Date(p.paid_at), 'yyyy-MM-dd HH:mm')
                                  : format(new Date(p.created_at), 'yyyy-MM-dd')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6">
                      <p className="text-sm font-bold text-foreground mb-2">프리미엄 업그레이드</p>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                        토스페이먼츠·Stripe 등 PG 연동( subscription.md 2단계 ) 후 이 영역에서 요금제 선택·결제를 진행할 수
                        있습니다.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
