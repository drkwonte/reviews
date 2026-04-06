import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  TrendingUp, Calendar, BookOpen, Target, 
  Activity, ChevronRight
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHeader } from '@/components/common/AppHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1']

export default function StatsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesRes, logsRes] = await Promise.all([
        supabase.from('notes').select('*'),
        supabase.from('review_logs').select('*').order('attempted_at', { ascending: true })
      ])

      if (notesRes.error) throw notesRes.error
      if (logsRes.error) throw logsRes.error

      setNotes(notesRes.data || [])
      setLogs(logsRes.data || [])
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const activityData = useMemo(() => {
    const last14Days = [...Array(14)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      return d.toISOString().split('T')[0]
    })

    const counts = logs.reduce((acc: any, log: any) => {
      const date = new Date(log.attempted_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    return last14Days.map(date => ({
      date: date.split('-').slice(1).join('/'), // MM/DD
      count: counts[date] || 0
    }))
  }, [logs])

  const subjectData = useMemo(() => {
    const groups = notes.reduce((acc: any, note: any) => {
      const sub = note.subject || '미분류'
      if (!acc[sub]) acc[sub] = { name: sub, total: 0, accuracy: 0, count: 0 }
      acc[sub].total += 1
      acc[sub].accuracy += (note.accuracy || 0)
      acc[sub].count += 1
      return acc
    }, {})

    return Object.values(groups).map((g: any) => ({
      name: g.name,
      value: Math.round((g.accuracy / g.count) * 100),
      count: g.count
    }))
  }, [notes])

  const summary = useMemo(() => {
    const totalReviews = logs.length
    const today = new Date().toISOString().split('T')[0]
    const todayReviews = logs.filter(l => new Date(l.attempted_at).toISOString().split('T')[0] === today).length
    const avgAccuracy = notes.length > 0 
      ? Math.round((notes.reduce((acc, n) => acc + (n.accuracy || 0), 0) / notes.length) * 100) 
      : 0
    
    return {
      totalNotes: notes.length,
      totalReviews,
      todayReviews,
      avgAccuracy
    }
  }, [notes, logs])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary"></div>
        <p className="mt-4 text-sm font-bold text-muted-foreground animate-pulse">분석 리포트를 생성하고 있습니다...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden transition-colors duration-300">
      <AppHeader />
      
      <main className="container max-w-5xl px-4 py-10 mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate('/')}
            className="p-3 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase flex items-center gap-2">
               <TrendingUp size={24} className="text-primary" /> Stats Report
            </h1>
            <p className="text-sm font-bold text-muted-foreground">나의 학습 데이터 리포트</p>
          </div>
        </div>
        
        {/* 핵심 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card className="border border-border shadow-sm rounded-3xl group hover:-translate-y-1 transition-transform bg-card overflow-hidden">
            <CardContent className="p-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary rounded-xl"><BookOpen size={20} /></div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Total Notes</span>
               </div>
               <div className="text-3xl font-black text-foreground leading-none">{summary.totalNotes}개</div>
               <p className="text-xs font-bold text-muted-foreground mt-2">나의 지식 창고 크기</p>
            </CardContent>
          </Card>
          
          <Card className="border border-border shadow-sm rounded-3xl group hover:-translate-y-1 transition-transform bg-card overflow-hidden">
            <CardContent className="p-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><Activity size={20} /></div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Total Reviews</span>
               </div>
               <div className="text-3xl font-black text-foreground leading-none">{summary.totalReviews}회</div>
               <p className="text-xs font-bold text-muted-foreground mt-2">지독한 끈기의 증명</p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm rounded-3xl group hover:-translate-y-1 transition-transform bg-card overflow-hidden">
            <CardContent className="p-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><Calendar size={20} /></div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Today's Focus</span>
               </div>
               <div className="text-3xl font-black text-foreground leading-none">{summary.todayReviews}회</div>
               <p className="text-xs font-bold text-muted-foreground mt-2">오늘 나의 열정 지수</p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm rounded-3xl group hover:-translate-y-1 transition-transform bg-card overflow-hidden">
            <CardContent className="p-6">
               <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><Target size={20} /></div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Mastery Rate</span>
               </div>
               <div className="text-3xl font-black text-foreground leading-none">{summary.avgAccuracy}%</div>
               <p className="text-xs font-bold text-muted-foreground mt-2">전체 문제 정복 수준</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 최근 학습 활동 그래프 */}
          <Card className="lg:col-span-8 border border-border shadow-sm rounded-[40px] overflow-hidden bg-card">
            <CardHeader className="p-8 pb-0">
               <CardTitle className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                 <Calendar className="text-primary" /> 최근 학습 활동 (Active Learning)
               </CardTitle>
            </CardHeader>
            <CardContent className="p-8 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A98E70" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#C4AC8D" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="opacity-10" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc', opacity: 0.1 }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#barGradient)" 
                    radius={[10, 10, 10, 10]} 
                    barSize={24}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 과목별 분석 그래프 */}
          <Card className="lg:col-span-4 border border-border shadow-sm rounded-[40px] overflow-hidden bg-card">
            <CardHeader className="p-8 pb-0 text-center">
               <CardTitle className="text-xl font-black text-foreground tracking-tight">과목별 정복률</CardTitle>
            </CardHeader>
            <CardContent className="p-8 h-[400px] flex flex-col items-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1200}
                  >
                    {subjectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {subjectData.length > 0 ? subjectData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-muted-foreground">{entry.name} {entry.value}%</span>
                  </div>
                )) : <p className="text-xs text-muted-foreground font-bold">데이터가 없습니다</p>}
              </div>
            </CardContent>
          </Card>

          {/* 하단 인사이트 알람 */}
          <Card className="lg:col-span-12 border-0 bg-primary rounded-[32px] overflow-hidden shadow-2xl shadow-primary/20 dark:shadow-none">
             <CardContent className="p-10 flex flex-col md:flex-row items-center gap-8">
                <div className="p-6 bg-white/10 rounded-3xl backdrop-blur-xl">
                   <TrendingUp className="text-white h-12 w-12" />
                </div>
                <div className="flex-1 text-center md:text-left text-white">
                   <h3 className="text-2xl font-black mb-2 tracking-tight">오늘의 분석 결과</h3>
                   <p className="text-white/70 font-bold leading-relaxed max-w-2xl">
                     당신의 복습 패턴을 분석한 결과, 수학 단원의 정복도가 눈에 띄게 상승하고 있습니다. 📈 
                     끈기 있게 지속한다면 더욱 놀라운 성취를 거둘 수 있을 것입니다. 지금 바로 학습 리듬을 이어가세요!
                   </p>
                </div>
                <Button 
                  className="h-16 px-10 bg-white text-primary hover:bg-slate-50 font-black rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95"
                  onClick={() => navigate('/')}
                >
                   복습 계속하기 <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
             </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
