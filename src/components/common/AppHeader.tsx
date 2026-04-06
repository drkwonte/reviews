import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen } from 'lucide-react'
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
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (data) setProfile(data)
    } catch (e) {}
  }

  const isDashboard = location.pathname === '/dashboard'
  const isNotes = location.pathname.startsWith('/notes')

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container max-w-6xl px-4 h-20 flex items-center justify-between mx-auto flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <img 
            src="/nextime_logo_rectangle_200.png" 
            alt="nextime" 
            className="h-8 md:h-10 w-auto object-contain cursor-pointer transition-transform hover:scale-105 active:scale-95" 
            onClick={() => navigate('/dashboard')} 
          />
          
          <div className="w-[1px] h-6 bg-border mx-1 md:mx-2 hidden sm:block"></div>
          
          <nav className="flex items-center gap-1 md:gap-3 ml-2 md:ml-4">
            <button 
              onClick={() => navigate('/dashboard')} 
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all group",
                isDashboard 
                  ? "text-primary bg-primary/10 shadow-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
            >
              <LayoutDashboard size={18} className={cn("transition-transform group-hover:scale-110", isDashboard ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
              <span>대시보드</span>
            </button>
            <button 
              onClick={() => navigate('/notes')} 
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all group",
                isNotes 
                  ? "text-primary bg-primary/10 shadow-sm" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              )}
            >
              <BookOpen size={18} className={cn("transition-transform group-hover:scale-110", isNotes ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
              <span>오답노트</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold text-foreground tracking-tight">{user?.email?.split('@')[0]} 님</span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-1">{profile?.plan || 'BASIC'}</span>
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
