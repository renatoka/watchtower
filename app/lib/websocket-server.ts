import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { UptimeStatistics, UptimeCheck } from './types'

export interface ServerToClientEvents {
  uptimeUpdate: (data: UptimeStatistics) => void
  newCheck: (data: UptimeCheck) => void
  systemStatus: (data: {
    message: string
    type: 'info' | 'warning' | 'error'
  }) => void
  bulkUpdate: (data: UptimeStatistics[]) => void
}

export interface ClientToServerEvents {
  subscribe: (endpointId?: string) => void
  unsubscribe: (endpointId?: string) => void
  requestFullUpdate: () => void
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null

export function initializeWebSocketServer(server: HTTPServer) {
  if (io) {
    return io
  }

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`)

    // Handle subscription to specific endpoints
    socket.on('subscribe', (endpointId) => {
      if (endpointId) {
        socket.join(`endpoint:${endpointId}`)
        console.log(
          `📡 Client ${socket.id} subscribed to endpoint: ${endpointId}`
        )
      } else {
        socket.join('global')
        console.log(`📡 Client ${socket.id} subscribed to global updates`)
      }
    })

    // Handle unsubscription
    socket.on('unsubscribe', (endpointId) => {
      if (endpointId) {
        socket.leave(`endpoint:${endpointId}`)
        console.log(
          `📡 Client ${socket.id} unsubscribed from endpoint: ${endpointId}`
        )
      } else {
        socket.leave('global')
        console.log(`📡 Client ${socket.id} unsubscribed from global updates`)
      }
    })

    // Handle request for full update
    socket.on('requestFullUpdate', async () => {
      try {
        console.log(`📡 Client ${socket.id} requested full update`)

        const { monitoringEngine } = await import('./monitoring')

        // Get all current statistics
        const allStatistics = await monitoringEngine.getAllUptimeStatuses()

        if (allStatistics.length > 0) {
          // Send bulk update to requesting client
          socket.emit('bulkUpdate', allStatistics)
          console.log(
            `📊 Sent bulk update to ${socket.id}: ${allStatistics.length} endpoints`
          )
        } else {
          // No data available
          socket.emit('systemStatus', {
            message: 'No monitoring data available yet',
            type: 'info',
          })
          console.log(`ℹ️ No data available for ${socket.id}`)
        }
      } catch (error) {
        console.error('❌ Failed to send full update:', error)
        socket.emit('systemStatus', {
          message: 'Failed to fetch latest monitoring data',
          type: 'error',
        })
      }
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)
    })

    // Send initial connection success message
    socket.emit('systemStatus', {
      message: 'Connected to real-time updates',
      type: 'info',
    })
  })

  console.log('🚀 WebSocket server initialized')
  return io
}

export function getWebSocketServer(): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
> | null {
  return io
}

export function broadcastUptimeUpdate(statistics: UptimeStatistics) {
  if (io) {
    io.to('global').emit('uptimeUpdate', statistics)

    io.to(`endpoint:${statistics.endpointId}`).emit('uptimeUpdate', statistics)
  }
}

export function broadcastNewCheck(check: UptimeCheck) {
  if (io) {
    io.to('global').emit('newCheck', check)
    io.to(`endpoint:${check.endpointId}`).emit('newCheck', check)
  }
}

export function broadcastSystemStatus(
  message: string,
  type: 'info' | 'warning' | 'error'
) {
  if (io) {
    io.to('global').emit('systemStatus', { message, type })
  }
}
