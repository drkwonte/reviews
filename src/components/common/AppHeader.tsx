import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ShieldCheck, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile: authProfile, signOut } = useAuth()
  const { isAdmin: hasAdminAccess, loading: adminRoleLoading } = useIsAdmin(user?.id)
  const [planInfo, setPlanInfo] = useState<any>(null)

  useEffect(() => {
    if (user) {
      fetchPlanInfo()
    }
  }, [user])

  const fetchPlanInfo = async () => {
    try {
      // profiles 대신 유료화 전용 뷰인 user_plan_status를 참조합니다.
      const { data } = await supabase.from('user_plan_status').select('*').eq('user_id', user?.id).single()
      if (data) setPlanInfo(data)
    } catch (e) {
      console.error('Plan info fetch failed:', e)
    }
  }

  const isDashboard = location.pathname === '/dashboard'
  const isNotes = location.pathname.startsWith('/notes')
  const isAccount = location.pathname === '/settings'
  const isAdminRoute = location.pathname === '/admin'

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50 transition-all duration-300">
      <div className="container max-w-6xl px-4 h-20 flex items-center justify-between mx-auto">
        <div className="flex items-center gap-1 md:gap-4 flex-1">
          <img 
            src="/nextime_logo_rectangle_200.png" 
            alt="nextime" 
            className="h-7 sm:h-8 md:h-10 w-auto object-contain cursor-pointer transition-transform hover:scale-105 active:scale-95 flex-shrink-0" 
            onClick={() => navigate('/dashboard')} 
          />
          
          <div className="w-[1px] h-6 bg-border mx-1 md:mx-2 hidden sm:block"></div>
          
          <nav className="flex items-center gap-0.5 sm:gap-1 md:gap-2 lg:gap-3 ml-1 sm:ml-2">
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
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={cn(
                'flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-4 py-2 rounded-2xl text-sm font-bold transition-all group',
                isAccount
                  ? 'text-primary bg-primary/10 shadow-sm'
                  : 'text-muted-foreground hover:text-primary hover:bg-muted',
              )}
              title="내 계정"
            >
              <UserCircle
                size={18}
                className={cn(
                  'transition-transform group-hover:scale-110',
                  isAccount ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
                )}
              />
              <span className="hidden sm:inline">내 계정</span>
            </button>

            {/* 관리자 전용 비밀 메뉴 - Rose 색상으로 강조 */}
            {user && !adminRoleLoading && hasAdminAccess && (
              <button 
                onClick={() => navigate('/admin')} 
                className={cn(
                  "flex items-center gap-1.5 md:gap-2 px-2.5 sm:px-4 py-2 rounded-2xl text-sm font-extrabold transition-all group animate-in fade-in slide-in-from-left-2 duration-500",
                  isAdminRoute
                    ? "text-rose-500 bg-rose-500/10 shadow-inner" 
                    : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5"
                )}
                title="시스템 관리 사령실"
              >
                <ShieldCheck size={18} className={cn("transition-transform group-hover:scale-110", isAdminRoute ? "text-rose-500" : "text-muted-foreground group-hover:text-rose-500")} />
                <span className={cn("hidden sm:inline transition-colors", isAdminRoute ? "text-rose-500" : "group-hover:text-rose-500")}>Admin</span>
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold text-foreground tracking-tight whitespace-nowrap">{authProfile?.name || user?.email?.split('@')[0]} 님</span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-1 shadow-sm px-1 py-0.5 rounded bg-primary/5">
              {planInfo?.current_plan || 'BASIC'}
            </span>
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
