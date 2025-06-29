import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initializeWebSocketServer } from './app/lib/websocket-server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10) // Changed to 3000 for development

console.log(`🚀 Starting ${dev ? 'development' : 'production'} server...`)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  console.log('✅ Next.js app prepared')

  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      handle(req, res, parsedUrl)
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize WebSocket server
  console.log('🔌 Initializing WebSocket server...')
  initializeWebSocketServer(server)

  server
    .once('error', (err) => {
      console.error('❌ Server error:', err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`🚀 Server ready on http://${hostname}:${port}`)
      console.log(`📡 WebSocket server ready on ws://${hostname}:${port}`)

      if (dev) {
        console.log('🔄 Auto-initializing monitoring engine...')
        setTimeout(async () => {
          try {
            const { monitoringEngine } = await import('./app/lib/monitoring')
            await monitoringEngine.startMonitoring()
            console.log('✅ Monitoring engine started automatically')
          } catch (error) {
            console.error('❌ Failed to auto-start monitoring:', error)
          }
        }, 3000) // Wait 3 seconds for database to be ready
      }
    })
})
