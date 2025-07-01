import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/app/lib/auth/middleware'
import { authService } from '@/app/lib/auth/auth-service'
import { CreateUserRequest } from '@/app/lib/auth/types'

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const users = await authService.getAllUsers()

      return NextResponse.json({
        success: true,
        data: users,
        timestamp: new Date(),
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch users',
          timestamp: new Date(),
        },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const body: CreateUserRequest = await request.json()

      if (!body.email || !body.password || !body.name) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email, password, and name are required',
            timestamp: new Date(),
          },
          { status: 400 }
        )
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid email format',
            timestamp: new Date(),
          },
          { status: 400 }
        )
      }

      if (body.password.length < 8) {
        return NextResponse.json(
          {
            success: false,
            error: 'Password must be at least 8 characters long',
            timestamp: new Date(),
          },
          { status: 400 }
        )
      }

      const user = await authService.createUser(body)

      return NextResponse.json(
        {
          success: true,
          data: user,
          timestamp: new Date(),
        },
        { status: 201 }
      )
    } catch (error) {
      console.error('Create user error:', error)

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to create user',
          timestamp: new Date(),
        },
        { status: 400 }
      )
    }
  })
}
