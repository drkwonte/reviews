import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export default function AdminRoute() {
  const { session, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsAdmin(session?.user?.id)

  if (authLoading || (session && adminLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-bold">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!session || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
