import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TermsState, isRequiredTermsAgreed } from '@/components/auth/TermsAgreement'

/** 로그인 폼 훅 */
export function useLoginForm() {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google 로그인에 실패했습니다.')
    }
  }

  return { email, setEmail, password, setPassword, error, loading, handleEmailLogin, handleGoogleLogin }
}

/** 회원가입 폼 훅 */
export function useSignupForm() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState<TermsState>({
    all: false, service: false, privacy: false, marketing: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Google 가입 약관 동의 다이얼로그 표시 여부
  const [showGoogleTerms, setShowGoogleTerms] = useState(false)

  /** 이메일 회원가입 */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (!isRequiredTermsAgreed(terms)) {
      setError('필수 약관에 동의해 주세요.')
      return
    }
    setLoading(true)
    try {
      await signUpWithEmail(email, password, name, terms.marketing)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** Google 버튼 클릭 → 약관 다이얼로그 열기 */
  const handleGoogleButtonClick = () => {
    setError('')
    setShowGoogleTerms(true)
  }

  /**
   * 약관 다이얼로그에서 "Google로 계속하기" 확인
   * @param marketingAgreed - [선택] 마케팅 수신 동의 여부
   */
  const handleGoogleTermsConfirm = async (marketingAgreed: boolean) => {
    setLoading(true)
    try {
      // marketing_agreed 값을 세션 스토리지에 임시 저장
      // (OAuth 콜백 후 AuthContext에서 처리)
      sessionStorage.setItem('signup_marketing_agreed', String(marketingAgreed))
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google 가입에 실패했습니다.')
      setShowGoogleTerms(false)
    } finally {
      setLoading(false)
    }
  }

  return {
    name, setName,
    email, setEmail,
    password, setPassword,
    terms, setTerms,
    error, loading,
    showGoogleTerms, setShowGoogleTerms,
    handleSignup,
    handleGoogleButtonClick,
    handleGoogleTermsConfirm,
  }
}
