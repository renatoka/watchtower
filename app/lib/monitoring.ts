import { getDb } from './database';
import { Endpoint, UptimeCheck, UptimeStatistics } from './types';
import {
  broadcastNewCheck,
  broadcastUptimeUpdate,
  broadcastSystemStatus,
} from './websocket-server';

class MonitoringEngine {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private lastStatistics: Map<string, UptimeStatistics> = new Map();

  async startMonitoring() {
    console.log('🚀 Starting monitoring engine...');

    // Get all enabled endpoints
    const endpoints = await this.getEnabledEndpoints();

    if (endpoints.length === 0) {
      console.warn('⚠️ No enabled endpoints found');
      broadcastSystemStatus(
        'No endpoints configured for monitoring',
        'warning'
      );
      return;
    }

    // Start monitoring each endpoint
    for (const endpoint of endpoints) {
      this.startEndpointMonitoring(endpoint);
    }

    console.log(
      `✅ Started monitoring ${endpoints.length} endpoints`
    );
    broadcastSystemStatus(
      `Monitoring started for ${endpoints.length} endpoints`,
      'info'
    );
  }

  async stopMonitoring() {
    console.log('🛑 Stopping monitoring engine...');

    // Clear all intervals
    for (const [endpointId, interval] of this.intervals) {
      clearInterval(interval);
    }

    this.intervals.clear();
    this.consecutiveFailures.clear();
    this.lastStatistics.clear();

    console.log('✅ Monitoring engine stopped');
    broadcastSystemStatus('Monitoring engine stopped', 'info');
  }

  async restartEndpointMonitoring(endpointId: string) {
    console.log(
      `🔄 Restarting monitoring for endpoint: ${endpointId}`
    );

    // Stop existing monitoring
    const interval = this.intervals.get(endpointId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(endpointId);
    }

    // Get updated endpoint data
    const endpoint = await this.getEndpointById(endpointId);
    if (endpoint && endpoint.enabled) {
      this.startEndpointMonitoring(endpoint);
      broadcastSystemStatus(
        `Restarted monitoring for ${endpoint.name}`,
        'info'
      );
    }
  }

  private startEndpointMonitoring(endpoint: Endpoint) {
    const intervalMs = endpoint.checkInterval * 1000;

    // Perform initial check immediately
    this.checkEndpoint(endpoint);

    // Set up recurring checks
    const interval = setInterval(() => {
      this.checkEndpoint(endpoint);
    }, intervalMs);

    this.intervals.set(endpoint.id, interval);

    console.log(
      `📡 Started monitoring ${endpoint.name} (every ${endpoint.checkInterval}s)`
    );
  }

  private async checkEndpoint(endpoint: Endpoint) {
    const startTime = Date.now();

    try {
      console.log(`🔍 Checking ${endpoint.name}...`);

      const response = await fetch(endpoint.url, {
        method: 'GET',
        signal: AbortSignal.timeout(endpoint.timeout * 1000),
        headers: {
          'User-Agent': 'WatchTower-Monitor/1.0',
        },
      });

      const responseTime = Date.now() - startTime;
      const isUp = response.status === endpoint.expectedStatus;

      const check: Omit<UptimeCheck, 'id'> = {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        status: isUp ? 'UP' : 'DOWN',
        statusCode: response.status,
        responseTime,
        timestamp: new Date(),
        errorReason: isUp
          ? undefined
          : `Got ${response.status}, expected ${endpoint.expectedStatus}`,
      };

      // Store check in database
      await this.storeCheck(check);

      // Handle consecutive failures tracking
      this.handleConsecutiveFailures(endpoint.id, check);

      // Log check result
      this.logCheck(endpoint.name, check);

      // 🚀 BROADCAST NEW CHECK VIA WEBSOCKET
      console.log(`📡 Broadcasting new check for ${endpoint.name}`);
      broadcastNewCheck({
        ...check,
        id: `${endpoint.id}-${Date.now()}`, // Generate temporary ID for broadcast
      } as UptimeCheck);

      // 🚀 BROADCAST UPDATED STATISTICS VIA WEBSOCKET
      const stats = await this.getUptimeStatistics(endpoint.id);
      if (stats) {
        console.log(
          `📊 Broadcasting uptime statistics for ${endpoint.name}`
        );
        broadcastUptimeUpdate(stats);

        // Cache the statistics for comparison
        this.lastStatistics.set(endpoint.id, stats);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorReason = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorReason = `Timeout after ${endpoint.timeout}s`;
        } else {
          errorReason = `Connection failed: ${error.message}`;
        }
      }

      const check: Omit<UptimeCheck, 'id'> = {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        status: 'DOWN',
        statusCode: 0,
        responseTime,
        timestamp: new Date(),
        errorReason,
      };

      // Store check in database
      await this.storeCheck(check);

      // Handle consecutive failures
      this.handleConsecutiveFailures(endpoint.id, check);

      // Log check result
      this.logCheck(endpoint.name, check);

      // 🚀 BROADCAST NEW CHECK VIA WEBSOCKET (ERROR CASE)
      console.log(
        `📡 Broadcasting failed check for ${endpoint.name}`
      );
      broadcastNewCheck({
        ...check,
        id: `${endpoint.id}-${Date.now()}`, // Generate temporary ID for broadcast
      } as UptimeCheck);

      // 🚀 BROADCAST UPDATED STATISTICS VIA WEBSOCKET (ERROR CASE)
      const stats = await this.getUptimeStatistics(endpoint.id);
      if (stats) {
        console.log(
          `📊 Broadcasting uptime statistics for ${endpoint.name} (after failure)`
        );
        broadcastUptimeUpdate(stats);

        // Cache the statistics
        this.lastStatistics.set(endpoint.id, stats);
      }
    }
  }

  private async storeCheck(check: Omit<UptimeCheck, 'id'>) {
    const db = getDb();

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
      );
    } catch (error) {
      console.error('❌ Failed to store check result:', error);
      broadcastSystemStatus(
        'Failed to store check result in database',
        'error'
      );
    }
  }

  private handleConsecutiveFailures(
    endpointId: string,
    check: Omit<UptimeCheck, 'id'>
  ) {
    if (check.status === 'UP') {
      const previousFailures =
        this.consecutiveFailures.get(endpointId) || 0;
      this.consecutiveFailures.set(endpointId, 0);

      // If we recovered from failures, broadcast good news
      if (previousFailures > 0) {
        broadcastSystemStatus(
          `${check.endpointName} is back online after ${previousFailures} failures`,
          'info'
        );
      }
    } else {
      const current = this.consecutiveFailures.get(endpointId) || 0;
      const newCount = current + 1;
      this.consecutiveFailures.set(endpointId, newCount);

      // Broadcast alerts for multiple consecutive failures
      if (newCount % 3 === 0) {
        const alertMessage = `🚨 ${check.endpointName} has ${newCount} consecutive failures`;
        console.warn(alertMessage);
        broadcastSystemStatus(alertMessage, 'error');
      }
    }
  }

  private logCheck(
    endpointName: string,
    check: Omit<UptimeCheck, 'id'>
  ) {
    const symbol = check.status === 'UP' ? '✅' : '❌';
    const timestamp = check.timestamp.toLocaleTimeString();

    console.log(
      `[${timestamp}] ${symbol} ${endpointName.padEnd(
        20
      )} | ${check.status.padEnd(4)} | ` +
        `${check.responseTime.toString().padStart(4)}ms | ${
          check.statusCode
        }`
    );
  }

  async getEnabledEndpoints(): Promise<Endpoint[]> {
    const db = getDb();

    try {
      const result = await db.query(`
        SELECT * FROM endpoints WHERE enabled = true ORDER BY name
      `);

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
      }));
    } catch (error) {
      console.error('❌ Failed to get enabled endpoints:', error);
      return [];
    }
  }

  async getEndpointById(id: string): Promise<Endpoint | null> {
    const db = getDb();

    try {
      const result = await db.query(
        `SELECT * FROM endpoints WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
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
      };
    } catch (error) {
      console.error('❌ Failed to get endpoint by ID:', error);
      return null;
    }
  }

  async getAllUptimeStatuses() {
    const endpoints = await this.getEnabledEndpoints();
    const statistics = [];

    for (const endpoint of endpoints) {
      const stats = await this.getUptimeStatistics(endpoint.id);
      if (stats) {
        statistics.push(stats);
      }
    }

    return statistics;
  }

  async getUptimeStatistics(
    endpointId: string
  ): Promise<UptimeStatistics | null> {
    const db = getDb();

    try {
      // Get endpoint info
      const endpointResult = await db.query(
        `SELECT name, url FROM endpoints WHERE id = $1`,
        [endpointId]
      );

      if (endpointResult.rows.length === 0) {
        return null;
      }

      const { name: endpointName, url } = endpointResult.rows[0];

      // Get statistics for last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
      );

      const recentResult = await db.query(
        `
        SELECT * FROM uptime_checks
        WHERE endpoint_id = $1
        ORDER BY timestamp DESC
        LIMIT 10
      `,
        [endpointId]
      );

      // Get recent checks
      const recentChecks: UptimeCheck[] = recentResult.rows.map(
        (row) => ({
          id: row.id,
          endpointId: row.endpoint_id,
          endpointName: row.endpoint_name,
          status: row.status,
          statusCode: row.status_code,
          responseTime: row.response_time,
          timestamp: row.timestamp,
          errorReason: row.error_reason,
        })
      );

      const stats = statsResult.rows[0];
      const totalChecks = parseInt(stats.total_checks) || 0;
      const successfulChecks = parseInt(stats.successful_checks) || 0;
      const uptimePercentage =
        totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

      // Get current status from most recent check
      let currentStatus: 'UP' | 'DOWN' = 'UP';
      if (recentResult.rows.length > 0) {
        currentStatus = recentResult.rows[0].status;
      }

      // Get consecutive failures
      const consecutiveFailures =
        this.consecutiveFailures.get(endpointId) || 0;

      return {
        endpointId,
        endpointName,
        totalChecks,
        successfulChecks,
        failedChecks: parseInt(stats.failed_checks) || 0,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        averageResponseTime:
          Math.round(
            (parseFloat(stats.avg_response_time) || 0) * 100
          ) / 100,
        lastCheck: stats.last_check || new Date(),
        currentStatus,
        consecutiveFailures,
        recentChecks
      };
    } catch (error) {
      console.error('❌ Failed to get uptime statistics:', error);
      return null;
    }
  }

  // 🚀 NEW: Force broadcast all current statistics
  async broadcastAllStatistics() {
    console.log('📡 Broadcasting all current statistics...');
    const statistics = await this.getAllUptimeStatuses();

    for (const stats of statistics) {
      broadcastUptimeUpdate(stats);
    }

    console.log(
      `📊 Broadcasted statistics for ${statistics.length} endpoints`
    );
  }
}

export const monitoringEngine = new MonitoringEngine();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  monitoringEngine.startMonitoring().catch(console.error);
}

// Auto-start monitoring in development (server-side only)
if (typeof window === 'undefined') {
  setTimeout(() => {
    monitoringEngine.startMonitoring().catch(console.error);
  }, 2000); // Increased delay to ensure everything is ready
}
