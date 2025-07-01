import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/app/lib/auth/middleware'
import { authService } from '@/app/lib/auth/auth-service'

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(request, async (req) => {
    const { id: userId } = await params

    if (!isValidUUID(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID format',
          timestamp: new Date(),
        },
        { status: 400 }
      )
    }

    if (req.user.id === userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete your own account',
          timestamp: new Date(),
        },
        { status: 400 }
      )
    }

    try {
      await authService.deleteUser(userId)

      return NextResponse.json({
        success: true,
        timestamp: new Date(),
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete user',
          timestamp: new Date(),
        },
        { status: 500 }
      )
    }
  })
}
