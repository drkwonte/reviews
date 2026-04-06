import { AppHeader } from '@/components/common/AppHeader'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <AppHeader />
      <main className="container max-w-6xl px-4 py-20 mx-auto">
        <div className="flex flex-col items-center justify-center space-y-6 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mb-2">
            <span className="text-4xl font-black">S</span>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase whitespace-pre-wrap">Settings</h1>
          <p className="text-muted-foreground font-bold tracking-tight max-w-md">
            사용자 맞춤형 환경 설정 기능은 현재 고도화 중입니다. 곧 브랜드 컬러(#A98E70)와 어우러진 최상의 프리미엄 경험을 제공해 드리겠습니다.
          </p>
        </div>
      </main>
    </div>
  )
}
