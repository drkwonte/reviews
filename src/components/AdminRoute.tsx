import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminRoute() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-bold">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  // 세션이 없거나 관리자 권한이 없으면 돌려보냄
  if (!session || profile?.user_type !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
