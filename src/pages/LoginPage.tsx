import { Link } from 'react-router-dom'
import AuthLayout from '@/components/auth/AuthLayout'
import SocialLoginButton from '@/components/auth/SocialLoginButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useLoginForm } from '@/hooks/useAuthForm'

export default function LoginPage() {
  const { email, setEmail, password, setPassword, error, loading, handleEmailLogin, handleGoogleLogin } = useLoginForm()

  return (
    <AuthLayout
      topRight={
        <Link
          to="/signup"
          id="link-signup"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          회원가입
        </Link>
      }
    >
      {/* 헤딩 */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <img src="/nextime_logo_rectangle_200.png" alt="nextime" className="h-16 w-auto object-contain mb-2" />
        <p className="text-slate-400 font-medium">실패에서 배우고, 다음을 준비하는 시간</p>
      </div>

      <div className="grid gap-6">
        {/* 이메일 폼 */}
        <form
          onSubmit={handleEmailLogin}
          autoComplete="off"
          method="post"
          action="#"
        >
          <div className="grid gap-4">
            {error && (
              <p id="login-error" className="text-sm text-destructive text-center">
                {error}
              </p>
            )}
            <div className="grid gap-1">
              <Label htmlFor="input-email" className="sr-only">이메일</Label>
              <Input
                id="input-email"
                name="ep1-login-email"
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
              <Label htmlFor="input-password" className="sr-only">비밀번호</Label>
              <Input
                id="input-password"
                name="ep1-login-password"
                type="password"
                placeholder="비밀번호"
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
            <Button id="btn-email-login" type="submit" disabled={loading}>
              {loading ? '로그인 중...' : '이메일로 로그인'}
            </Button>
          </div>
        </form>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">또는</span>
          </div>
        </div>

        {/* Google 로그인 */}
        <SocialLoginButton onClick={handleGoogleLogin} loading={loading} label="Google로 로그인" />

        {/* 안내 문구 */}
        <p className="px-6 text-center text-xs text-muted-foreground leading-relaxed">
          로그인하면 nextime의{' '}
          <a href="/terms/service" className="underline underline-offset-4 hover:text-foreground">
            서비스 이용약관
          </a>
          {' '}및{' '}
          <a href="/terms/privacy" className="underline underline-offset-4 hover:text-foreground">
            개인정보처리방침
          </a>
          에 동의하게 됩니다.
        </p>
      </div>
    </AuthLayout>
  )
}
