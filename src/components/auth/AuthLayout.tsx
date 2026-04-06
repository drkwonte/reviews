import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  /** 우측 폼 위 작은 안내 텍스트 (예: "이미 계정이 있으신가요? 로그인") */
  topRight?: ReactNode
}

/**
 * 인증 페이지 공통 2패널 레이아웃
 * - 좌측: 브랜드 패널 (slate 배경, 로고 + 인용구)
 * - 우측: 폼 영역
 */
export default function AuthLayout({ children, topRight }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── 좌측 브랜드 패널 ── */}
      <div className="relative hidden lg:flex flex-col bg-muted p-10 text-foreground">
        {/* 로고: 정식 이미지 로고로 교체 */}
        <div className="flex items-center">
          <img 
            src="/nextime_logo_rectangle_200.png" 
            alt="nextime" 
            className="h-8 md:h-10 brightness-[0.7] contrast-[1.2]" 
          />
        </div>

        {/* 하단 인용구 */}
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;실패를 두려워하지 마세요.
              nextime과 함께 오답노트를 체계적으로 관리하세요.&rdquo;
            </p>
            <footer className="text-sm font-medium text-muted-foreground">nextime 팀</footer>
          </blockquote>
        </div>
      </div>

      {/* ── 우측 폼 패널 ── */}
      <div className="flex flex-col">
        {/* 우측 상단 (링크 등) */}
        {topRight && (
          <div className="flex justify-end p-8">
            {topRight}
          </div>
        )}

        {/* 폼 중앙 정렬 */}
        <div className="flex flex-1 items-center justify-center px-8 py-12 lg:py-8">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
