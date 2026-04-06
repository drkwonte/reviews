import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Line, 
  LineChart, 
  Bar, 
  BarChart 
} from 'recharts'
import 'katex/dist/katex.min.css'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart'
import { Calendar } from '@/components/ui/calendar'

// 3개월 열공 사용자를 위한 리얼 목업 데이터셋
const MOCK_DATA = {
  distribution: [
    { subject: '수학', count: 124 },
    { subject: '국어', count: 86 },
    { subject: '영어', count: 92 }
  ],
  todaysCount: 8,
  growth: [
    { date: '01.01', total: 10, 수학: 4, 국어: 3, 영어: 3 },
    { date: '01.15', total: 45, 수학: 18, 국어: 12, 영어: 15 },
    { date: '02.01', total: 92, 수학: 35, 국어: 28, 영어: 29 },
    { date: '02.15', total: 148, 수학: 58, 국어: 42, 영어: 48 },
    { date: '03.01', total: 210, 수학: 84, 국어: 62, 영어: 64 },
    { date: '03.15', total: 265, 수학: 105, 국어: 78, 영어: 82 },
    { date: '04.05', total: 302, 수학: 124, 국어: 86, 영어: 92 }
  ],
  reviewStats: [
    { subject: '수학', count: 48, rate: 72 },
    { subject: '국어', count: 32, rate: 94 },
    { subject: '영어', count: 35, rate: 68 }
  ],
  streakDates: Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d
  })
}

const CHART_CONFIG = {
  count: { label: "노트 수", color: "#A98E70" },
  total: { label: "전체 누적", color: "#A98E70" },
  수학: { label: "수학", color: "#ef4444" },
  국어: { label: "국어", color: "#3b82f6" },
  영어: { label: "영어", color: "#f59e0b" },
  rate: { label: "정답률", color: "#A98E70" }
}

const RealAppShowcase = () => {
    const [step, setStep] = useState(0)
    const images = [
        '/images/showcase/step1.png',
        '/images/showcase/step2.png',
        '/images/showcase/step3.png',
        '/images/showcase/step4.png'
    ]

    useEffect(() => {
        const timer = setInterval(() => {
            setStep(prev => (prev + 1) % 4)
        }, 5000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="w-full h-full bg-slate-50 rounded-[32px] md:rounded-[40px] p-2 flex items-center justify-center relative overflow-hidden group border border-slate-100">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={step} 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 1.02 }} 
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} 
                    className="w-full h-full flex items-center justify-center"
                >
                    <div className="relative w-full h-full bg-white rounded-[24px] md:rounded-[32px] shadow-sm overflow-hidden border border-slate-100">
                        <img 
                            src={images[step]} 
                            alt={`Step ${step + 1}`} 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 backdrop-blur-sm rounded-full text-[9px] font-black text-white uppercase tracking-tighter shadow-xl flex items-center gap-1.5 z-20">
                           <span className="w-1.5 h-1.5 bg-[#A98E70] rounded-full animate-pulse" />
                           Phase {step + 1}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {images.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-0.5 rounded-full transition-all duration-700 ${step === i ? 'w-4 bg-slate-400' : 'w-1 bg-slate-200'}`} 
                    />
                ))}
            </div>
        </div>
    )
}

const FeatureSection = () => {
  const [activeChart, setActiveChart] = useState(0)
  const [activeReviewChart, setActiveReviewChart] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveChart((prev: number) => (prev + 1) % 3)
      setActiveReviewChart((prev: number) => (prev + 1) % 3)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-48 py-20 font-sans tracking-tight">
      {/* 피처 1: 대시보드 리얼 컴포넌트 - 오답노트 수 / 오늘 현황 / 성장 추이 */}
      <div className="flex flex-col md:flex-row items-center gap-24">
        <div className="w-full md:w-1/2 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Dashboard Preview</div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight whitespace-pre-wrap">쉽고 간편한{"\n"}오답노트 관리</h2>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <button 
                key={i} 
                onClick={() => setActiveChart(i)}
                className={`h-2 rounded-full transition-all duration-700 ${activeChart === i ? 'w-12 bg-black' : 'w-3 bg-slate-200'}`} 
              />
            ))}
          </div>
        </div>
        
        <div className="w-full md:w-1/2 relative bg-slate-50 rounded-[60px] p-8 aspect-[4/3] flex items-center justify-center shadow-inner overflow-hidden border border-slate-100">
          <AnimatePresence mode="wait">
            <motion.div key={activeChart} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md">
              {activeChart === 0 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white translate-z-0">
                  <CardHeader className="pb-2 border-b border-border text-left">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">오답노트 수 (과목별)</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex items-center justify-center">
                    <ChartContainer config={CHART_CONFIG} className="w-full h-full max-h-[260px]">
                      <BarChart data={MOCK_DATA.distribution} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                        <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="#A98E70" radius={[8, 8, 0, 0]} barSize={50} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {activeChart === 1 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white">
                  <CardHeader className="pb-3 border-b border-border text-left">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">오늘의 기록 현황</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
                    <div className="w-40 h-40 rounded-full border-[12px] border-slate-50 flex flex-col items-center justify-center bg-white shadow-inner relative">
                      <div className="absolute inset-[-12px] rounded-full border-[12px] border-[#A98E70] border-t-transparent shadow-sm" />
                      <span className="text-5xl font-black text-[#A98E70]">{MOCK_DATA.todaysCount}</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">notes today</span>
                    </div>
                    <p className="text-center font-bold text-slate-300 text-sm leading-tight px-8">오늘도 목표를 향해{"\n"}완벽하게 달리고 있습니다</p>
                  </CardContent>
                </Card>
              )}

              {activeChart === 2 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white">
                  <CardHeader className="pb-2 border-b border-border text-left">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">오답노트 성장 추이</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex items-center justify-center">
                    <ChartContainer config={CHART_CONFIG} className="w-full h-full max-h-[260px]">
                      <LineChart data={MOCK_DATA.growth} margin={{ left: -20, right: 20, top: 10, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} minTickGap={20} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Line type="monotone" dataKey="total" stroke="#A98E70" strokeWidth={4} dot={false} activeDot={false} />
                        <Line type="monotone" dataKey="수학" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="국어" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="영어" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 피처 2: AI 리얼 월드 인프라 - 사용자 실제 촬영본 적용 */}
      <div className="flex flex-col md:flex-row-reverse items-center gap-24 text-left">
        <div className="w-full md:w-1/2 space-y-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Core Technology</div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight whitespace-pre-wrap">찍기만 하세요,{"\n"}나머지는 AI가 합니다</h2>
          
          <ul className="space-y-4 pt-2 border-l-2 border-slate-50 pl-10 relative">
            <div className="absolute top-0 left-[-2px] h-20 w-1 bg-gradient-to-b from-[#A98E70] to-transparent pointer-events-none" />
            {[
              { title: "글자 읽기", desc: "이미지 속의 문제와 글자를 정확하게 읽어냅니다." },
              { title: "수식 시각화", desc: "복잡한 수학 기호도 화면에서 깔끔하게 담아냅니다." },
              { title: "해설 가이드", desc: "해설지가 없어도 AI가 상세한 풀이 과정을 생성합니다." }
            ].map((item, i) => (
              <li key={i} className="group cursor-default relative">
                <span className="text-xl font-black text-slate-900 group-hover:text-[#A98E70] transition-colors tracking-tight">{item.title}</span>
                <p className="text-xs font-bold text-slate-400 mt-1 leading-snug max-w-sm">{item.desc}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full md:w-1/2 relative">
             <div className="aspect-[4/3] w-full">
                <RealAppShowcase />
             </div>
        </div>
      </div>

      {/* 피처 3: 마스터 시스템 - 학습 캘린더 / 복습 횟수 / 정답률 */}
      <div className="flex flex-col md:flex-row items-center gap-24 font-sans tracking-tight">
        <div className="w-full md:w-1/2 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Master System</div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight whitespace-pre-wrap">체계적인 복습 관리/{"\n"}마스터 시스템</h2>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <button 
                key={i} 
                onClick={() => setActiveReviewChart(i)}
                className={`h-2 rounded-full transition-all duration-700 ${activeReviewChart === i ? 'w-12 bg-black' : 'w-3 bg-slate-200'}`} 
              />
            ))}
          </div>
        </div>
        
        <div className="w-full md:w-1/2 relative bg-slate-50 rounded-[60px] p-8 aspect-[4/3] flex items-center justify-center shadow-inner overflow-hidden border border-slate-100">
          <AnimatePresence mode="wait">
            <motion.div key={activeReviewChart} initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md">
              {activeReviewChart === 0 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white text-left">
                  <CardHeader className="pb-2 border-b border-border">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">학습 실천 캘린더</CardTitle>
                    <div className="mt-1 px-3 py-1 bg-[#A98E70]/10 rounded-lg inline-flex">
                      <span className="text-[10px] font-black text-[#A98E70]">현재 30일 연속 복습 중! 🔥</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-2 flex items-center justify-center">
                    <div className="scale-75 origin-center">
                      <Calendar mode="multiple" selected={MOCK_DATA.streakDates} className="pointer-events-none" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeReviewChart === 1 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white translate-z-0">
                  <CardHeader className="pb-2 border-b border-border text-left">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">과목별 복습 횟수</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex items-center justify-center">
                    <ChartContainer config={CHART_CONFIG} className="w-full h-full max-h-[260px]">
                      <BarChart data={MOCK_DATA.reviewStats} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                        <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="#A98E70" radius={[8, 8, 0, 0]} barSize={50} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {activeReviewChart === 2 && (
                <Card className="border border-border shadow-2xl rounded-[32px] overflow-hidden flex flex-col h-[380px] bg-white translate-z-0">
                  <CardHeader className="pb-2 border-b border-border text-left">
                    <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">복습 정답률</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 flex items-center justify-center">
                    <ChartContainer config={CHART_CONFIG} className="w-full h-full max-h-[260px]">
                      <BarChart data={MOCK_DATA.reviewStats} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-10" />
                        <XAxis dataKey="subject" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} unit="%" domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="rate" fill="#A98E70" radius={[8, 8, 0, 0]} barSize={50} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 로그인 상태라면 랜딩 페이지를 거치지 않고 즉시 대시보드로 순간이동
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  if (user) return null // 리다이렉트 중 찰나의 순간에 보이지 않도록 함

  return (
    <div className="relative min-h-screen bg-white overflow-hidden selection:bg-slate-900 selection:text-white">
      {/* 헤더: 시인성 확보를 위한 글래스모피즘 적용 */}
      <nav className="fixed top-0 left-0 w-full p-4 md:p-6 lg:p-8 flex justify-between items-center z-50 bg-white/90 backdrop-blur-md border-b border-slate-100/50">
        <div className="flex items-center gap-2">
          <img src="/nextime_logo_rectangle_200.png" alt="logo" className="h-8 md:h-10 brightness-[0.7] contrast-[1.5]" />
        </div>
        <div>
          <Button 
            onClick={() => navigate('/login')}
            variant="ghost"
            className="text-slate-600 hover:text-black font-bold h-10 md:h-12 px-6 md:px-8 rounded-full transition-all text-base md:text-lg"
          >
            로그인
          </Button>
        </div>
      </nav>

      {/* 메인 히어로 섹션 */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center w-full max-w-6xl"
        >
          <div className="mb-12 w-full flex justify-center">
            <img src="/nextime_logo_rectangle_1400.png" alt="Nextime Hero Logo" className="w-full max-w-[1200px] h-auto pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.05)]" />
          </div>
          <div className="space-y-1 mb-24 flex flex-col items-center">
            <p className="text-xl md:text-2xl text-slate-500 font-medium tracking-tight leading-relaxed max-w-3xl">AI 기반 오답노트 nextime과 함께하는 스마트한 학습 습관</p>
            <p className="text-xl md:text-2xl text-slate-500 font-medium tracking-tight leading-relaxed">실패를 분석하고 미래로 나아가세요</p>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={() => navigate('/signup')} 
              className="bg-black text-white hover:bg-slate-800 px-16 h-16 rounded-full font-bold text-xl shadow-[0_20px_80px_rgba(0,0,0,0.15)] transition-all hover:scale-105 active:scale-95"
            >시작하기</Button>
          </div>
        </motion.div>
      </main>

      {/* 피처 섹션 */}
      <section className="relative z-10 bg-white pt-20 pb-60 overflow-hidden">
        <div className="container max-w-6xl mx-auto px-8">
            <FeatureSection />
        </div>
      </section>

      {/* 배경 도트 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />

      <footer className="relative py-32 text-center bg-white border-t border-slate-50">
        <div className="container max-w-6xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
            <img src="/nextime_logo_rectangle_200.png" alt="logo" className="h-6 opacity-30 grayscale" />
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Nextime © 2026 — Advanced Learning Agent</p>
            <div className="flex gap-6">
                {['Terms', 'Privacy', 'Security'].map(item => (
                    <span key={item} className="text-[10px] font-black text-slate-300 uppercase cursor-pointer hover:text-slate-900 transition-colors">{item}</span>
                ))}
            </div>
        </div>
      </footer>
    </div>
  )
}
