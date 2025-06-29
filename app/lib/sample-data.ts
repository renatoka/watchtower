import { getDb } from './database'

export async function createSampleEndpoints() {
  const db = getDb()

  const sampleEndpoints = [
    {
      name: 'Payment API',
      url: 'https://httpbin.org/status/200',
      checkInterval: 30,
      timeout: 5,
      expectedStatus: 200,
      severity: 'critical',
      tags: ['payment', 'core'],
    },
    {
      name: 'User API',
      url: 'https://httpbin.org/status/200',
      checkInterval: 45,
      timeout: 5,
      expectedStatus: 200,
      severity: 'high',
      tags: ['user', 'core'],
    },
    {
      name: 'Inventory API (Failing)',
      url: 'https://httpbin.org/status/500',
      checkInterval: 60,
      timeout: 5,
      expectedStatus: 200,
      severity: 'medium',
      tags: ['inventory', 'business'],
    },
    {
      name: 'Analytics API (Slow)',
      url: 'https://httpbin.org/delay/2',
      checkInterval: 90,
      timeout: 8,
      expectedStatus: 200,
      severity: 'low',
      tags: ['analytics', 'reporting'],
    },
    {
      name: 'Health Check',
      url: 'https://httpbin.org/status/200',
      checkInterval: 15,
      timeout: 3,
      expectedStatus: 200,
      severity: 'high',
      tags: ['health', 'monitoring'],
    },
  ]

  try {
    for (const endpoint of sampleEndpoints) {
      await db.query(
        `
        INSERT INTO endpoints (name, url, check_interval, timeout, expected_status, severity, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (name) DO NOTHING
      `,
        [
          endpoint.name,
          endpoint.url,
          endpoint.checkInterval,
          endpoint.timeout,
          endpoint.expectedStatus,
          endpoint.severity,
          endpoint.tags,
        ]
      )
    }

    console.log('Sample endpoints created successfully')
  } catch (error) {
    console.error('Failed to create sample endpoints:', error)
  }
}
