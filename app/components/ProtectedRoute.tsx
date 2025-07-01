'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

const PUBLIC_ROUTES = ['/login', '/api', '/status']

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        pathname.startsWith(route)
      )
      if (!isPublicRoute) {
        router.push('/login')
      }
    }

    if (user && pathname === '/login') {
      router.push('/realtime')
    }
  }, [user, isLoading, pathname, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  if (!user && !isPublicRoute) {
    return null
  }

  return <>{children}</>
}
