import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * DB의 admin_users + public.is_admin()과 일치하는 관리자 여부.
 * profiles.user_type만으로는 admin_users와 어긋날 수 있어 RPC를 사용합니다.
 */
export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.error('is_admin RPC failed:', error)
        setIsAdmin(false)
      } else {
        setIsAdmin(Boolean(data))
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { isAdmin, loading }
}
