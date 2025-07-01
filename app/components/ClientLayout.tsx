'use client'

import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/app/contexts/AuthContext'
import { Navigation } from './Navigation'
import { ProtectedRoute } from './ProtectedRoute'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  return (
    <AuthProvider>
      <ProtectedRoute>
        {!isLoginPage && <Navigation />}
        {children}
      </ProtectedRoute>
    </AuthProvider>
  )
}
