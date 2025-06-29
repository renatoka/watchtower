import { getDb } from '@/app/lib/database'
import { monitoringEngine } from '@/app/lib/monitoring'
import { ApiResponse, Endpoint } from '@/app/lib/types'
import { NextResponse, NextRequest } from 'next/server'

export async function GET() {
    const timestamp = new Date()

    try {
        const endpoints = await monitoringEngine.getEnabledEndpoints()

        return NextResponse.json<ApiResponse<Endpoint[]>>({
            success: true,
            data: endpoints,
            timestamp,
        })
    } catch (error) {
        console.error('Error fetching endpoints:', error)

        return NextResponse.json<ApiResponse<null>>(
            {
                success: false,
                error: 'Failed to fetch endpoints',
                timestamp,
            },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    const timestamp = new Date()

    try {
        const body = await request.json()
        const {
            name,
            url,
            checkInterval,
            timeout,
            expectedStatus,
            severity,
            tags,
        } = body

        if (!name || !url) {
            return NextResponse.json<ApiResponse<null>>(
                {
                    success: false,
                    error: 'Name and URL are required',
                    timestamp,
                },
                { status: 400 }
            )
        }

        const db = getDb()

        const result = await db.query(
            `
      INSERT INTO endpoints (name, url, check_interval, timeout, expected_status, severity, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
            [
                name,
                url,
                checkInterval || 30,
                timeout || 5,
                expectedStatus || 200,
                severity || 'medium',
                tags || [],
            ]
        )

        const newEndpoint = result.rows[0]

        await monitoringEngine.restartEndpointMonitoring(newEndpoint.id)

        return NextResponse.json<ApiResponse<{ id: string }>>(
            {
                success: true,
                data: { id: newEndpoint.id },
                timestamp,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Error creating endpoint:', error)

        return NextResponse.json<ApiResponse<null>>(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create endpoint',
                timestamp,
            },
            { status: 500 }
        )
    }
}
