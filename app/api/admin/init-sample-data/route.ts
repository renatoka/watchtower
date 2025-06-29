import { NextResponse } from 'next/server'
import { createSampleEndpoints } from '@/app/lib/sample-data'
import { monitoringEngine } from '@/app/lib/monitoring'

export async function POST() {
    try {
        await createSampleEndpoints()

        await monitoringEngine.stopMonitoring()
        await monitoringEngine.startMonitoring()

        return NextResponse.json({
            success: true,
            message: 'Sample endpoints created and monitoring started',
        })
    } catch (error) {
        console.error('Failed to initialize sample data:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to initialize sample data',
            },
            { status: 500 }
        )
    }
}
