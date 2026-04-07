import { useEffect, useState, useMemo } from 'react'
import { 
  Database, 
  Bell, 
  ArrowUpRight, 
  HardDrive,
  Activity,
  Save,
  MessageSquare,
  ShieldCheck
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
import { AppHeader } from '@/components/common/AppHeader'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [settings, setSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      // 1. 통계 데이터 (최근 30일)
      const { data: statsData } = await supabase
        .from('admin_stats_daily')
        .select('*')
        .order('stat_date', { ascending: true })
        .limit(30)
      
      // 2. 유저 오버뷰 (뷰에서 조회)
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
    } finally {
      setLoading(false)
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

  // 데이터 가공 (차트용)
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

  return (
    <div className="min-h-screen bg-background pb-20 transition-colors duration-300">
      <AppHeader />

      <div className="container py-10 px-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2 uppercase flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary" /> Admin Control
            </h1>
            <p className="text-muted-foreground font-bold tracking-tight">서비스 관리 및 시스템 통합 대시보드</p>
          </div>
          <Button variant="outline" onClick={fetchAdminData} className="h-12 px-6 rounded-xl border-border hover:bg-muted">
            새로고침
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="bg-card border border-border p-1.5 rounded-2xl h-14 w-full md:w-auto overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="overview" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">실시간 지표</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">회원 관리</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">시스템 설정</TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl font-bold px-8 h-full data-[state=active]:bg-primary data-[state=active]:text-white transition-all">공지 발송</TabsTrigger>
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
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Revenue Today</span>
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

            <Card className="border border-border shadow-xl rounded-[2.5rem] overflow-hidden bg-card">
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
            <Card className="border border-border shadow-xl rounded-[2.5rem] overflow-hidden bg-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50 h-16">
                    <TableRow>
                      <TableHead className="font-black text-xs uppercase px-8">사용자 정보</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center">플랜</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center">노트 수</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center">이미지 사용량</TableHead>
                      <TableHead className="font-black text-xs uppercase text-center">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id} className="h-20 hover:bg-muted/30 border-b border-border/50">
                        <TableCell className="px-8">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={u.current_plan === 'premium' ? 'default' : 'secondary'} className="rounded-full font-black uppercase text-[10px]">
                            {u.current_plan}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{u.note_count}</TableCell>
                        <TableCell className="text-center text-sm font-medium text-muted-foreground">
                          {formatByteSize(u.storage_usage_bytes)}
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-muted-foreground">
                          {format(new Date(u.joined_at), 'yyyy-MM-dd')}
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
              <Card key={s.key} className="border border-border shadow-sm rounded-3xl overflow-hidden bg-card p-8 flex flex-col justify-between group">
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
               </CardHeader>
               <CardContent className="px-0 pt-8 space-y-8">
                 <div className="space-y-3">
                   <span className="text-sm font-black text-muted-foreground uppercase tracking-wider">공지 제목</span>
                   <Input placeholder="사용자에게 보낼 제목을 입력하세요" className="h-14 rounded-2xl bg-muted/20 border-border" />
                 </div>
                 <div className="space-y-3">
                   <span className="text-sm font-black text-muted-foreground uppercase tracking-wider">내용</span>
                   <textarea 
                     placeholder="전송할 상세 메시지를 작성하세요" 
                     className="w-full min-h-[200px] rounded-2xl bg-muted/20 border-border p-6 text-foreground resize-none border focus:ring-2 focus:ring-primary outline-none transition-all"
                   />
                 </div>
                 <Button className="w-full h-16 rounded-2xl bg-foreground text-background font-black text-lg hover:opacity-90 shadow-2xl">
                   <MessageSquare className="mr-2 h-6 w-6" /> 전체 공지 발송하기
                 </Button>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
