import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/app/lib/auth/auth-service'
import { LoginRequest } from '@/app/lib/auth/types'
import { authRateLimit, withRateLimit } from '@/app/lib/rate-limit'

export async function POST(request: NextRequest) {
  return withRateLimit(request, authRateLimit, async () => {
    try {
      const body: LoginRequest = await request.json()

      if (!body.email || !body.password) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email and password are required',
            timestamp: new Date(),
          },
          { status: 400 }
        )
      }

      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0] : 'unknown'

      const { user, token } = await authService.login(body, ip)

      return NextResponse.json({
        success: true,
        data: {
          user,
          token,
        },
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('Login error:', error)

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Login failed',
          timestamp: new Date(),
        },
        { status: 401 }
      )
    }
  })
}
