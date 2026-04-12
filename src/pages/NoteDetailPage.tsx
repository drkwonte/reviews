import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Target, ImageIcon, FileText, Eye, MapPin, BookOpen, ExternalLink, Save, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/common/AppHeader'
import { supabase } from '@/lib/supabase'
import { normalizeStoredImagePathList, pathsToPublicImageUrls } from '@/lib/noteMedia'
import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'

export default function NoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [note, setNote] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAnswer, setShowAnswer] = useState(false)
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image')
  const [reviewStatus, setReviewStatus] = useState<'success' | 'fail' | null>(null)

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true)
      await Promise.all([fetchNote(), fetchReviewLogs()])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNote = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    setNote(data)
  }

  const fetchReviewLogs = async () => {
    const { data, error } = await supabase
      .from('review_logs')
      .select('*')
      .eq('note_id', id)
      .order('attempted_at', { ascending: false })

    if (error) throw error
    setLogs(data || [])
  }

  const toggleFavorite = async () => {
    const newValue = !note.is_favorite
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_favorite: newValue })
        .eq('id', id)

      if (error) throw error
      setNote({ ...note, is_favorite: newValue })
    } catch (error) {
      console.error('Favorite toggle error:', error)
    }
  }

  const handleReview = async (success: boolean) => {
    if (reviewStatus === null) return
    try {
      if (!user) throw new Error('로그인이 필요합니다')

      const { error: logError } = await supabase
        .from('review_logs')
        .insert([{
          note_id: id,
          user_id: user.id,
          result: success ? 'success' : 'fail'
        }])

      if (logError) throw logError

      await Promise.all([fetchNote(), fetchReviewLogs()])
      
      if (success) {
        alert('성공! 기록되었습니다.')
      } else {
        alert('괜찮아요! 실패는 성공의 어머니입니다. 다시 도전해 보세요!')
      }
      
      setShowAnswer(false)
      setReviewStatus(null) 
      navigate('/notes')
    } catch (error: any) {
      console.error('Review submission error:', error)
      alert(`기록 중 오류가 발생했습니다: ${error.message}`)
    }
  }

  const renderMath = (text: string) => {
    if (!text) return null
    const parts = text.split(/(\$.*?\$)/g)
    return parts.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1)
        return <InlineMath key={index} math={formula} />
      }
      return <span key={index}>{part}</span>
    })
  }

  const successCount = logs.filter(l => l.result === 'success').length
  const displayAccuracy = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0

  const problemDisplayUrls = note
    ? pathsToPublicImageUrls(normalizeStoredImagePathList(note.problem_urls, note.problem_url))
    : []
  const answerDisplayUrls = note
    ? pathsToPublicImageUrls(normalizeStoredImagePathList(note.answer_urls, note.answer_url))
    : []

  return (
    <div className="min-h-screen bg-background pb-20 transition-colors duration-300">
      <AppHeader />

      <main className="container max-w-5xl px-4 py-10 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <aside className="lg:col-span-3 space-y-6">
            {loading ? (
              <Card className="h-96 border-border p-6 space-y-8">
                <Skeleton className="h-10 w-full rounded-xl" />
                <div className="space-y-4">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
                <div className="space-y-4 pt-4 border-t border-border">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
                <div className="space-y-4 pt-4 border-t border-border">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              </Card>
            ) : note ? (
              <Card className="border border-border shadow-lg rounded-2xl overflow-hidden border-t-4 border-t-primary bg-card">
                <CardContent className="p-6 space-y-5">
                  <Button 
                    variant="outline" 
                     onClick={toggleFavorite}
                     className={cn(
                       "w-full h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all",
                       note.is_favorite 
                        ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" 
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                     )}
                  >
                    <Star size={16} fill={note.is_favorite ? "currentColor" : "none"} />
                    {note.is_favorite ? '중요 문제 해제' : '중요 문제로 표시'}
                  </Button>

                  <div className="pt-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center">
                      <BookOpen size={12} className="mr-1" /> 과목
                    </h4>
                    <p className="text-sm font-bold text-primary">{note.subject || '-'}</p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center">
                      <MapPin size={12} className="mr-1" /> 분야/단원
                    </h4>
                    <p className="text-sm font-bold text-foreground flex items-center justify-between">
                      {note.category || '-'}
                      <ExternalLink size={12} className="text-muted" />
                    </p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center">
                      <FileText size={12} className="mr-1" /> 출처
                    </h4>
                    <p className="text-sm font-bold text-foreground">{note.source || '-'}</p>
                  </div>

                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center">
                        <Target size={12} className="mr-1" /> 마스터 달성도
                      </h4>
                      {(() => {
                        let consecutiveSuccesses = 0;
                        for (const log of logs) {
                          if (log.result === 'success') {
                            consecutiveSuccesses++;
                            if (consecutiveSuccesses >= 3) break;
                          } else break;
                        }
                        const isMastered = consecutiveSuccesses >= 3;

                        return (
                          <div className="space-y-2">
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-1000 ease-out", isMastered ? "bg-primary" : "bg-primary/60")}
                                style={{ width: `${Math.min((consecutiveSuccesses / 3) * 100, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black">
                               <span className={cn("uppercase tracking-tighter", isMastered ? "text-primary animate-pulse" : "text-muted-foreground")}>
                                 {isMastered ? 'MASTERED!' : 'IN PROGRESS'}
                               </span>
                               <span className="text-foreground">{Math.min(consecutiveSuccesses, 3)} / 3</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </aside>

          <div className="lg:col-span-9 space-y-8">
            {loading ? (
              <div className="space-y-8">
                <Skeleton className="h-96 w-full rounded-[32px]" />
                <Skeleton className="h-64 w-full rounded-[32px]" />
              </div>
            ) : note ? (
              <>
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-xs">Q</div>
                      <h2 className="text-xl font-black text-foreground tracking-tight">문제 (Problem)</h2>
                    </div>
                    <div className="bg-muted p-1.5 rounded-xl flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewMode('image')} className={cn("h-9 px-4 rounded-lg font-bold text-xs", viewMode === 'image' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>원본</Button>
                      <Button variant="ghost" size="sm" onClick={() => setViewMode('text')} className={cn("h-9 px-4 rounded-lg font-bold text-xs", viewMode === 'text' ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>텍스트</Button>
                    </div>
                  </div>

                  <Card className="border-0 shadow-xl rounded-[32px] overflow-hidden bg-card min-h-[400px]">
                    <CardContent className="p-0">
                      {viewMode === 'image' ? (
                        <div className="p-8 bg-muted/20 flex flex-col items-center justify-center gap-8">
                          {problemDisplayUrls.length > 0 ? (
                            problemDisplayUrls.map((url, imgIndex) => (
                              <figure key={`${url}-${imgIndex}`} className="w-full">
                                <img
                                  src={url}
                                  alt={`문제 ${imgIndex + 1}`}
                                  loading="lazy"
                                  className="w-full h-auto object-contain rounded-2xl shadow-2xl"
                                />
                                {problemDisplayUrls.length > 1 && (
                                  <figcaption className="mt-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {imgIndex + 1} / {problemDisplayUrls.length}
                                  </figcaption>
                                )}
                              </figure>
                            ))
                          ) : (
                            <ImageIcon size={64} className="text-muted" />
                          )}
                        </div>
                      ) : (
                        <div className="p-12 text-xl leading-relaxed text-foreground">
                          {renderMath(note.problem_text)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-xs">A</div>
                      <h2 className="text-xl font-black text-foreground tracking-tight">정답 및 풀이</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">복습 성공률</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-primary">{displayAccuracy}%</span>
                        </div>
                      </div>
                      {showAnswer && <Button variant="ghost" size="sm" onClick={() => setShowAnswer(false)} className="text-muted-foreground font-bold hover:text-primary">다시 가리기</Button>}
                    </div>
                  </div>

                  {!showAnswer ? (
                    <div onClick={() => setShowAnswer(true)} className="h-64 border-2 border-dashed border-border rounded-[32px] bg-muted/20 flex flex-col items-center justify-center cursor-pointer group hover:bg-primary/5 transition-all">
                      <div className="w-16 h-16 bg-card rounded-2xl shadow-xl flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                        <Eye size={32} />
                      </div>
                      <span className="text-lg font-black text-foreground">정답 확인하기</span>
                    </div>
                  ) : (
                    <Card className="border-0 shadow-xl rounded-[32px] overflow-hidden bg-card animate-in zoom-in-95 duration-300">
                      <CardContent className="p-12 space-y-10 text-foreground">
                        {answerDisplayUrls.length > 0 && (
                          <div className="flex flex-col gap-8">
                            {answerDisplayUrls.map((url, imgIndex) => (
                              <figure key={`${url}-${imgIndex}`} className="w-full">
                                <img
                                  src={url}
                                  alt={`정답 ${imgIndex + 1}`}
                                  loading="lazy"
                                  className="w-full h-auto object-contain rounded-2xl shadow-lg border border-border"
                                />
                                {answerDisplayUrls.length > 1 && (
                                  <figcaption className="mt-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {imgIndex + 1} / {answerDisplayUrls.length}
                                  </figcaption>
                                )}
                              </figure>
                            ))}
                          </div>
                        )}
                        {note.answer_text?.trim() ? (
                          <div className="p-8 bg-muted/50 rounded-[28px] border border-border">
                            <h4 className="text-sm font-black text-primary mb-4 uppercase">AI Solution Guide</h4>
                            <div className="leading-relaxed whitespace-pre-wrap">{renderMath(note.answer_text)}</div>
                          </div>
                        ) : null}

                        {/* 복습 결과 제출 버튼 */}
                        <div className="border-t border-border pt-10 flex flex-col items-center gap-6">
                          <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">이번 복습 결과를 기록해 주세요</p>
                          <div className="flex bg-muted p-1 rounded-[24px] w-full max-w-xs shadow-inner">
                            <button onClick={() => setReviewStatus('success')} className={cn("flex-1 py-4 rounded-[22px] font-black text-xs transition-all", reviewStatus === 'success' ? "bg-card text-primary shadow-xl" : "text-muted-foreground")}>성공</button>
                            <button onClick={() => setReviewStatus('fail')} className={cn("flex-1 py-4 rounded-[22px] font-black text-xs transition-all", reviewStatus === 'fail' ? "bg-card text-primary/60 shadow-xl" : "text-muted-foreground")}>실패</button>
                          </div>
                          <Button disabled={!reviewStatus} onClick={() => handleReview(reviewStatus === 'success')} className="w-full max-w-xs h-14 bg-foreground text-background font-black rounded-2xl hover:opacity-90 transition-all">
                            <Save size={18} className="mr-2" /> 기록 저장하기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
