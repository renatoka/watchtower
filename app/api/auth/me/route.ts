import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth/middleware'

export async function GET(request: NextRequest) {
  return withAuth(request, async (req) => {
    return NextResponse.json({
      success: true,
      data: req.user,
      timestamp: new Date(),
    })
  })
}
