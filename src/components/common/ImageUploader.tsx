import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, Camera, Image as ImageIcon, Loader2, Sparkles, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import imageCompression from 'browser-image-compression'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  label: string
  value?: File[] | null
  onChange: (files: File[]) => void
  aiLabel?: string
  aiDescription?: string
  onAIAction?: () => void
  disabled?: boolean
  className?: string
}

type ViewMode = 'initial' | 'list' | 'preview'

export function ImageUploader({
  label,
  value = [],
  onChange,
  aiLabel,
  aiDescription,
  onAIAction,
  disabled,
  className,
}: ImageUploaderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('initial')
  const [previews, setPreviews] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // 부모의 value(File[]) 변화에 맞춰 blob URL 프리뷰 생성/동기화
  useEffect(() => {
    if (!value || value.length === 0) {
      previews.forEach(p => URL.revokeObjectURL(p));
      setPreviews([]);
      setViewMode('initial');
      return;
    }

    // 이미 프리뷰가 있고 개수가 같다면 동기화 스킵 (무한 루프 방지)
    if (value.length === previews.length) return;

    // 새로운 프리뷰 생성
    const newPreviews = value.map(file => URL.createObjectURL(file));
    setPreviews(newPreviews);
    setViewMode('list');

    return () => {
      newPreviews.forEach(p => URL.revokeObjectURL(p));
    };
  }, [value]);

  const processFiles = async (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    const validImages = filesArray.filter(f => f.type.startsWith('image/'));
    
    if (validImages.length === 0) return;
    
    setIsProcessing(true);
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true };
      const compressedFiles = await Promise.all(
        validImages.map(f => imageCompression(f, options))
      );
      
      const currentFiles = value || [];
      const combined = [...currentFiles, ...compressedFiles];
      
      // 파일명 숫자 순서대로 자동 정렬 (Natural Sort)
      const sorted = combined.sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      
      onChange(sorted);
    } catch (error) {
       console.error('이미지 처리 실패:', error);
       const combined = [...(value || []), ...validImages];
       const sorted = combined.sort((a, b) => 
         a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
       );
       onChange(sorted);
    } finally {
       setIsProcessing(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }

  const handleRemove = (index: number) => {
    if (!value) return;
    const newFiles = [...value];
    newFiles.splice(index, 1);
    
    // 삭제 후에도 한 번 더 정렬 보장
    const sorted = newFiles.sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    onChange(sorted);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    if (disabled || !e.dataTransfer.files) return;
    processFiles(e.dataTransfer.files);
  }, [disabled, value]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
  }, []);

  return (
    <div className={cn('space-y-4 w-full', className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <label className="text-sm font-black text-slate-800 tracking-tight uppercase">{label}</label>
          <span className="text-[10px] font-bold text-slate-400">여러 장의 이미지를 순서대로 업로드할 수 있습니다</span>
        </div>
        {value && value.length > 0 && (
          <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20 uppercase tracking-widest shadow-sm">
            Total {value.length} Photos
          </span>
        )}
      </div>

      <Card
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative overflow-hidden border-2 border-dashed transition-all duration-300 min-h-[200px] flex flex-col justify-center items-center rounded-[32px]',
          isDragOver ? 'border-primary/50 bg-primary/5 scale-[1.002] shadow-xl' : 'border-slate-100 bg-white/40',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <CardContent className="p-0 w-full h-full">
          <AnimatePresence mode="wait">
            {/* 1단계: 초기 화면 */}
            {viewMode === 'initial' && (
              <motion.div
                key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-wrap gap-4 p-10 w-full justify-center"
              >
                <div 
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 bg-white border border-slate-100 rounded-[28px] w-36 h-36 shadow-sm hover:border-slate-900 hover:shadow-2xl transition-all cursor-pointer group active:scale-95"
                >
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:scale-110 transition-transform"><Camera className="h-7 w-7" /></div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">카메라</span>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 bg-white border border-slate-100 rounded-[28px] w-36 h-36 shadow-sm hover:border-slate-900 hover:shadow-2xl transition-all cursor-pointer group active:scale-95"
                >
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:scale-110 transition-transform"><ImageIcon className="h-7 w-7" /></div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest">갤러리</span>
                </div>

                {onAIAction && (
                  <div 
                    onClick={onAIAction}
                    className="flex flex-col items-center justify-center gap-3 bg-white border border-slate-100 rounded-[28px] w-36 h-36 shadow-sm hover:border-primary hover:shadow-2xl transition-all cursor-pointer group active:scale-95"
                  >
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary group-hover:scale-110 transition-transform group-hover:rotate-12"><Sparkles className="h-7 w-7" /></div>
                    <div className="flex flex-col items-center">
                       <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{aiLabel || 'AI GENERATE'}</span>
                       {aiDescription && <span className="text-[9px] text-slate-400 font-bold mt-0.5">{aiDescription}</span>}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 2단계: 이미지 리스트 (갤러리 스타일) */}
            {viewMode === 'list' && (
              <motion.div 
                key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-8 w-full flex flex-col gap-6"
              >
                {/* 썸네일 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {previews.map((src, i) => (
                    <motion.div 
                      key={src} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className="group relative aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-slate-100 cursor-zoom-in"
                    >
                      <img src={src} className="w-full h-full object-cover" alt={`p-${i}`} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2">
                         <span className="text-white text-[10px] font-black uppercase tracking-widest bg-slate-900/40 px-3 py-1 rounded-full border border-white/20">Photo {i+1}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                           className="bg-white/20 hover:bg-primary text-white p-3 rounded-2xl transition-all shadow-2xl backdrop-blur-md"
                         >
                           <Trash2 size={20} strokeWidth={2.5} />
                         </button>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* 사진 추가 버튼 */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-primary transition-all cursor-pointer group text-slate-400 hover:text-primary shadow-sm"
                  >
                     <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                     <span className="text-[10px] font-black uppercase tracking-widest">사진 추가</span>
                  </div>
                </div>

                {isProcessing && (
                  <div className="flex items-center justify-center gap-3 bg-slate-900 text-white/90 px-6 py-4 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-5">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
                    <span className="text-xs font-black uppercase tracking-widest">사진 최적화 처리 중...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={disabled} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" disabled={disabled} />
      </Card>

      {/* 드래그 오버 레이어 */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-primary/90 backdrop-blur-sm flex items-center justify-center pointer-events-none rounded-[32px]"
          >
            <div className="flex flex-col items-center gap-4 animate-pulse">
               <div className="bg-white p-5 rounded-full text-primary shadow-2xl"><Upload size={40} strokeWidth={3} /></div>
               <span className="text-xl font-black text-white uppercase tracking-tighter">여기에 이미지를 놓으세요!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
