import { dataCleanupJob } from './data-cleanup'

class Scheduler {
  private cleanupInterval: NodeJS.Timeout | null = null
  private isRunning = false

  start() {
    if (this.isRunning) {
      console.log('⏰ Scheduler already running')
      return
    }

    this.isRunning = true
    console.log('⏰ Starting scheduler...')

    setTimeout(() => {
      this.runCleanup()
    }, 60000)

    this.cleanupInterval = setInterval(
      () => {
        this.runCleanup()
      },
      24 * 60 * 60 * 1000
    )

    console.log('✅ Scheduler started - cleanup will run daily')
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.isRunning = false
    console.log('🛑 Scheduler stopped')
  }

  private async runCleanup() {
    try {
      console.log('⏰ Scheduled cleanup starting...')
      await dataCleanupJob.run()
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error)
    }
  }

  async triggerCleanup() {
    console.log('🔧 Manually triggering cleanup...')
    await dataCleanupJob.run()
  }
}

export const scheduler = new Scheduler()
