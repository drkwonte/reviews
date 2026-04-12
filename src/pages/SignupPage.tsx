import { Link } from 'react-router-dom'
import AuthLayout from '@/components/auth/AuthLayout'
import GoogleSignupTermsDialog from '@/components/auth/GoogleSignupTermsDialog'
import TermsAgreement from '@/components/auth/TermsAgreement'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSignupForm } from '@/hooks/useAuthForm'

export default function SignupPage() {
  const {
    name, setName,
    email, setEmail,
    password, setPassword,
    setTerms,
    error, loading,
    showGoogleTerms, setShowGoogleTerms,
    handleSignup,
    handleGoogleButtonClick,
    handleGoogleTermsConfirm,
  } = useSignupForm()

  return (
    <>
      <AuthLayout
        topRight={
          <Link
            to="/login"
            id="link-login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            로그인
          </Link>
        }
      >
        {/* 헤딩 */}
        <div className="flex flex-col space-y-2 text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">계정 만들기</h1>
          <p className="text-sm text-muted-foreground">
            아래 정보를 입력하여 계정을 만드세요
          </p>
        </div>

        <div className="grid gap-6">
          {/* Google 가입 — 클릭 시 약관 다이얼로그 먼저 */}
          <Button
            id="btn-google-signup"
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleButtonClick}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google로 시작하기
          </Button>

          {/* 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">또는 이메일로 가입</span>
            </div>
          </div>

          {/* 이메일 가입 폼 */}
          <form
            onSubmit={handleSignup}
            autoComplete="off"
            method="post"
            action="#"
          >
            <div className="grid gap-4">
              {error && (
                <p id="signup-error" className="text-sm text-destructive text-center">
                  {error}
                </p>
              )}

              <div className="grid gap-1">
                <Label htmlFor="input-name">이름</Label>
                <Input
                  id="input-name"
                  name="ep1-signup-name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  data-form-type="other"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="input-email">이메일</Label>
                <Input
                  id="input-email"
                  name="ep1-signup-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore
                  data-form-type="other"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="input-password">비밀번호</Label>
                <Input
                  id="input-password"
                  name="ep1-signup-password"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  data-form-type="other"
                  disabled={loading}
                />
              </div>

              {/* 약관 동의 (이메일 가입용) */}
              <TermsAgreement onChange={setTerms} />

              <Button id="btn-signup-submit" type="submit" disabled={loading}>
                {loading ? '가입 중...' : '회원가입'}
              </Button>
            </div>
          </form>
        </div>
      </AuthLayout>

      {/* Google 가입 전 약관 동의 다이얼로그 */}
      <GoogleSignupTermsDialog
        open={showGoogleTerms}
        onClose={() => setShowGoogleTerms(false)}
        onConfirm={handleGoogleTermsConfirm}
        loading={loading}
      />
    </>
  )
}
