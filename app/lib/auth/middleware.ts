import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeader } from './jwt'
import { authService } from './auth-service'
import { User } from './types'

export interface AuthenticatedRequest extends NextRequest {
  user?: User
}

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest & { user: User }) => Promise<Response>,
  requiredRole?: 'admin' | 'user'
): Promise<Response> {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'))

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'No authentication token provided',
          timestamp: new Date(),
        },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)

    const user = await authService.getUserById(payload.userId)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          timestamp: new Date(),
        },
        { status: 401 }
      )
    }

    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
          timestamp: new Date(),
        },
        { status: 403 }
      )
    }

    ;(request as any).user = user
    return handler(request as NextRequest & { user: User })
  } catch (error) {
    console.error('Auth middleware error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        timestamp: new Date(),
      },
      { status: 401 }
    )
  }
}

export function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest & { user: User }) => Promise<Response>
): Promise<Response> {
  return withAuth(request, handler, 'admin')
}
