import { NextResponse } from 'next/server'
import { dataCleanupJob } from '@/app/lib/data-cleanup'

export async function GET() {
  try {
    const stats = await dataCleanupJob.getDataStats()

    return NextResponse.json({
      success: true,
      data: {
        stats,
        config: {
          detailRetentionDays: 7,
          hourlyRetentionDays: 30,
          dailyRetentionDays: 90,
        },
      },
      timestamp: new Date(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get data statistics',
        timestamp: new Date(),
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    await dataCleanupJob.run()

    return NextResponse.json({
      success: true,
      message: 'Cleanup job triggered',
      timestamp: new Date(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run cleanup job',
        timestamp: new Date(),
      },
      { status: 500 }
    )
  }
}
