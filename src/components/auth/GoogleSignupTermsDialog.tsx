import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TermsAgreement, { TermsState, isRequiredTermsAgreed } from './TermsAgreement'

interface GoogleSignupTermsDialogProps {
  /** 다이얼로그 표시 여부 */
  open: boolean
  /** 취소/닫기 */
  onClose: () => void
  /** 동의 완료 후 Google OAuth 진행 */
  onConfirm: (marketingAgreed: boolean) => void
  loading?: boolean
}

/**
 * Google 회원가입 전 약관 동의 다이얼로그
 * - 필수 약관을 먼저 읽어야 동의 체크 가능
 * - 필수 동의 완료 후 "Google로 계속하기" 버튼 활성화
 */
export default function GoogleSignupTermsDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
}: GoogleSignupTermsDialogProps) {
  const [terms, setTerms] = useState<TermsState>({
    all: false, service: false, privacy: false, marketing: false,
  })

  // 다이얼로그 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      // 닫힐 때 약관 상태 초기화
      setTerms({ all: false, service: false, privacy: false, marketing: false })
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const canProceed = isRequiredTermsAgreed(terms)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" aria-modal="true" role="dialog">
      {/* 배경 딤 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* 다이얼로그 본문 */}
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">서비스 이용 동의</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Google 계정으로 가입하기 전에 약관을 읽고 동의해 주세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 약관 동의 컴포넌트 */}
        <div className="overflow-y-auto px-6 py-5">
          <TermsAgreement
            onChange={setTerms}
            defaultExpanded={true}
          />

          {/* 안내 문구 */}
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            각 항목의 <strong>'보기'</strong>를 눌러 내용을 확인한 후 동의해 주세요.
            [필수] 항목에 모두 동의해야 가입이 가능합니다.
          </p>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
          <Button
            className="w-full"
            onClick={() => onConfirm(terms.marketing)}
            disabled={!canProceed || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Google로 이동 중...
              </span>
            ) : (
              <>
                {/* Google SVG */}
                <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google로 계속하기
              </>
            )}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose} disabled={loading}>
            취소
          </Button>
        </div>
      </div>
    </div>
  )
}
