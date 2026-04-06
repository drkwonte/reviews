import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TermsSection {
  title: string
  content?: string | null
  items?: string[]
}

interface TermsModalProps {
  /** 모달 표시 여부 */
  open: boolean
  /** 모달 닫기 핸들러 */
  onClose: () => void
  /** 약관 제목 */
  title: string
  /** 시행일 */
  date?: string
  /** 약관 섹션 배열 */
  sections: TermsSection[]
}

/**
 * 약관 내용을 표시하는 모달
 * - 외부 클릭 또는 ESC 키로 닫기 가능
 * - 내용이 길면 내부 스크롤
 */
export default function TermsModal({ open, onClose, title, date, sections }: TermsModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    /* ── 오버레이 ── */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="terms-modal-title"
    >
      {/* 배경 딤 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 본문 */}
      <div className="relative z-10 w-full max-w-lg bg-background rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 id="terms-modal-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {date && (
              <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 내용 (스크롤) */}
        <div className="overflow-y-auto px-6 py-5 text-sm text-foreground leading-relaxed space-y-5">
          {sections.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold mb-1.5">{section.title}</h3>
              {section.content && (
                <p className="text-muted-foreground">{section.content}</p>
              )}
              {section.items && (
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  {section.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <Button className="w-full" onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
