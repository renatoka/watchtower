import { getDb } from './database'
import { Endpoint, UptimeCheck, UptimeStatistics } from './types'
import {
  broadcastNewCheck,
  broadcastUptimeUpdate,
  broadcastSystemStatus,
} from './websocket-server'
import { circuitBreakerFactory } from './circuit-breaker'

class MonitoringEngine {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private consecutiveFailures: Map<string, number> = new Map()
  private lastStatistics: Map<string, UptimeStatistics> = new Map()

  async startMonitoring() {
    console.log('🚀 Starting monitoring engine...')

    this.stopMonitoring()

    const endpoints = await this.getEnabledEndpoints()
    console.log(
      `📊 Found ${endpoints.length} enabled endpoints:`,
      endpoints.map((e) => ({
        name: e.name,
        id: e.id,
        interval: e.checkInterval,
      }))
    )

    if (endpoints.length === 0) {
      console.warn('⚠️ No enabled endpoints found')
      broadcastSystemStatus('No endpoints configured for monitoring', 'warning')
      return
    }

    for (const endpoint of endpoints) {
      this.startEndpointMonitoring(endpoint)
    }

    console.log(`✅ Started monitoring ${endpoints.length} endpoints`)
    broadcastSystemStatus(
      `Monitoring started for ${endpoints.length} endpoints`,
      'info'
    )
  }

  async stopMonitoring() {
    console.log('🛑 Stopping monitoring engine...')

    for (const [endpointId, interval] of this.intervals) {
      console.log(`⏹️ Stopping monitor for endpoint ${endpointId}`)
      clearInterval(interval)
    }

    this.intervals.clear()
    this.consecutiveFailures.clear()
    this.lastStatistics.clear()

    console.log('✅ Monitoring engine stopped')
    broadcastSystemStatus('Monitoring engine stopped', 'info')
  }

  async restartEndpointMonitoring(endpointId: string) {
    console.log(`🔄 Restarting monitoring for endpoint: ${endpointId}`)

    const interval = this.intervals.get(endpointId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(endpointId)
      console.log(`⏹️ Stopped existing monitor for endpoint: ${endpointId}`)
    }

    const endpoint = await this.getEndpointById(endpointId)
    if (endpoint && endpoint.enabled) {
      this.startEndpointMonitoring(endpoint)
      broadcastSystemStatus(`Restarted monitoring for ${endpoint.name}`, 'info')
    } else if (endpoint && !endpoint.enabled) {
      console.log(`⏭️ Endpoint ${endpointId} is disabled, not starting monitor`)
    } else {
      console.log(`❌ Endpoint ${endpointId} not found`)
    }
  }

  private startEndpointMonitoring(endpoint: Endpoint) {
    if (this.intervals.has(endpoint.id)) {
      console.log(`⚠️ Already monitoring ${endpoint.name}, skipping duplicate`)
      return
    }

    const intervalMs = endpoint.checkInterval * 1000

    this.checkEndpoint(endpoint)

    const interval = setInterval(() => {
      this.checkEndpoint(endpoint)
    }, intervalMs)

    this.intervals.set(endpoint.id, interval)

    console.log(
      `📡 Started monitoring ${endpoint.name} (ID: ${endpoint.id}) every ${endpoint.checkInterval}s`
    )
  }

  private async checkEndpoint(endpoint: Endpoint) {
    const startTime = Date.now()
    const circuitBreaker = circuitBreakerFactory.get(
      `endpoint-${endpoint.id}`,
      {
        failureThreshold: 70, // Open at 70% failure rate
        resetTimeout: endpoint.checkInterval * 3000, // 3x check interval
        monitoringPeriod: 300000, // 5 minutes
        minimumRequests: 3,
        onStateChange: (state) => {
          console.log(`🔌 Circuit breaker for ${endpoint.name}: ${state}`)
          if (state === 'OPEN') {
            broadcastSystemStatus(
              `Circuit breaker opened for ${endpoint.name} due to repeated failures`,
              'warning'
            )
          }
        },
      }
    )

    try {
      await circuitBreaker.execute(async () => {
        console.log(`🔍 Checking ${endpoint.name}...`)

        const response = await fetch(endpoint.url, {
          method: 'GET',
          signal: AbortSignal.timeout(endpoint.timeout * 1000),
          headers: {
            'User-Agent': 'Watchtower-Monitor/1.0',
          },
        })

        const responseTime = Date.now() - startTime
        const isUp = response.status === endpoint.expectedStatus

        if (!isUp) {
          throw new Error(
            `Got ${response.status}, expected ${endpoint.expectedStatus}`
          )
        }

        const check: Omit<UptimeCheck, 'id'> = {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          status: 'UP',
          statusCode: response.status,
          responseTime,
          timestamp: new Date(),
          errorReason: undefined,
        }

        await this.storeCheck(check)
        this.handleConsecutiveFailures(endpoint.id, check)
        this.logCheck(endpoint.name, check)

        console.log(`📡 Broadcasting new check for ${endpoint.name}`)
        broadcastNewCheck({
          ...check,
          id: `${endpoint.id}-${Date.now()}`,
        } as UptimeCheck)

        const stats = await this.getUptimeStatistics(endpoint.id)
        if (stats) {
          console.log(`📊 Broadcasting uptime statistics for ${endpoint.name}`)
          broadcastUptimeUpdate(stats)
          this.lastStatistics.set(endpoint.id, stats)
        }
      })
    } catch (error) {
      const responseTime = Date.now() - startTime
      let errorReason = 'Unknown error'
      let statusCode = 0

      if (
        error instanceof Error &&
        error.message.includes('Circuit breaker is OPEN')
      ) {
        errorReason = 'Circuit breaker open - too many failures'
        console.log(
          `⚡ Skipping check for ${endpoint.name} - circuit breaker is open`
        )

        const check: Omit<UptimeCheck, 'id'> = {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          status: 'DOWN',
          statusCode: 0,
          responseTime: 0,
          timestamp: new Date(),
          errorReason: 'Circuit breaker open',
        }

        await this.storeCheck(check)
        return // Skip further processing
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorReason = `Timeout after ${endpoint.timeout}s`
        } else if (error.message.includes('Got')) {
          const match = error.message.match(/Got (\d+)/)
          statusCode = match ? parseInt(match[1]) : 0
          errorReason = error.message
        } else {
          errorReason = `Connection failed: ${error.message}`
        }
      }

      const check: Omit<UptimeCheck, 'id'> = {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        status: 'DOWN',
        statusCode,
        responseTime,
        timestamp: new Date(),
        errorReason,
      }

      await this.storeCheck(check)
      this.handleConsecutiveFailures(endpoint.id, check)
      this.logCheck(endpoint.name, check)

      broadcastNewCheck({
        ...check,
        id: `${endpoint.id}-${Date.now()}`,
      } as UptimeCheck)

      const stats = await this.getUptimeStatistics(endpoint.id)
      if (stats) {
        broadcastUptimeUpdate(stats)
        this.lastStatistics.set(endpoint.id, stats)
      }
    }
  }

  private async storeCheck(check: Omit<UptimeCheck, 'id'>) {
    const db = getDb()

    try {
      await db.query(
        `
        INSERT INTO uptime_checks
        (endpoint_id, endpoint_name, status, status_code, response_time, timestamp, error_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          check.endpointId,
          check.endpointName,
          check.status,
          check.statusCode,
          check.responseTime,
          check.timestamp,
          check.errorReason,
        ]
      )
    } catch (error) {
      console.error('❌ Failed to store check result:', error)
      broadcastSystemStatus('Failed to store check result in database', 'error')
    }
  }

  private handleConsecutiveFailures(
    endpointId: string,
    check: Omit<UptimeCheck, 'id'>
  ) {
    if (check.status === 'UP') {
      const previousFailures = this.consecutiveFailures.get(endpointId) || 0
      this.consecutiveFailures.set(endpointId, 0)

      if (previousFailures > 0) {
        broadcastSystemStatus(
          `${check.endpointName} is back online after ${previousFailures} failures`,
          'info'
        )
      }
    } else {
      const current = this.consecutiveFailures.get(endpointId) || 0
      const newCount = current + 1
      this.consecutiveFailures.set(endpointId, newCount)

      if (newCount % 3 === 0) {
        const alertMessage = `🚨 ${check.endpointName} has ${newCount} consecutive failures`
        console.warn(alertMessage)
        broadcastSystemStatus(alertMessage, 'error')
      }
    }
  }

  private logCheck(endpointName: string, check: Omit<UptimeCheck, 'id'>) {
    const symbol = check.status === 'UP' ? '✅' : '❌'
    const timestamp = check.timestamp.toLocaleTimeString()

    console.log(
      `[${timestamp}] ${symbol} ${endpointName.padEnd(
        20
      )} | ${check.status.padEnd(4)} | ` +
        `${check.responseTime.toString().padStart(4)}ms | ${check.statusCode}`
    )
  }

  async getAllEndpoints(): Promise<Endpoint[]> {
    const db = getDb()

    try {
      const result = await db.query(`
        SELECT * FROM endpoints ORDER BY name
      `)

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        checkInterval: row.check_interval,
        timeout: row.timeout,
        expectedStatus: row.expected_status,
        severity: row.severity,
        enabled: row.enabled,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    } catch (error) {
      console.error('❌ Failed to get all endpoints:', error)
      return []
    }
  }

  async getEnabledEndpoints(): Promise<Endpoint[]> {
    const db = getDb()

    try {
      const result = await db.query(`
        SELECT * FROM endpoints WHERE enabled = true ORDER BY name
      `)

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        checkInterval: row.check_interval,
        timeout: row.timeout,
        expectedStatus: row.expected_status,
        severity: row.severity,
        enabled: row.enabled,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    } catch (error) {
      console.error('❌ Failed to get enabled endpoints:', error)
      return []
    }
  }

  async getEndpointById(id: string): Promise<Endpoint | null> {
    const db = getDb()

    try {
      const result = await db.query(`SELECT * FROM endpoints WHERE id = $1`, [
        id,
      ])

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        checkInterval: row.check_interval,
        timeout: row.timeout,
        expectedStatus: row.expected_status,
        severity: row.severity,
        enabled: row.enabled,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    } catch (error) {
      console.error('❌ Failed to get endpoint by ID:', error)
      return null
    }
  }

  async getAllUptimeStatuses() {
    const endpoints = await this.getEnabledEndpoints()
    const statistics = []

    for (const endpoint of endpoints) {
      const stats = await this.getUptimeStatistics(endpoint.id)
      if (stats) {
        statistics.push(stats)
      }
    }

    return statistics
  }

  // async getAllUptimeStatuses(): Promise<UptimeStatistics[]> {
  //   const db = getDb()

  //   try {
  //     const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  //     const result = await db.query(
  //       `
  //     WITH endpoint_stats AS (
  //       SELECT
  //         e.id as endpoint_id,
  //         e.name as endpoint_name,
  //         COUNT(uc.id) as total_checks,
  //         COUNT(uc.id) FILTER (WHERE uc.status = 'UP') as successful_checks,
  //         COUNT(uc.id) FILTER (WHERE uc.status = 'DOWN') as failed_checks,
  //         COALESCE(AVG(uc.response_time), 0) as avg_response_time,
  //         MAX(uc.timestamp) as last_check
  //       FROM endpoints e
  //       LEFT JOIN uptime_checks uc ON e.id = uc.endpoint_id
  //         AND uc.timestamp >= $1
  //       WHERE e.enabled = true
  //       GROUP BY e.id, e.name
  //     ),
  //     latest_status AS (
  //       SELECT DISTINCT ON (endpoint_id)
  //         endpoint_id,
  //         status as current_status
  //       FROM uptime_checks
  //       WHERE timestamp >= $1
  //       ORDER BY endpoint_id, timestamp DESC
  //     ),
  //     recent_checks AS (
  //       SELECT
  //         uc.*,
  //         ROW_NUMBER() OVER (PARTITION BY uc.endpoint_id ORDER BY uc.timestamp DESC) as rn
  //       FROM uptime_checks uc
  //       WHERE uc.timestamp >= $1
  //     )
  //     SELECT
  //       es.*,
  //       COALESCE(ls.current_status, 'UP') as current_status,
  //       COALESCE(
  //         ROUND((es.successful_checks::numeric / NULLIF(es.total_checks, 0)) * 100, 2),
  //         100
  //       ) as uptime_percentage,
  //       COALESCE(
  //         json_agg(
  //           json_build_object(
  //             'id', rc.id,
  //             'endpointId', rc.endpoint_id,
  //             'endpointName', rc.endpoint_name,
  //             'status', rc.status,
  //             'statusCode', rc.status_code,
  //             'responseTime', rc.response_time,
  //             'timestamp', rc.timestamp,
  //             'errorReason', rc.error_reason
  //           ) ORDER BY rc.timestamp DESC
  //         ) FILTER (WHERE rc.rn <= 10),
  //         '[]'::json
  //       ) as recent_checks
  //     FROM endpoint_stats es
  //     LEFT JOIN latest_status ls ON es.endpoint_id = ls.endpoint_id
  //     LEFT JOIN recent_checks rc ON es.endpoint_id = rc.endpoint_id AND rc.rn <= 10
  //     GROUP BY
  //       es.endpoint_id, es.endpoint_name, es.total_checks,
  //       es.successful_checks, es.failed_checks,
  //       es.avg_response_time, es.last_check, ls.current_status
  //     ORDER BY es.endpoint_name
  //   `,
  //       [since]
  //     )

  //     return result.rows.map((row) => ({
  //       endpointId: row.endpoint_id,
  //       endpointName: row.endpoint_name,
  //       totalChecks: parseInt(row.total_checks) || 0,
  //       successfulChecks: parseInt(row.successful_checks) || 0,
  //       failedChecks: parseInt(row.failed_checks) || 0,
  //       uptimePercentage: parseFloat(row.uptime_percentage) || 100,
  //       averageResponseTime: parseFloat(row.avg_response_time) || 0,
  //       lastCheck: row.last_check || new Date(),
  //       currentStatus: row.current_status || 'UP',
  //       consecutiveFailures: this.consecutiveFailures.get(row.endpoint_id) || 0,
  //       recentChecks: row.recent_checks || [],
  //     }))
  //   } catch (error) {
  //     console.error('❌ Failed to get all uptime statuses:', error)
  //     return []
  //   }
  // }

  async getUptimeStatistics(
    endpointId: string
  ): Promise<UptimeStatistics | null> {
    const db = getDb()

    try {
      const endpointResult = await db.query(
        `SELECT name, url FROM endpoints WHERE id = $1`,
        [endpointId]
      )

      if (endpointResult.rows.length === 0) {
        return null
      }

      const { name: endpointName, url } = endpointResult.rows[0]

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const statsResult = await db.query(
        `
        SELECT
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE status = 'UP') as successful_checks,
          COUNT(*) FILTER (WHERE status = 'DOWN') as failed_checks,
          AVG(response_time) as avg_response_time,
          MAX(timestamp) as last_check
        FROM uptime_checks
        WHERE endpoint_id = $1 AND timestamp >= $2
      `,
        [endpointId, since]
      )

      const recentResult = await db.query(
        `
        SELECT * FROM uptime_checks
        WHERE endpoint_id = $1
        ORDER BY timestamp DESC
        LIMIT 10
      `,
        [endpointId]
      )

      const recentChecks: UptimeCheck[] = recentResult.rows.map((row) => ({
        id: row.id,
        endpointId: row.endpoint_id,
        endpointName: row.endpoint_name,
        status: row.status,
        statusCode: row.status_code,
        responseTime: row.response_time,
        timestamp: row.timestamp,
        errorReason: row.error_reason,
      }))

      const stats = statsResult.rows[0]
      const totalChecks = parseInt(stats.total_checks) || 0
      const successfulChecks = parseInt(stats.successful_checks) || 0
      const uptimePercentage =
        totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0

      let currentStatus: 'UP' | 'DOWN' = 'UP'
      if (recentResult.rows.length > 0) {
        currentStatus = recentResult.rows[0].status
      }

      const consecutiveFailures = this.consecutiveFailures.get(endpointId) || 0

      return {
        endpointId,
        endpointName,
        totalChecks,
        successfulChecks,
        failedChecks: parseInt(stats.failed_checks) || 0,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        averageResponseTime:
          Math.round((parseFloat(stats.avg_response_time) || 0) * 100) / 100,
        lastCheck: stats.last_check || new Date(),
        currentStatus,
        consecutiveFailures,
        recentChecks,
      }
    } catch (error) {
      console.error('❌ Failed to get uptime statistics:', error)
      return null
    }
  }

  async broadcastAllStatistics() {
    console.log('📡 Broadcasting all current statistics...')
    const statistics = await this.getAllUptimeStatuses()

    for (const stats of statistics) {
      broadcastUptimeUpdate(stats)
    }

    console.log(`📊 Broadcasted statistics for ${statistics.length} endpoints`)
  }
}

export const monitoringEngine = new MonitoringEngine()

if (process.env.NODE_ENV === 'production') {
  monitoringEngine.startMonitoring().catch(console.error)
}

if (typeof window === 'undefined') {
  setTimeout(() => {
    monitoringEngine.startMonitoring().catch(console.error)
  }, 2000) // Increased delay to ensure everything is ready
}
