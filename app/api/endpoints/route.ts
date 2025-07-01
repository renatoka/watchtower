import { getDb } from '@/app/lib/database'
import { monitoringEngine } from '@/app/lib/monitoring'
import { ApiResponse, Endpoint } from '@/app/lib/types'
import { NextResponse, NextRequest } from 'next/server'
import {
  withRateLimit,
  apiRateLimit,
  createEndpointRateLimit,
} from '@/app/lib/rate-limit'
import { withAuth } from '@/app/lib/auth/middleware'

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().substring(0, maxLength)
}

function validateTags(tags: any): string[] {
  if (!Array.isArray(tags)) return []

  return tags
    .filter((tag) => typeof tag === 'string' && tag.length > 0)
    .map((tag) => sanitizeString(tag, 50))
    .slice(0, 10) // Max 10 tags
}

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const

export async function GET(request: NextRequest) {
  return withRateLimit(request, apiRateLimit, async () => {
    const timestamp = new Date()

    try {
      const endpoints = await monitoringEngine.getAllEndpoints()

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
  })
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    return withRateLimit(request, createEndpointRateLimit, async () => {
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

        const sanitizedName = sanitizeString(name, 255)
        if (sanitizedName.length < 1) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Name cannot be empty',
              timestamp,
            },
            { status: 400 }
          )
        }

        if (!validateUrl(url)) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Invalid URL. Must be a valid HTTP or HTTPS URL',
              timestamp,
            },
            { status: 400 }
          )
        }

        const validatedCheckInterval = Math.min(
          3600,
          Math.max(5, parseInt(checkInterval) || 30)
        )
        const validatedTimeout = Math.min(
          60,
          Math.max(1, parseInt(timeout) || 5)
        )
        const validatedExpectedStatus = Math.min(
          599,
          Math.max(100, parseInt(expectedStatus) || 200)
        )

        const validatedSeverity = VALID_SEVERITIES.includes(severity as any)
          ? severity
          : 'medium'

        const validatedTags = validateTags(tags)

        if (validatedTimeout >= validatedCheckInterval) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Timeout must be less than check interval',
              timestamp,
            },
            { status: 400 }
          )
        }

        const db = getDb()

        const duplicateCheck = await db.query(
          'SELECT id FROM endpoints WHERE LOWER(name) = LOWER($1)',
          [sanitizedName]
        )

        if (duplicateCheck.rows.length > 0) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'An endpoint with this name already exists',
              timestamp,
            },
            { status: 409 }
          )
        }

        const result = await db.query(
          `
        INSERT INTO endpoints (name, url, check_interval, timeout, expected_status, severity, tags, enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
          [
            sanitizedName,
            url.trim(),
            validatedCheckInterval,
            validatedTimeout,
            validatedExpectedStatus,
            validatedSeverity,
            validatedTags,
            true,
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

        if (error instanceof Error) {
          if (error.message.includes('duplicate key')) {
            return NextResponse.json<ApiResponse<null>>(
              {
                success: false,
                error: 'An endpoint with this configuration already exists',
                timestamp,
              },
              { status: 409 }
            )
          }
        }

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
    })
  })
}
