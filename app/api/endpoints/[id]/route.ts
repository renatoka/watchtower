import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/app/lib/database'
import { monitoringEngine } from '@/app/lib/monitoring'
import { ApiResponse, Endpoint } from '@/app/lib/types'

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timestamp = new Date()
  const { id: endpointId } = await params

  if (!isValidUUID(endpointId)) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Invalid endpoint ID format',
        timestamp,
      },
      { status: 400 }
    )
  }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const timestamp = new Date()
  const { id: endpointId } = await params

  if (!isValidUUID(endpointId)) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Invalid endpoint ID format',
        timestamp,
      },
      { status: 400 }
    )
  }

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

    try {
      new URL(url)
    } catch {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Invalid URL format',
          timestamp,
        },
        { status: 400 }
      )
    }

    const validatedCheckInterval = Math.max(5, parseInt(checkInterval) || 30)
    const validatedTimeout = Math.max(1, parseInt(timeout) || 5)
    const validatedExpectedStatus = Math.min(
      599,
      Math.max(100, parseInt(expectedStatus) || 200)
    )

    const validSeverities = ['critical', 'high', 'medium', 'low']
    const validatedSeverity = validSeverities.includes(severity)
      ? severity
      : 'medium'

    const validatedTags = Array.isArray(tags)
      ? tags.filter(
          (tag) => typeof tag === 'string' && tag.length > 0 && tag.length < 50
        )
      : []

    const db = getDb()

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
        name.trim(),
        url.trim(),
        validatedCheckInterval,
        validatedTimeout,
        validatedExpectedStatus,
        validatedSeverity,
        enabled !== undefined ? enabled : true,
        validatedTags,
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
  { params }: { params: Promise<{ id: string }> }
) {
  const timestamp = new Date()
  const { id: endpointId } = await params

  if (!isValidUUID(endpointId)) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Invalid endpoint ID format',
        timestamp,
      },
      { status: 400 }
    )
  }

  try {
    const db = getDb()

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
