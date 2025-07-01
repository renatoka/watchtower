import { getDb } from './database'

export interface CleanupConfig {
  detailRetentionDays: number // Keep all checks for N days
  hourlyRetentionDays: number // Keep hourly summaries for N days
  dailyRetentionDays: number // Keep daily summaries for N days
  deleteEnabled: boolean // Safety switch
  batchSize: number // Process in batches to avoid locking
}

const defaultConfig: CleanupConfig = {
  detailRetentionDays: 7, // 1 week of detailed data
  hourlyRetentionDays: 30, // 1 month of hourly data
  dailyRetentionDays: 90, // 3 months of daily data
  deleteEnabled: true,
  batchSize: 10000,
}

export class DataCleanupJob {
  private isRunning = false

  constructor(private config: CleanupConfig = defaultConfig) {}

  async run(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️ Cleanup job already running, skipping...')
      return
    }

    if (!this.config.deleteEnabled) {
      console.log('🚫 Cleanup job disabled by configuration')
      return
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      console.log('🧹 Starting data cleanup job...')

      await this.createHourlyAggregates()
      await this.createDailyAggregates()

      const deletedCount = await this.deleteOldDetailedData()

      await this.deleteOldAggregatedData()

      await this.vacuumTables()

      const duration = Date.now() - startTime
      console.log(
        `✅ Cleanup job completed in ${duration}ms. Deleted ${deletedCount} records.`
      )
    } catch (error) {
      console.error('❌ Cleanup job failed:', error)
      throw error
    } finally {
      this.isRunning = false
    }
  }

  private async createHourlyAggregates(): Promise<void> {
    const db = getDb()

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS uptime_checks_hourly (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
          endpoint_name VARCHAR(255) NOT NULL,
          hour_start TIMESTAMP WITH TIME ZONE NOT NULL,
          total_checks INTEGER NOT NULL,
          successful_checks INTEGER NOT NULL,
          failed_checks INTEGER NOT NULL,
          avg_response_time REAL NOT NULL,
          min_response_time REAL NOT NULL,
          max_response_time REAL NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(endpoint_id, hour_start)
        );

        CREATE INDEX IF NOT EXISTS idx_hourly_endpoint_hour
        ON uptime_checks_hourly(endpoint_id, hour_start DESC);
      `)

      const result = await db.query(`
        INSERT INTO uptime_checks_hourly (
          endpoint_id, endpoint_name, hour_start,
          total_checks, successful_checks, failed_checks,
          avg_response_time, min_response_time, max_response_time
        )
        SELECT
          endpoint_id,
          endpoint_name,
          DATE_TRUNC('hour', timestamp) as hour_start,
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE status = 'UP') as successful_checks,
          COUNT(*) FILTER (WHERE status = 'DOWN') as failed_checks,
          AVG(response_time) as avg_response_time,
          MIN(response_time) as min_response_time,
          MAX(response_time) as max_response_time
        FROM uptime_checks
        WHERE timestamp >= NOW() - INTERVAL '${this.config.hourlyRetentionDays} days'
          AND timestamp < DATE_TRUNC('hour', NOW())
        GROUP BY endpoint_id, endpoint_name, DATE_TRUNC('hour', timestamp)
        ON CONFLICT (endpoint_id, hour_start)
        DO UPDATE SET
          total_checks = EXCLUDED.total_checks,
          successful_checks = EXCLUDED.successful_checks,
          failed_checks = EXCLUDED.failed_checks,
          avg_response_time = EXCLUDED.avg_response_time,
          min_response_time = EXCLUDED.min_response_time,
          max_response_time = EXCLUDED.max_response_time
      `)

      console.log(`📊 Created/updated ${result.rowCount} hourly aggregates`)
    } catch (error) {
      console.error('Failed to create hourly aggregates:', error)
      throw error
    }
  }

  private async createDailyAggregates(): Promise<void> {
    const db = getDb()

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS uptime_checks_daily (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
          endpoint_name VARCHAR(255) NOT NULL,
          day_start DATE NOT NULL,
          total_checks INTEGER NOT NULL,
          successful_checks INTEGER NOT NULL,
          failed_checks INTEGER NOT NULL,
          uptime_percentage REAL NOT NULL,
          avg_response_time REAL NOT NULL,
          min_response_time REAL NOT NULL,
          max_response_time REAL NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(endpoint_id, day_start)
        );

        CREATE INDEX IF NOT EXISTS idx_daily_endpoint_day
        ON uptime_checks_daily(endpoint_id, day_start DESC);
      `)

      const result = await db.query(`
        INSERT INTO uptime_checks_daily (
          endpoint_id, endpoint_name, day_start,
          total_checks, successful_checks, failed_checks,
          uptime_percentage, avg_response_time,
          min_response_time, max_response_time
        )
        SELECT
          endpoint_id,
          endpoint_name,
          DATE_TRUNC('day', timestamp)::DATE as day_start,
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE status = 'UP') as successful_checks,
          COUNT(*) FILTER (WHERE status = 'DOWN') as failed_checks,
          ROUND((COUNT(*) FILTER (WHERE status = 'UP')::numeric / COUNT(*)) * 100, 2) as uptime_percentage,
          AVG(response_time) as avg_response_time,
          MIN(response_time) as min_response_time,
          MAX(response_time) as max_response_time
        FROM uptime_checks
        WHERE timestamp >= NOW() - INTERVAL '${this.config.dailyRetentionDays} days'
          AND timestamp < DATE_TRUNC('day', NOW())
        GROUP BY endpoint_id, endpoint_name, DATE_TRUNC('day', timestamp)::DATE
        ON CONFLICT (endpoint_id, day_start)
        DO UPDATE SET
          total_checks = EXCLUDED.total_checks,
          successful_checks = EXCLUDED.successful_checks,
          failed_checks = EXCLUDED.failed_checks,
          uptime_percentage = EXCLUDED.uptime_percentage,
          avg_response_time = EXCLUDED.avg_response_time,
          min_response_time = EXCLUDED.min_response_time,
          max_response_time = EXCLUDED.max_response_time
      `)

      console.log(`📊 Created/updated ${result.rowCount} daily aggregates`)
    } catch (error) {
      console.error('Failed to create daily aggregates:', error)
      throw error
    }
  }

  private async deleteOldDetailedData(): Promise<number> {
    const db = getDb()
    let totalDeleted = 0

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.detailRetentionDays)

      console.log(
        `🗑️ Deleting detailed checks older than ${cutoffDate.toISOString()}`
      )

      let deleted = 0
      do {
        const result = await db.query(
          `
          DELETE FROM uptime_checks
          WHERE id IN (
            SELECT id FROM uptime_checks
            WHERE timestamp < $1
            LIMIT $2
          )
        `,
          [cutoffDate, this.config.batchSize]
        )

        deleted = result.rowCount || 0
        totalDeleted += deleted

        if (deleted > 0) {
          console.log(`  Deleted batch: ${deleted} records`)

          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } while (deleted > 0)
    } catch (error) {
      console.error('Failed to delete old detailed data:', error)
      throw error
    }

    return totalDeleted
  }

  private async deleteOldAggregatedData(): Promise<void> {
    const db = getDb()

    try {
      const hourlyCutoff = new Date()
      hourlyCutoff.setDate(
        hourlyCutoff.getDate() - this.config.hourlyRetentionDays
      )

      const hourlyResult = await db.query(
        `
        DELETE FROM uptime_checks_hourly
        WHERE hour_start < $1
      `,
        [hourlyCutoff]
      )

      if (hourlyResult.rowCount) {
        console.log(`🗑️ Deleted ${hourlyResult.rowCount} old hourly aggregates`)
      }

      const dailyCutoff = new Date()
      dailyCutoff.setDate(
        dailyCutoff.getDate() - this.config.dailyRetentionDays
      )

      const dailyResult = await db.query(
        `
        DELETE FROM uptime_checks_daily
        WHERE day_start < $1
      `,
        [dailyCutoff]
      )

      if (dailyResult.rowCount) {
        console.log(`🗑️ Deleted ${dailyResult.rowCount} old daily aggregates`)
      }
    } catch (error) {
      console.error('Failed to delete old aggregated data:', error)
      throw error
    }
  }

  private async vacuumTables(): Promise<void> {
    const db = getDb()

    try {
      console.log('🔧 Vacuuming tables to reclaim space...')

      await db.query('VACUUM ANALYZE uptime_checks')
      await db.query('VACUUM ANALYZE uptime_checks_hourly')
      await db.query('VACUUM ANALYZE uptime_checks_daily')

      console.log('✅ Vacuum completed')
    } catch (error) {
      console.warn('⚠️ Vacuum failed (this is okay):', error)
    }
  }

  async getDataStats() {
    const db = getDb()

    try {
      const stats = await db.query(`
        SELECT
          'detailed' as type,
          COUNT(*) as record_count,
          MIN(timestamp) as oldest_record,
          MAX(timestamp) as newest_record,
          pg_size_pretty(pg_total_relation_size('uptime_checks')) as table_size
        FROM uptime_checks
        UNION ALL
        SELECT
          'hourly' as type,
          COUNT(*) as record_count,
          MIN(hour_start) as oldest_record,
          MAX(hour_start) as newest_record,
          pg_size_pretty(pg_total_relation_size('uptime_checks_hourly')) as table_size
        FROM uptime_checks_hourly
        UNION ALL
        SELECT
          'daily' as type,
          COUNT(*) as record_count,
          MIN(day_start) as oldest_record,
          MAX(day_start) as newest_record,
          pg_size_pretty(pg_total_relation_size('uptime_checks_daily')) as table_size
        FROM uptime_checks_daily
      `)

      return stats.rows
    } catch (error) {
      console.error('Failed to get data stats:', error)
      return []
    }
  }
}

export const dataCleanupJob = new DataCleanupJob()
