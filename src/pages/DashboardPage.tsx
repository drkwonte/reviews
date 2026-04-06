import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  BarChart3, 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Repeat,
  ChevronRight
} from 'lucide-react'
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Line, 
  LineChart, 
  Bar, 
  BarChart
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/common/AppHeader'
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Note {
  id: string
  subject: string
  category?: string
  source?: string
  created_at: string
  accuracy?: number
  review_count?: number
  success_count?: number
}

interface ReviewLog {
  id: string
  note_id: string
  is_correct: boolean
  attempted_at: string
  created_at: string
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchNotes(), fetchReviewLogs()])
    setLoading(false)
  }

  const fetchNotes = async () => {
    try {
      const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (data) setNotes(data)
    } catch (e) {}
  }

  const fetchReviewLogs = async () => {
    try {
      const { data } = await supabase.from('review_logs').select('*').order('attempted_at', { ascending: true })
      if (data) setReviewLogs(data)
    } catch (e) {}
  }

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set<string>()
    notes.forEach(n => { if (n.subject) subjects.add(n.subject) })
    return Array.from(subjects).sort()
  }, [notes])

  const CHART_COLORS = [
    '#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
  ]

  const subjectDistributionData = useMemo(() => {
    const counts = notes.reduce((acc: any, note) => {
      const subject = note.subject || '미정'
      acc[subject] = (acc[subject] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts).map(([subject, count]) => ({ subject, count }))
  }, [notes])

  const todaysNotesCount = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA')
    return notes.filter(n => {
      const d = new Date(n.created_at).toLocaleDateString('en-CA')
      return d === today
    }).length
  }, [notes])

  const cumulativeHistoryData = useMemo(() => {
    const sortedNotes = [...notes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    if (sortedNotes.length === 0) return []
    const history: any[] = []
    const cumulativeSubjectCounts: Record<string, number> = {}
    uniqueSubjects.forEach(sub => { cumulativeSubjectCounts[sub] = 0 })
    
    let total = 0
    const dateGroups: Record<string, any[]> = {}
    sortedNotes.forEach(note => {
      const d = new Date(note.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
      if (!dateGroups[d]) dateGroups[d] = []
      dateGroups[d].push(note)
    })
    const sortedDates = Object.keys(dateGroups).sort()
    sortedDates.forEach(date => {
      total += dateGroups[date].length
      dateGroups[date].forEach(note => {
        if (note.subject && note.subject in cumulativeSubjectCounts) {
          cumulativeSubjectCounts[note.subject] += 1
        }
      })
      history.push({ date, total, ...{ ...cumulativeSubjectCounts } })
    })
    return history
  }, [notes, uniqueSubjects])

  const streakInfo = useMemo(() => {
    if (reviewLogs.length === 0) return { streak: 0, dates: [] }
    const rawDates = Array.from(new Set(reviewLogs.map(log => {
      return new Date(log.attempted_at || log.created_at).toLocaleDateString('en-CA')
    }))).sort().reverse()
    const todayStr = new Date().toLocaleDateString('en-CA')
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA')
    let currentStreak = 0
    let mostRecentDate = rawDates[0]
    if (mostRecentDate === todayStr || mostRecentDate === yesterdayStr) {
      let checkDate = new Date(mostRecentDate)
      while (true) {
        const checkStr = checkDate.toLocaleDateString('en-CA')
        if (rawDates.includes(checkStr)) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else break
      }
    }
    return { streak: currentStreak, dates: rawDates.map(d => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(y, m - 1, day)
    }) }
  }, [reviewLogs])

  const subjectReviewData = useMemo(() => {
    const counts: Record<string, number> = {}
    uniqueSubjects.forEach(sub => { counts[sub] = 0 })
    
    reviewLogs.forEach(log => {
      const parentNote = notes.find(n => n.id === log.note_id)
      const sub = parentNote?.subject
      if (sub && sub in counts) {
        counts[sub] += 1
      }
    })
    return Object.entries(counts).map(([subject, count]) => ({ subject, count }))
  }, [reviewLogs, notes, uniqueSubjects])

  const subjectSuccessData = useMemo(() => {
    const stats = notes.reduce((acc: any, note) => {
      const sub = note.subject || '미지정'
      if (!acc[sub]) acc[sub] = { success: 0, reviews: 0 }
      acc[sub].success += (note.success_count || 0)
      acc[sub].reviews += (note.review_count || 0)
      return acc
    }, {})
    return Object.entries(stats).map(([subject, s]: any) => ({
      subject,
      successRate: s.reviews > 0 ? Math.round((s.success / s.reviews) * 100) : 0
    })).filter(d => d.subject !== '미지정' && d.successRate >= 0)
  }, [notes])

  const growthChartConfig = useMemo(() => {
    const config: any = {
      total: { label: "전체 누적", color: "#A98E70" }
    }
    uniqueSubjects.forEach((sub, i) => {
      config[sub] = { label: sub, color: CHART_COLORS[i % CHART_COLORS.length] }
    })
    return config
  }, [uniqueSubjects])

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden transition-colors duration-300">
      <AppHeader />

      <div className="container py-10 px-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-foreground tracking-tight mb-2 uppercase">Dashboard</h1>
            <p className="text-muted-foreground font-bold tracking-tight">나의 학습 데이터 리포트</p>
          </div>
          <Button onClick={() => navigate('/notes/new')} className="bg-primary hover:bg-primary/90 text-white px-8 py-7 rounded-2xl shadow-xl shadow-primary/10 dark:shadow-none font-black text-lg h-auto transition-all hover:scale-[1.02]">
            <Plus className="mr-2 h-6 w-6" strokeWidth={3} /> 새 오답노트 등록
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {loading ? [1,2,3,4,5,6].map((i) => (
            <Card key={i} className="h-[350px] border border-border shadow-sm rounded-2xl overflow-hidden p-6 space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-full w-full rounded-xl" />
            </Card>
          )) : (
            <>
              {/* Card 1: 과목별 오답 수 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                    <BarChart3 size={16} className="text-primary" /> 오답노트 수 (과목별)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-6 flex items-center justify-center">
                   <ChartContainer config={{ count: { label: "노트 수", color: "#A98E70" } }} className="w-full h-full max-h-[240px]">
                    <BarChart data={subjectDistributionData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                      <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#A98E70" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                   </ChartContainer>
                </CardContent>
              </Card>

              {/* Card 2: 오늘 활동성 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                    <Clock size={16} className="text-primary" /> 오늘의 기록 현황
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                  <div className="w-32 h-32 rounded-full border-8 border-primary/10 dark:border-primary/5 flex flex-col items-center justify-center bg-card shadow-inner">
                    <span className="text-3xl font-black text-primary">{todaysNotesCount}</span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">notes today</span>
                  </div>
                  <p className="text-center font-bold text-muted-foreground text-sm leading-relaxed">
                    오늘도 꾸준히 <span className="text-primary">{todaysNotesCount}개</span>의<br/>오답을 새롭게 기록했습니다!
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: 성장 추이 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" /> 오답노트 성장 추이
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-6 flex items-center justify-center">
                  <ChartContainer config={growthChartConfig} className="w-full h-full max-h-[240px]">
                    <LineChart data={cumulativeHistoryData} margin={{ left: -20, right: 20, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} minTickGap={20} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="total" stroke="#A98E70" strokeWidth={3} dot={false} activeDot={false} />
                      {uniqueSubjects.map((sub, i) => (
                        <Line key={sub} type="monotone" dataKey={sub} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.5} dot={false} activeDot={false} />
                      ))}
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Card 4: 학습 캘린더 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                 <CardHeader className="pb-2 border-b border-border">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                      <CalendarIcon size={16} className="text-primary" /> 학습 실천 캘린더
                    </CardTitle>
                    <div className="px-3 py-1.5 bg-primary/10 rounded-xl flex items-center justify-center">
                      <span className="text-[11px] font-black text-primary">
                        현재 <span className="font-extrabold text-primary">{streakInfo.streak}일 </span> 연속으로 복습 중입니다! 🔥
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-2 flex items-center justify-center">
                  <div className="scale-90 transform-gpu transition-all text-foreground">
                    <Calendar mode="multiple" selected={streakInfo.dates} className="pointer-events-none border-none shadow-none bg-transparent" />
                  </div>
                </CardContent>
              </Card>

              {/* Card 5: 과목별 복습 횟수 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                    <Repeat size={16} className="text-primary/70" /> 과목별 복습 횟수
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-6 flex items-center justify-center">
                  <ChartContainer config={{ count: { label: "복습 횟수", color: "#A98E70" } }} className="w-full h-full max-h-[240px]">
                    <BarChart data={subjectReviewData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                      <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#A98E70" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Card 6: 복습 정답률 */}
              <Card className="border border-border shadow-sm rounded-2xl overflow-hidden flex flex-col h-[350px] bg-card">
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                    <Target size={16} className="text-primary" /> 복습 정답률
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-6 flex items-center justify-center">
                  <ChartContainer config={{ successRate: { label: "정답률", color: "#A98E70" } }} className="w-full h-full max-h-[240px]">
                    <BarChart data={subjectSuccessData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                      <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="successRate" fill="#A98E70" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="mt-28 border-t border-border pt-16 flex flex-col items-center">
          <div className="text-center mb-10">
             <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">오답노트</h2>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <Button onClick={() => navigate('/notes')} className="h-14 px-10 rounded-[20px] bg-foreground text-background font-black hover:opacity-90 shadow-xl transition-all hover:scale-105">전체 보기</Button>
            {uniqueSubjects.map(sub => (
              <Button key={sub} variant="outline" onClick={() => navigate(`/notes?subject=${sub}`)} className="h-14 px-10 rounded-[20px] border-border text-muted-foreground font-black hover:bg-muted hover:text-foreground transition-all hover:scale-105">{sub}</Button>
            ))}
          </div>

          <button onClick={() => navigate('/notes')} className="flex items-center gap-1 text-muted-foreground font-bold hover:text-primary transition-colors group">
            지금 바로 학습하러 가기 <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  )
}
