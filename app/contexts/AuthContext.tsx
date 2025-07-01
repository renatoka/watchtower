'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/app/lib/auth/types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const validateAuth = async () => {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('user')

      if (storedToken && storedUser) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          })

          if (res.ok) {
            const data = await res.json()
            setToken(storedToken)
            setUser(data.data)
          } else {
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user')
          }
        } catch (error) {
          console.error('Auth validation error:', error)
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
        }
      }

      setIsLoading(false)
    }

    validateAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Login failed')
    }

    localStorage.setItem('auth_token', data.data.token)
    localStorage.setItem('user', JSON.stringify(data.data.user))

    setToken(data.data.token)
    setUser(data.data.user)

    router.push('/realtime')
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
