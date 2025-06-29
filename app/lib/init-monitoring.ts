import { monitoringEngine } from './monitoring'

let isInitialized = false

export async function initializeMonitoring() {
  if (isInitialized) {
    return
  }

  try {
    await monitoringEngine.startMonitoring()
    isInitialized = true
    console.log('Monitoring engine initialized successfully')
  } catch (error) {
    console.error('Failed to initialize monitoring:', error)
  }
}

// Auto-initialize in development
if (process.env.NODE_ENV === 'development') {
  initializeMonitoring()
}
