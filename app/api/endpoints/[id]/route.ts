import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/app/lib/database'
import { monitoringEngine } from '@/app/lib/monitoring'
import { ApiResponse, Endpoint } from '@/app/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date()
  const endpointId = params.id

  try {
    const endpoint = await monitoringEngine.getEndpointById(endpointId)

    if (!endpoint) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Endpoint not found',
          timestamp,
        },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse<Endpoint>>({
      success: true,
      data: endpoint,
      timestamp,
    })
  } catch (error) {
    console.error(`Error fetching endpoint ${endpointId}:`, error)

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch endpoint',
        timestamp,
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date()
  const endpointId = params.id

  try {
    const body = await request.json()
    const {
      name,
      url,
      checkInterval,
      timeout,
      expectedStatus,
      severity,
      enabled,
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

    // Update endpoint
    const result = await db.query(
      `
      UPDATE endpoints
      SET name = $1, url = $2, check_interval = $3, timeout = $4,
          expected_status = $5, severity = $6, enabled = $7, tags = $8,
          updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `,
      [
        name,
        url,
        checkInterval || 30,
        timeout || 5,
        expectedStatus || 200,
        severity || 'medium',
        enabled !== undefined ? enabled : true,
        tags || [],
        endpointId,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Endpoint not found',
          timestamp,
        },
        { status: 404 }
      )
    }

    // Restart monitoring for this endpoint to pick up changes
    await monitoringEngine.restartEndpointMonitoring(endpointId)

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      timestamp,
    })
  } catch (error) {
    console.error('Error updating endpoint:', error)

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update endpoint',
        timestamp,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date()
  const endpointId = params.id

  try {
    const db = getDb()

    // Delete endpoint (CASCADE will handle uptime_checks)
    const result = await db.query(
      'DELETE FROM endpoints WHERE id = $1 RETURNING *',
      [endpointId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Endpoint not found',
          timestamp,
        },
        { status: 404 }
      )
    }

    // Stop monitoring for this endpoint
    await monitoringEngine.restartEndpointMonitoring(endpointId)

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      timestamp,
    })
  } catch (error) {
    console.error('Error deleting endpoint:', error)

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete endpoint',
        timestamp,
      },
      { status: 500 }
    )
  }
}
