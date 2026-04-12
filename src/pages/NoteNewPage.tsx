import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Check, 
  Save,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHeader } from '@/components/common/AppHeader'
import { cn } from '@/lib/utils'
import { ImageUploader } from '@/components/common/ImageUploader'
import { mergeImagesVertical } from '@/utils/imageUtils'
import { extractTextFromImage, generateAnswerFromText } from '@/services/gemini'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { supabase } from '@/lib/supabase'
import { QUESTION_IMAGES_BUCKET } from '@/lib/noteMedia'
import { ImageCropModal } from '@/components/common/ImageCropModal'

type Step = 1 | 2 | 3 | 4

export default function NoteNewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('AI가 작업 중입니다...')

  // Step 1 & 2: 문제 정보 (다중 이미지 지원)
  const [problemImages, setProblemImages] = useState<File[]>([])
  const [mergedProblemFile, setMergedProblemFile] = useState<File | null>(null)
  const [problemText, setProblemText] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')

  // Step 3 & 4: 해답 정보 (다중 이미지 지원)
  const [answerImages, setAnswerImages] = useState<File[]>([])
  const [mergedAnswerFile, setMergedAnswerFile] = useState<File | null>(null)
  const [answerText, setAnswerText] = useState('')

  // Cropping States
  const [croppingImage, setCroppingImage] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [croppingType, setCroppingType] = useState<'problem' | 'answer'>('problem')
  const [croppingIndex, setCroppingIndex] = useState<number>(-1)

  const handleOpenCrop = (imageFile: File, type: 'problem' | 'answer', index: number) => {
    const reader = new FileReader()
    reader.onload = () => {
      setCroppingImage(reader.result as string)
      setCroppingType(type)
      setCroppingIndex(index)
      setIsCropOpen(true)
    }
    reader.readAsDataURL(imageFile)
  }

  const handleCropComplete = (croppedBlob: Blob) => {
    const fileName = `cropped_${Date.now()}.webp`
    const croppedFile = new File([croppedBlob], fileName, { type: 'image/webp' })
    
    if (croppingType === 'problem') {
      const newImages = [...problemImages]
      if (croppingIndex >= 0) {
        newImages[croppingIndex] = croppedFile
      } else {
        newImages.push(croppedFile)
      }
      setProblemImages(newImages)
    } else {
      const newImages = [...answerImages]
      if (croppingIndex >= 0) {
        newImages[croppingIndex] = croppedFile
      } else {
        newImages.push(croppedFile)
      }
      setAnswerImages(newImages)
    }
    setIsCropOpen(false)
    setCroppingIndex(-1)
  }

  // Step 1 -> Step 2: 문제 OCR 분석
  const handleExtractProblem = async () => {
    if (problemImages.length === 0 || !subject) {
      alert('필수 정보를 모두 입력해 주세요.')
      return
    }

    setLoading(true)
    setLoadingText('여러 장의 이미지를 병합하여 분석 중입니다...')
    try {
      // 파일명 순서대로 정렬 (숫자 포함 자연어 정렬)
      const sortedImages = [...problemImages].sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      
      const mergedFile = await mergeImagesVertical(sortedImages);
      setMergedProblemFile(mergedFile);

      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(mergedFile)
      })
      const base64 = await base64Promise
      const extracted = await extractTextFromImage(base64)
      
      setProblemText(extracted)
      setStep(2)
    } catch (error: any) {
      console.error('문제 OCR 실패:', error)
      alert('분석 중 오류가 발생했습니다. 직접 입력해 주세요.')
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  // Step 3 -> Step 4: 해답 OCR 분석
  const handleExtractAnswer = async () => {
    if (answerImages.length === 0) return

    setLoading(true)
    setLoadingText('해설 이미지들을 병합하여 분석 중입니다...')
    try {
      // 파일명 순서대로 정렬 (숫자 포함 자연어 정렬)
      const sortedImages = [...answerImages].sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const mergedFile = await mergeImagesVertical(sortedImages);
      setMergedAnswerFile(mergedFile);

      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(mergedFile)
      })
      const base64 = await base64Promise
      const extracted = await extractTextFromImage(base64)
      setAnswerText(extracted)
      setStep(4)
    } catch (error) {
      console.error('해답 OCR 실패:', error)
      alert('해답 분석 중 오류가 발생했습니다.')
      setStep(4)
    } finally {
      setLoading(false)
    }
  }

  // AI로 해답 생성 (Step 3 -> Step 4)
  const handleGenerateAIAnswer = async () => {
    if (!problemText) {
      alert('문제 내용이 없습니다.')
      return
    }

    setLoading(true)
    setLoadingText('AI가 해설을 생성하고 있습니다...')
    try {
      const { answer, explanation } = await generateAnswerFromText(problemText)
      const combined = `[정답]\n${answer}\n\n[풀이]\n${explanation}`
      setAnswerText(combined)
      setStep(4)
    } catch (error) {
      console.error('AI 생성 실패:', error)
      alert('AI 정답 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const renderMath = (text: string) => {
    if (!text) return ''
    let rendered = text
      .replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
        try { return katex.renderToString(formula, { displayMode: true }) } catch { return match }
      })
      .replace(/\$([^\$]+)\$/g, (match, formula) => {
        try { return katex.renderToString(formula, { displayMode: false }) } catch { return match }
      })
    return rendered.replace(/\n/g, '<br />')
  }

  const handleSave = async () => {
    if (!user) {
      alert('로그인이 필요한 기능입니다.')
      return
    }
    
    setLoading(true)
    setLoadingText('오답 노트를 서버에 저장하는 중입니다...')
    try {
      let problemImageUrl: string | null = null
      const problemPaths: string[] = []
      const saveBatchTimestamp = Date.now()

      if (problemImages.length > 0) {
        const sortedProblems = [...problemImages].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
        )
        for (let pageIndex = 0; pageIndex < sortedProblems.length; pageIndex++) {
          const file = sortedProblems[pageIndex]
          const extensionMatch = file.name.match(/\.[a-z0-9]+$/i)
          const extension = extensionMatch ? extensionMatch[0] : '.webp'
          const fileName = `${user.id}/${saveBatchTimestamp}_problem_${pageIndex}${extension}`
          const { data, error } = await supabase.storage.from(QUESTION_IMAGES_BUCKET).upload(fileName, file)
          if (error) throw error
          problemPaths.push(data.path)
          if (pageIndex === 0) {
            const { data: pub } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(data.path)
            problemImageUrl = pub.publicUrl
          }
        }
      }

      let answerImageUrl: string | null = null
      const answerPaths: string[] = []

      if (answerImages.length > 0) {
        const sortedAnswers = [...answerImages].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
        )
        for (let pageIndex = 0; pageIndex < sortedAnswers.length; pageIndex++) {
          const file = sortedAnswers[pageIndex]
          const extensionMatch = file.name.match(/\.[a-z0-9]+$/i)
          const extension = extensionMatch ? extensionMatch[0] : '.webp'
          const fileName = `${user.id}/${saveBatchTimestamp}_answer_${pageIndex}${extension}`
          const { data, error } = await supabase.storage.from(QUESTION_IMAGES_BUCKET).upload(fileName, file)
          if (error) throw error
          answerPaths.push(data.path)
          if (pageIndex === 0) {
            const { data: pub } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(data.path)
            answerImageUrl = pub.publicUrl
          }
        }
      }

      const { error: dbError } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          subject,
          category,
          source,
          problem_url: problemImageUrl,
          problem_urls: problemPaths.length > 0 ? problemPaths : null,
          problem_text: problemText,
          answer_url: answerImageUrl,
          answer_urls: answerPaths.length > 0 ? answerPaths : null,
          answer_text: answerText,
        })

      if (dbError) throw dbError

      alert('오답 노트가 성공적으로 저장되었습니다.')
      navigate('/')
    } catch (error: any) {
      console.error('저장 실패:', error)
      alert(`저장 중 오류가 발생했습니다: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderActionBar = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border px-4 py-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
      <div className="max-w-[1240px] mx-auto flex items-center gap-4">
        {step === 1 ? (
          <>
            <Button variant="ghost" className="flex-1 h-14 font-extrabold rounded-2xl text-muted-foreground" onClick={() => navigate('/')}>취소</Button>
            <Button 
                className="flex-1 h-14 font-extrabold bg-foreground text-background hover:opacity-90 rounded-2xl shadow-lg" 
                onClick={handleExtractProblem} 
                disabled={problemImages.length === 0 || !subject}
            >
              AI 분석 시작하기 <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </>
        ) : step === 3 ? (
          <>
            <Button variant="outline" className="flex-1 h-14 font-extrabold rounded-2xl border-border bg-card text-foreground" onClick={() => setStep(2)}>이전 단계</Button>
            <Button 
              className="flex-1 h-14 font-extrabold bg-foreground text-background hover:opacity-90 rounded-2xl shadow-lg disabled:bg-muted disabled:text-muted-foreground" 
              onClick={handleExtractAnswer} disabled={answerImages.length === 0}
            >
              해설 분석 시작하기 <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="flex-1 h-14 font-extrabold rounded-2xl border-border bg-card text-foreground" onClick={() => setStep((prev) => (prev - 1) as Step)}>이전 단계</Button>
            {step === 2 ? (
               <Button className="flex-1 h-14 font-extrabold bg-foreground text-background hover:opacity-90 rounded-2xl shadow-lg" onClick={() => setStep(3)}>
                 다음 단계 (해답 입력) <ChevronRight className="ml-2 h-5 w-5" />
               </Button>
            ) : (
               <Button className="flex-1 h-14 font-extrabold bg-foreground text-background hover:opacity-90 rounded-2xl shadow-lg" onClick={handleSave} disabled={loading}>
                 오답 노트 최종 저장 <Save className="ml-2 h-5 w-5" />
               </Button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-background font-sans tracking-tight overflow-hidden transition-colors duration-300">
      <AppHeader />
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
          >
            <div className="h-16 w-16 rounded-full border-t-4 border-primary animate-spin mb-4" />
            <h2 className="text-xl font-bold text-foreground tracking-tight">{loadingText}</h2>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex-none bg-card/40 backdrop-blur-md z-40 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4">
           <div className="flex items-center justify-between px-2 overflow-x-auto">
             {([1, 2, 3, 4] as const).map((s) => (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all duration-300",
                      step === s ? "bg-foreground border-foreground text-background shadow-xl scale-110" : (step > s ? "bg-primary border-primary text-white" : "bg-card border-border text-muted-foreground")
                    )}>
                      {step > s ? <Check className="h-4 w-4" strokeWidth={4} /> : s}
                    </div>
                    <span className={cn("text-[8px] md:text-[9px] font-extrabold uppercase tracking-tight", step === s ? "text-foreground" : "text-muted-foreground")}>
                      {s === 1 ? 'Problem' : (s === 2 ? 'Verify' : (s === 3 ? 'Answer' : 'Master'))}
                    </span>
                  </div>
                  {s < 4 && <div className={cn("w-8 md:w-12 h-[2px] mx-2 md:mx-4 rounded-full", step > s ? "bg-primary" : "bg-border")} />}
                </div>
             ))}
           </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar pt-8 pb-32">
        <div className="max-w-[1240px] mx-auto px-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="border-border shadow-2xl rounded-3xl overflow-hidden bg-card">
                  <CardHeader className="border-b border-border p-8">
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                      <div className="h-2 w-8 bg-primary rounded-full" /> 문제 사진 및 정보 입력
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-10 p-8">
                    <ImageUploader 
                        label="문제 이미지 업로드 (멀티)" 
                        value={problemImages} 
                        onChange={(newFiles) => {
                            // 기존 개수보다 늘어났을 때만 새로운 파일에 대해 크롭 모달 오픈
                            if (newFiles.length > problemImages.length) {
                                const addedFile = newFiles[newFiles.length - 1]; // 마지막에 추가된 파일
                                handleOpenCrop(addedFile, 'problem', newFiles.length - 1);
                            }
                            setProblemImages(newFiles as File[]);
                        }} 
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <Label className="text-[13px] font-black text-muted-foreground">과목 <span className="text-red-500">*</span></Label>
                         <Input placeholder="수학, 영어 등" className="h-14 rounded-2xl border-border bg-muted/30 text-foreground" value={subject} onChange={(e) => setSubject(e.target.value)} />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[13px] font-black text-muted-foreground">분야/단원 (선택)</Label>
                         <Input placeholder="이차함수, 고등수학 등" className="h-14 rounded-2xl border-border bg-muted/30 text-foreground" value={category} onChange={(e) => setCategory(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[13px] font-black text-muted-foreground">출처 (선택)</Label>
                      <Input placeholder="예: 6월 모의고사 15번" className="h-14 rounded-2xl border-border bg-muted/30 text-foreground" value={source} onChange={(e) => setSource(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <Card className="border-border shadow-2xl rounded-3xl overflow-hidden bg-card">
                  <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-bold text-foreground">인식 결과 확인</CardTitle>
                    <div className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase">OCR Analysis Success</div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className={cn(
                      "flex flex-col lg:grid lg:h-[600px]",
                      problemText.includes('$') ? "lg:grid-cols-3" : "lg:grid-cols-2"
                    )}>
                      <div className="border-b lg:border-b-0 lg:border-r border-border p-6 md:p-8 flex flex-col items-center justify-center bg-muted/20 overflow-hidden min-h-[300px] lg:min-h-0">
                        <Label className="self-start mb-4 text-[11px] font-black text-primary uppercase tracking-widest">병합된 이미지 미리보기</Label>
                        {mergedProblemFile && <img src={URL.createObjectURL(mergedProblemFile)} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border" alt="Merged Problem" />}
                      </div>
                      <div className="border-b lg:border-b-0 lg:border-r border-border p-6 md:p-8 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
                        <Label className="mb-4 text-[11px] font-black text-muted-foreground uppercase tracking-widest">편집창 (텍스트)</Label>
                        <Textarea 
                          className="flex-1 min-h-[200px] lg:min-h-0 border-border bg-muted/10 resize-none rounded-2xl p-6 text-[15px] leading-relaxed text-foreground"
                          value={problemText} onChange={(e) => setProblemText(e.target.value)}
                        />
                      </div>
                      {problemText.includes('$') && (
                        <div className="p-8 flex flex-col overflow-hidden bg-muted/5">
                          <Label className="mb-4 text-[11px] font-black text-primary uppercase tracking-widest">미리보기 (수식)</Label>
                          <div className="flex-1 bg-card border border-border rounded-2xl p-8 overflow-y-auto custom-scrollbar text-foreground">
                            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: renderMath(problemText) }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="border-border shadow-2xl rounded-3xl overflow-hidden bg-card">
                  <CardHeader className="p-8 border-b border-border">
                    <CardTitle className="text-xl font-bold text-foreground">해설 등록 방식 선택</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <ImageUploader 
                      label="정답/풀이 이미지 업로드 (멀티)" 
                      value={answerImages} 
                      onChange={(newFiles) => {
                        if (newFiles.length > answerImages.length) {
                          const addedFile = newFiles[newFiles.length - 1];
                          handleOpenCrop(addedFile, 'answer', newFiles.length - 1);
                        }
                        setAnswerImages(newFiles as File[]);
                      }} 
                      aiLabel="AI 풀이 생성" aiDescription="본 문제를 기반으로 자동 생성" onAIAction={handleGenerateAIAnswer}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="border-border shadow-2xl rounded-3xl overflow-hidden bg-card">
                  <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-bold text-foreground">최종 마스터 뷰 확인</CardTitle>
                    {mergedAnswerFile && <div className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-tighter">Merged OCR Mode</div>}
                  </CardHeader>
                  <CardContent className="p-0 min-h-[400px]">
                    <AnimatePresence mode="wait">
                      {answerImages.length > 0 ? (
                        <motion.div 
                          key="with-img" 
                          className={cn(
                            "flex flex-col lg:grid lg:h-[600px]",
                            answerText.includes('$') ? "lg:grid-cols-3" : "lg:grid-cols-2"
                          )}
                        >
                          <div className="border-b lg:border-b-0 lg:border-r border-border p-6 md:p-8 flex flex-col items-center justify-center bg-muted/20 overflow-hidden min-h-[300px] lg:min-h-0">
                            <Label className="self-start mb-4 text-[11px] font-black text-primary uppercase tracking-widest">병합된 해설 이미지</Label>
                            {mergedAnswerFile && <img src={URL.createObjectURL(mergedAnswerFile)} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border" alt="Merged Answer" />}
                          </div>
                          <div className="border-b lg:border-b-0 lg:border-r border-border p-6 md:p-8 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
                            <Label className="mb-4 text-[11px] font-black text-muted-foreground uppercase tracking-widest">편집창 (텍스트)</Label>
                            <Textarea className="flex-1 min-h-[200px] lg:min-h-0 bg-muted/10 border-border rounded-2xl p-6 text-[15px] leading-relaxed resize-none text-foreground" value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
                          </div>
                          {answerText.includes('$') && (
                            <div className="p-6 md:p-8 flex flex-col overflow-hidden bg-muted/5 min-h-[300px] lg:min-h-0">
                              <Label className="mb-4 text-[11px] font-black text-primary uppercase tracking-widest">미리보기 (수식)</Label>
                              <div className="flex-1 bg-card border border-border rounded-2xl p-8 overflow-y-auto custom-scrollbar text-foreground">
                                 <div className="prose prose-slate dark:prose-invert max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: renderMath(answerText) }} />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div key="pure-ai" className="p-8 md:p-12 flex flex-col items-center">
                          <div className="w-full max-w-4xl space-y-8 h-full">
                            <div className="flex items-center justify-between">
                               <Label className="text-[12px] font-black text-primary tracking-widest flex items-center gap-2">
                                 <Sparkles className="h-5 w-5" /> MASTER SOLUTION PREVIEW (AI)
                               </Label>
                            </div>
                            <div className="bg-card border-2 border-primary/20 rounded-[2.5rem] p-4 md:p-10 shadow-2xl min-h-[300px] md:min-h-[400px] overflow-y-scroll custom-scrollbar text-foreground">
                               <div className="prose prose-slate dark:prose-invert max-w-none prose-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMath(answerText) }} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {croppingImage && (
          <ImageCropModal 
            image={croppingImage} 
            isOpen={isCropOpen} 
            onClose={() => setIsCropOpen(false)} 
            onCropComplete={handleCropComplete} 
          />
        )}
      </main>

      {renderActionBar()}
    </div>
  )
}
