import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Plus,
  Search,
  ChevronRight,
  BookOpen,
  Star,
  Trash2,
  Printer,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader } from '@/components/common/AppHeader'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  prepareNotesForPrintExport,
  buildNotesPrintLayout,
  buildNotesPrintHtml,
  openNotesPrintWindow,
  type RawNoteForExport,
} from '@/lib/noteExportPrint'

interface Note extends RawNoteForExport {
  success_count?: number
}

export default function NotesListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '전체')
  const [sortBy] = useState('latest')
  const [showFavorites, setShowFavorites] = useState(false)
  const [exportingPrint, setExportingPrint] = useState(false)
  const [printIncludeById, setPrintIncludeById] = useState<Record<string, boolean>>({})
  const [printImageFirstById, setPrintImageFirstById] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  useEffect(() => {
    const sub = searchParams.get('subject')
    if (sub) setSelectedSubject(sub)
  }, [searchParams])

  const fetchData = async () => {
    setLoading(true)
    await fetchNotes()
    setLoading(false)
  }

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) setNotes(data)
    } catch (error) {
      console.error('Error fetching notes:', error)
    }
  }

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation()
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) {
      alert('오류: ' + error.message)
      return
    }
    setNotes(notes.filter((n) => n.id !== noteId))
  }

  const toggleFavorite = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    const newValue = !note.is_favorite
    const { error } = await supabase.from('notes').update({ is_favorite: newValue }).eq('id', note.id)
    if (error) {
      alert('오류: ' + error.message)
      return
    }
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, is_favorite: newValue } : n)))
  }

  const subjects = useMemo(() => {
    const set = new Set<string>(['전체'])
    notes.forEach((n) => {
      if (n.subject) set.add(n.subject)
    })
    return Array.from(set).sort((a, b) => {
      if (a === '전체') return -1
      if (b === '전체') return 1
      return a.localeCompare(b)
    })
  }, [notes])

  const filteredNotes = useMemo(() => {
    let result = notes.filter((note) => {
      const matchesSearch =
        note.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.problem_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.source?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSubject = selectedSubject === '전체' || note.subject === selectedSubject
      const matchesFavorite = !showFavorites || note.is_favorite
      return matchesSearch && matchesSubject && matchesFavorite
    })
    if (sortBy === 'accuracy') result.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))
    else result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return result
  }, [notes, searchTerm, selectedSubject, sortBy, showFavorites])

  const filteredNoteIdsKey = useMemo(() => filteredNotes.map((n) => n.id).join('|'), [filteredNotes])

  useEffect(() => {
    const nextInclude: Record<string, boolean> = {}
    const nextImageFirst: Record<string, boolean> = {}
    for (const n of filteredNotes) {
      nextInclude[n.id] = true
      nextImageFirst[n.id] = true
    }
    setPrintIncludeById(nextInclude)
    setPrintImageFirstById(nextImageFirst)
  }, [filteredNoteIdsKey])

  const filterSummaryForExport = useMemo(() => {
    const parts: string[] = []
    if (selectedSubject !== '전체') parts.push(`과목: ${selectedSubject}`)
    if (showFavorites) parts.push('중요 표시만')
    const q = searchTerm.trim()
    if (q) parts.push(`검색: "${q}"`)
    return parts.length > 0 ? parts.join(' · ') : '필터 없음 (목록과 동일)'
  }, [selectedSubject, showFavorites, searchTerm])

  const hasPrintSelection = filteredNotes.some((n) => printIncludeById[n.id] !== false)

  const runPrintExport = async () => {
    if (filteredNotes.length === 0) {
      alert('현재 화면에 표시된 오답노트가 없습니다.')
      return
    }
    const selected = filteredNotes.filter((n) => printIncludeById[n.id] !== false)
    if (selected.length === 0) {
      alert('인쇄에 포함할 오답노트를 하나 이상 선택해 주세요.')
      return
    }
    setExportingPrint(true)
    try {
      const prepared = await prepareNotesForPrintExport(selected as RawNoteForExport[])
      const layout = buildNotesPrintLayout(prepared, {
        problemImageFirstByNoteId: printImageFirstById,
      })
      const html = buildNotesPrintHtml(layout, {
        titleLine: 'nextime 오답노트',
        filterLine: filterSummaryForExport,
        exportedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
      })
      openNotesPrintWindow(html)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '보내기에 실패했습니다.')
    } finally {
      setExportingPrint(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden transition-colors duration-300">
      <AppHeader />

      <div className="container py-10 px-4 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-foreground tracking-tighter mb-2 uppercase">오답노트</h1>
            <p className="text-muted-foreground font-bold tracking-tight">기록된 오답을 체계적으로 분석하세요</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <div className="flex gap-2 justify-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl font-black border-border h-12 px-4"
                disabled={exportingPrint || filteredNotes.length === 0 || !hasPrintSelection}
                title="프린터로 출력하거나, 인쇄 창에서 대상을 PDF로 저장으로 바꿔 PDF 파일을 만들 수 있습니다."
                onClick={() => void runPrintExport()}
              >
                {exportingPrint ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-5 w-5" />
                )}
                인쇄
              </Button>
            </div>
            <Button
              onClick={() => navigate('/notes/new')}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-7 rounded-2xl shadow-xl shadow-primary/10 dark:shadow-none font-black text-lg h-auto transition-all hover:scale-[1.02]"
            >
              <Plus className="mr-2 h-6 w-6" strokeWidth={3} /> 새 오답노트 등록
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-card p-1.5 rounded-full border border-border shadow-sm overflow-x-auto">
              {subjects.map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setSelectedSubject(sub)
                    setSearchParams({ subject: sub === '전체' ? '' : sub })
                  }}
                  className={cn(
                    'px-6 py-2 rounded-full text-[11px] font-black transition-all whitespace-nowrap',
                    selectedSubject === sub
                      ? 'bg-foreground text-background shadow-xl'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className={cn(
                'h-11 px-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all',
                showFavorites ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600',
              )}
              onClick={() => setShowFavorites(!showFavorites)}
            >
              <Star
                size={12}
                className={cn('mr-2 transition-transform group-hover:scale-125', showFavorites ? 'fill-current' : '')}
              />
              중요 문제만
            </Button>
          </div>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="어떤 문제를 찾으시나요?"
              className="pl-12 h-12 bg-card border-border rounded-full focus:border-primary font-bold text-sm shadow-sm transition-all focus:ring-4 focus:ring-primary/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/5] bg-card rounded-[40px] border border-border p-8 space-y-6">
                <Skeleton className="h-48 w-full rounded-3xl" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-8 w-2/3" />
                <div className="pt-6 border-t border-border flex justify-between">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredNotes.map((note) => {
              const displayAccuracy = Math.round((note.accuracy || 0) * 100)
              const hasReviewed = (note.review_count || 0) > 0

              return (
                <div
                  key={note.id}
                  className="group bg-card rounded-[40px] border border-border overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer flex flex-col relative"
                  onClick={() => navigate(`/notes/${note.id}`)}
                >
                  <div className="h-52 bg-muted relative overflow-hidden shrink-0">
                    {note.problem_url ? (
                      <img
                        src={note.problem_url}
                        alt={note.subject}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200">
                        <BookOpen size={48} strokeWidth={1} />
                      </div>
                    )}
                    <Badge className="absolute top-5 left-5 bg-slate-900/80 backdrop-blur-md text-white border-0 font-black px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest shadow-lg">
                      {note.subject}
                    </Badge>
                    {note.is_favorite && (
                      <div className="absolute top-5 right-5 text-primary drop-shadow-md">
                        <Star size={20} fill="currentColor" />
                      </div>
                    )}
                  </div>

                  <div
                    className="px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 bg-muted/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id={`print-include-${note.id}`}
                        checked={printIncludeById[note.id] !== false}
                        onCheckedChange={(checked) =>
                          setPrintIncludeById((prev) => ({
                            ...prev,
                            [note.id]: checked === true,
                          }))
                        }
                        className="border-border"
                      />
                      <Label
                        htmlFor={`print-include-${note.id}`}
                        className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-foreground leading-none whitespace-nowrap"
                      >
                        인쇄/보내기
                      </Label>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id={`print-image-first-${note.id}`}
                        checked={printImageFirstById[note.id] !== false}
                        onCheckedChange={(checked) =>
                          setPrintImageFirstById((prev) => ({
                            ...prev,
                            [note.id]: checked === true,
                          }))
                        }
                        className="border-border"
                      />
                      <Label
                        htmlFor={`print-image-first-${note.id}`}
                        className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-foreground leading-none whitespace-nowrap"
                      >
                        이미지 위주
                      </Label>
                    </div>
                  </div>

                  <div className="p-8 pt-4 flex-1 flex flex-col">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                      {note.source || '직접 등록'}
                    </p>
                    <h3 className="font-extrabold text-foreground text-lg line-clamp-1 mb-5">
                      {note.category || '단원 미상'}
                    </h3>
                    <div className="flex items-center justify-between pt-5 border-t border-border mt-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                          복습 정답률
                        </span>
                        <span
                          className={cn(
                            'font-black leading-none',
                            hasReviewed ? 'text-xl text-primary' : 'text-sm text-muted-foreground italic',
                          )}
                        >
                          {hasReviewed ? `${displayAccuracy}%` : '복습 시작하지 않음'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => toggleFavorite(e, note)}
                          className={cn(
                            'p-2 rounded-full transition-all hover:scale-110',
                            note.is_favorite ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Star size={20} fill={note.is_favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, note.id)}
                          className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all hover:scale-110"
                        >
                          <Trash2 size={20} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center ml-2 border border-border group-hover:bg-foreground group-hover:border-foreground transition-all">
                          <ChevronRight
                            size={18}
                            className="text-muted-foreground group-hover:text-background transition-all transform group-hover:translate-x-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-40 bg-card rounded-[40px] border-2 border-dashed border-border flex flex-col items-center">
            <Search className="h-24 w-24 text-muted mb-6" />
            <h3 className="text-2xl font-black text-foreground">오답노트가 비어있어요</h3>
            <p className="text-muted-foreground font-bold mt-2">
              조건에 맞는 문제가 없거나 아직 등록된 문제가 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
