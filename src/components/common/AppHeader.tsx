import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      // profiles 대신 유료화 전용 뷰인 user_plan_status를 참조합니다.
      const { data } = await supabase.from('user_plan_status').select('*').eq('user_id', user?.id).single()
      if (data) setProfile(data)
    } catch (e) {}
  }

  const isDashboard = location.pathname === '/dashboard'
  const isNotes = location.pathname.startsWith('/notes')

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container max-w-6xl px-4 h-20 flex items-center justify-between mx-auto flex-shrink-0">
        <div className="flex items-center gap-1 md:gap-4 flex-1">
          <img 
            src="/nextime_logo_rectangle_200.png" 
            alt="nextime" 
            className="h-7 sm:h-8 md:h-10 w-auto object-contain cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0" 
            onClick={() => navigate('/dashboard')} 
          />
          
          <div className="w-[1px] h-6 bg-border mx-1 md:mx-2 hidden sm:block"></div>
          
          <nav className="flex items-center gap-0.5 sm:gap-1 md:gap-3 ml-1 sm:ml-2 md:ml-4">
            <button 
              onClick={() => navigate('/dashboard')} 
              className={cn(
                "flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-4 py-2 rounded-2xl text-sm font-bold transition-all group",
                isDashboard 
                  ? "text-primary bg-primary/10 shadow-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
              title="대시보드"
            >
              <LayoutDashboard size={18} className={cn("transition-transform group-hover:scale-110", isDashboard ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
              <span className="hidden sm:inline">대시보드</span>
            </button>
            <button 
              onClick={() => navigate('/notes')} 
              className={cn(
                "flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-4 py-2 rounded-2xl text-sm font-bold transition-all group",
                isNotes 
                  ? "text-primary bg-primary/10 shadow-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
              title="오답노트"
            >
              <BookOpen size={18} className={cn("transition-transform group-hover:scale-110", isNotes ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
              <span className="hidden sm:inline">오답노트</span>
            </button>

            {/* 관리자 전용 메뉴 */}
            {profile?.user_type === 'admin' && (
              <button 
                onClick={() => navigate('/admin')} 
                className={cn(
                  "flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-4 py-2 rounded-2xl text-sm font-bold transition-all group",
                  location.pathname === '/admin'
                    ? "text-rose-500 bg-rose-500/10 shadow-sm" 
                    : "text-muted-foreground hover:text-rose-500 hover:bg-muted"
                )}
                title="관리자 전용"
              >
                <ShieldCheck size={18} className={cn("transition-transform group-hover:scale-110", location.pathname === '/admin' ? "text-rose-500" : "text-muted-foreground group-hover:text-rose-500")} />
                <span className="hidden lg:inline text-rose-500">Admin</span>
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold text-foreground tracking-tight">{user?.email?.split('@')[0]} 님</span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-1">{profile?.current_plan || 'BASIC'}</span>
          </div>
          <div className="w-[1px] h-8 bg-border mx-1 hidden sm:block"></div>
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => { if(confirm('로그아웃 하시겠습니까?')) { await signOut(); navigate('/login'); }}} 
            className="font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 px-3 md:px-4 h-10 rounded-xl transition-all"
          >
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  )
}
