import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import TermsModal from './TermsModal'
import {
  SERVICE_TERMS_TITLE, SERVICE_TERMS_DATE, SERVICE_TERMS_SECTIONS,
} from '@/data/terms/service'
import {
  PRIVACY_TERMS_TITLE, PRIVACY_TERMS_DATE, PRIVACY_TERMS_SECTIONS,
} from '@/data/terms/privacy'
import {
  MARKETING_TERMS_TITLE, MARKETING_TERMS_DATE, MARKETING_TERMS_SECTIONS,
} from '@/data/terms/marketing'

export interface TermsState {
  all: boolean
  service: boolean       // [필수] 서비스 이용약관
  privacy: boolean       // [필수] 개인정보 수집 및 이용 동의
  marketing: boolean     // [선택] 마케팅 정보 수신 동의
}

type TermsKey = 'service' | 'privacy' | 'marketing'
type ModalKey = TermsKey | null

interface TermsAgreementProps {
  onChange: (terms: TermsState) => void
  /** 처음부터 펼쳐놓을지 여부 (Google 가입 모달에서 사용) */
  defaultExpanded?: boolean
}

const TERMS_CONFIG = [
  {
    key: 'service' as TermsKey,
    required: true,
    label: '서비스 이용약관 동의',
    title: SERVICE_TERMS_TITLE,
    date: SERVICE_TERMS_DATE,
    sections: SERVICE_TERMS_SECTIONS,
  },
  {
    key: 'privacy' as TermsKey,
    required: true,
    label: '개인정보 수집 및 이용 동의',
    title: PRIVACY_TERMS_TITLE,
    date: PRIVACY_TERMS_DATE,
    sections: PRIVACY_TERMS_SECTIONS,
  },
  {
    key: 'marketing' as TermsKey,
    required: false,
    label: '마케팅 정보 수신 동의 (이메일, 앱 알림)',
    title: MARKETING_TERMS_TITLE,
    date: MARKETING_TERMS_DATE,
    sections: MARKETING_TERMS_SECTIONS,
  },
]

/** 필수 약관이 모두 동의되었는지 확인 */
export function isRequiredTermsAgreed(terms: TermsState): boolean {
  return terms.service && terms.privacy
}

/** 회원가입 약관 동의 컴포넌트 */
export default function TermsAgreement({ onChange, defaultExpanded = false }: TermsAgreementProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [terms, setTerms] = useState<TermsState>({
    all: false, service: false, privacy: false, marketing: false,
  })
  // 한 번이라도 "보기"로 읽은 항목 추적
  const [viewed, setViewed] = useState<Set<TermsKey>>(new Set())
  const [openModal, setOpenModal] = useState<ModalKey>(null)
  // 읽지 않고 체크 시도한 항목 (힌트 표시용)
  const [unreadWarning, setUnreadWarning] = useState<TermsKey | null>(null)
  // 전체 동의 순차 열람 큐: 비어있지 않으면 "순차 모드" 진행 중
  const [sequenceQueue, setSequenceQueue] = useState<TermsKey[]>([])
  // 전체 동의 버튼으로 순차 모드가 시작됐는지 여부
  const [inSequenceAll, setInSequenceAll] = useState(false)

  const update = (next: TermsState) => {
    setTerms(next)
    onChange(next)
  }

  const handleAll = (checked: boolean) => {
    if (!checked) {
      // 전체 해제
      update({ all: false, service: false, privacy: false, marketing: false })
      return
    }

    // 미열람 필수 항목 목록
    const unreadRequired = TERMS_CONFIG
      .filter(t => t.required && !viewed.has(t.key))
      .map(t => t.key)

    if (unreadRequired.length > 0) {
      // 순차 모드 시작: 첫 번째 열고, 나머지는 큐에 넣기
      if (!expanded) setExpanded(true)
      setInSequenceAll(true)               // 순차 모드 플래그 ON
      setSequenceQueue(unreadRequired.slice(1))
      setOpenModal(unreadRequired[0])
      return
    }

    // 이미 모두 열람 완료 → 바로 전체 체크
    update({ all: true, service: true, privacy: true, marketing: true })
    if (!expanded) setExpanded(true)
  }

  const handleItemCheck = (key: TermsKey, checked: boolean) => {
    const config = TERMS_CONFIG.find(t => t.key === key)!
    // 필수 항목은 열람 후에만 체크 가능
    if (config.required && !viewed.has(key)) {
      setUnreadWarning(key)
      setOpenModal(key) // 자동으로 약관 열기
      return
    }
    setUnreadWarning(null)
    const next = { ...terms, [key]: checked }
    next.all = next.service && next.privacy && next.marketing
    update(next)
  }

  const handleOpenModal = (key: TermsKey) => {
    setUnreadWarning(null)
    setSequenceQueue([])    // 개별 "보기" 클릭이면 순차 모드 해제
    setInSequenceAll(false) // 순차 모드 플래그 OFF
    setOpenModal(key)
  }

  /**
   * 모달 닫힐 때:
   * 1. 현재 항목 열람 완료 표시
   * 2. 순차 모드면 → 다음 항목 자동 오픈
   * 3. 순차 모드 종료 시 → 전체 체크
   */
  const handleCloseModal = () => {
    if (!openModal) return

    const newViewed = new Set([...viewed, openModal])
    setViewed(newViewed)

    if (sequenceQueue.length > 0) {
      // 순차 모드: 다음 약관 자동으로 열기
      const [next, ...rest] = sequenceQueue
      setSequenceQueue(rest)
      setOpenModal(next)
    } else {
      // 순차 모드 종료
      setOpenModal(null)

      // "전체 동의" 순차 모드로 인해 모든 필수 항목이 열람됐으면 전체 체크
      // (개별 보기로 닫은 경우는 자동 체크하지 않음)
      // sequenceQueue가 비어있고, 이전에 sequenceQueue에 항목이 있었다면 = 순차 완료
      // → 이를 구분하기 위해 현재 terms와 newViewed를 비교
      const allRequiredViewed = TERMS_CONFIG
        .filter(t => t.required)
        .every(t => newViewed.has(t.key))

      // 순차 모드 완료 판별: openModal이 마지막 필수 항목이고 전체가 열람됨
      // handleAll이 sequenceQueue를 세팅했을 때만 자동 체크 (개별 보기는 제외)
      // → inSequenceAll 플래그로 추적
      if (allRequiredViewed && inSequenceAll) {
        update({ all: true, service: true, privacy: true, marketing: true })
        setInSequenceAll(false)
      }
    }
  }

  const activeModal = TERMS_CONFIG.find(t => t.key === openModal)

  return (
    <>
      <div className="rounded-md border border-input text-sm">
        {/* ── 전체 동의 헤더 ── */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="terms-all"
              checked={terms.all}
              onCheckedChange={(v: CheckedState) => handleAll(Boolean(v))}
            />
            <Label htmlFor="terms-all" className="cursor-pointer font-semibold text-foreground">
              약관 전체 동의
            </Label>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={expanded ? '약관 목록 접기' : '약관 목록 펼치기'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* ── 개별 항목 ── */}
        {expanded && (
          <div className="border-t border-input divide-y divide-input">
            {TERMS_CONFIG.map(item => {
              const isViewed = viewed.has(item.key)
              const isUnread = item.required && !isViewed
              const showWarning = unreadWarning === item.key

              return (
                <div key={item.key} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 미열람 필수 항목은 체크박스 시각적으로 비활성 */}
                      <div className="relative" title={isUnread ? '먼저 약관을 읽어주세요' : undefined}>
                        <Checkbox
                          id={`terms-${item.key}`}
                          checked={terms[item.key]}
                          disabled={false} // 클릭은 허용하되 handleItemCheck에서 제어
                          onCheckedChange={(v: CheckedState) => handleItemCheck(item.key, Boolean(v))}
                          className={isUnread ? 'opacity-40' : ''}
                        />
                      </div>
                      <Label
                        htmlFor={`terms-${item.key}`}
                        className="cursor-pointer text-muted-foreground leading-snug select-none"
                      >
                        <span className={item.required ? 'text-foreground font-medium' : ''}>
                          [{item.required ? '필수' : '선택'}]
                        </span>{' '}
                        {item.label}
                      </Label>
                    </div>

                    {/* 보기 버튼 — 열람 완료 시 초록 체크 표시 */}
                    <button
                      type="button"
                      onClick={() => handleOpenModal(item.key)}
                      className={`text-xs shrink-0 whitespace-nowrap flex items-center gap-1 transition-colors ${
                        isViewed
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground underline underline-offset-2 hover:text-foreground'
                      }`}
                    >
                      {isViewed && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isViewed ? '읽음' : '보기'}
                    </button>
                  </div>

                  {/* 필수 항목 미열람 경고 */}
                  {showWarning && (
                    <p className="mt-1.5 ml-7 text-xs text-primary/80">
                      ↑ 약관을 먼저 읽어주세요 (보기 클릭)
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 약관 모달 */}
      {activeModal && (
        <TermsModal
          open={true}
          onClose={handleCloseModal}
          title={activeModal.title}
          date={activeModal.date}
          sections={activeModal.sections}
        />
      )}
    </>
  )
}
