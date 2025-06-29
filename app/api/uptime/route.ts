import { NextResponse } from 'next/server'
import { monitoringEngine } from '@/app/lib/monitoring'
import { ApiResponse, UptimeStatistics } from '@/app/lib/types'

export async function GET() {
  const timestamp = new Date()

  try {
    const statistics = await monitoringEngine.getAllUptimeStatuses()

    return NextResponse.json<ApiResponse<UptimeStatistics[]>>({
      success: true,
      data: statistics,
      timestamp,
    })
  } catch (error) {
    console.error('Error fetching uptime statuses:', error)

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch uptime statuses',
        timestamp,
      },
      { status: 500 }
    )
  }
}
