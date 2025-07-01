import { NextRequest, NextResponse } from 'next/server'

interface RateLimitStore {
  attempts: number
  resetTime: number
}

const store = new Map<string, RateLimitStore>()

setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of store.entries()) {
      if (value.resetTime < now) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000
)

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  max: number // Max requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests, please try again later',
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded
      ? forwarded.split(',')[0]
      : req.headers.get('x-real-ip') || 'unknown'
    return ip
  },
}

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const options = { ...defaultConfig, ...config }

  return async function rateLimitMiddleware(req: NextRequest) {
    const key = options.keyGenerator!(req)
    const now = Date.now()

    const record = store.get(key) || {
      attempts: 0,
      resetTime: now + options.windowMs,
    }

    if (record.resetTime < now) {
      record.attempts = 0
      record.resetTime = now + options.windowMs
    }

    record.attempts++
    store.set(key, record)

    if (record.attempts > options.max) {
      return {
        success: false,
        error: options.message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        status: 429,
      }
    }

    return null // No rate limit hit
  }
}

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'API rate limit exceeded',
})

export const createEndpointRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // Only 10 endpoint creations per minute
  message: 'Too many endpoints created, please try again later',
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts',
})

export async function withRateLimit(
  req: NextRequest,
  rateLimiter: ReturnType<typeof rateLimit>,
  handler: () => Promise<Response>
): Promise<Response> {
  const rateLimitResult = await rateLimiter(req)

  if (rateLimitResult) {
    return NextResponse.json(
      {
        success: false,
        error: rateLimitResult.error,
        timestamp: new Date(),
      },
      {
        status: rateLimitResult.status,
        headers: {
          'Retry-After': rateLimitResult.retryAfter.toString(),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(
            Date.now() + rateLimitResult.retryAfter * 1000
          ).toISOString(),
        },
      }
    )
  }

  return handler()
}
