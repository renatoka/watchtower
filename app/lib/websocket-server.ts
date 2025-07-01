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

const MAX_CLIENTS = 100
const MAX_ROOMS_PER_CLIENT = 10
const CLIENT_TIMEOUT = 5 * 60 * 1000 // 5 minutes

const clientRooms = new Map<string, Set<string>>()
const clientLastActivity = new Map<string, number>()

setInterval(() => {
  const now = Date.now()
  for (const [socketId, lastActivity] of clientLastActivity.entries()) {
    if (now - lastActivity > CLIENT_TIMEOUT) {
      console.log(`🧹 Cleaning up inactive client: ${socketId}`)
      const socket = io?.sockets.sockets.get(socketId)
      if (socket) {
        socket.disconnect(true)
      }
      clientRooms.delete(socketId)
      clientLastActivity.delete(socketId)
    }
  }
}, 60000) // Run every minute

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

    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 10000,
  })

  io.use((socket, next) => {
    if (io!.sockets.sockets.size >= MAX_CLIENTS) {
      console.warn(
        `⚠️ Rejecting connection - max clients (${MAX_CLIENTS}) reached`
      )
      return next(new Error('Server at capacity'))
    }
    next()
  })

  io.on('connection', (socket) => {
    console.log(
      `🔌 Client connected: ${socket.id} (${io!.sockets.sockets.size} total)`
    )

    clientRooms.set(socket.id, new Set())
    clientLastActivity.set(socket.id, Date.now())

    socket.use((event, next) => {
      clientLastActivity.set(socket.id, Date.now())
      next()
    })

    socket.on('subscribe', (endpointId) => {
      const rooms = clientRooms.get(socket.id) || new Set()

      if (rooms.size >= MAX_ROOMS_PER_CLIENT) {
        socket.emit('systemStatus', {
          message: 'Subscription limit reached',
          type: 'error',
        })
        return
      }

      if (endpointId) {
        const room = `endpoint:${endpointId}`
        socket.join(room)
        rooms.add(room)
        console.log(
          `📡 Client ${socket.id} subscribed to endpoint: ${endpointId}`
        )
      } else {
        socket.join('global')
        rooms.add('global')
        console.log(`📡 Client ${socket.id} subscribed to global updates`)
      }

      clientRooms.set(socket.id, rooms)
    })

    socket.on('unsubscribe', (endpointId) => {
      const rooms = clientRooms.get(socket.id) || new Set()

      if (endpointId) {
        const room = `endpoint:${endpointId}`
        socket.leave(room)
        rooms.delete(room)
        console.log(
          `📡 Client ${socket.id} unsubscribed from endpoint: ${endpointId}`
        )
      } else {
        socket.leave('global')
        rooms.delete('global')
        console.log(`📡 Client ${socket.id} unsubscribed from global updates`)
      }

      clientRooms.set(socket.id, rooms)
    })

    socket.on('requestFullUpdate', async () => {
      try {
        console.log(`📡 Client ${socket.id} requested full update`)

        const { monitoringEngine } = await import('./monitoring')

        const allStatistics = await monitoringEngine.getAllUptimeStatuses()

        if (allStatistics.length > 0) {
          const CHUNK_SIZE = 20
          for (let i = 0; i < allStatistics.length; i += CHUNK_SIZE) {
            const chunk = allStatistics.slice(i, i + CHUNK_SIZE)
            socket.emit('bulkUpdate', chunk)

            if (i + CHUNK_SIZE < allStatistics.length) {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }

          console.log(
            `📊 Sent ${allStatistics.length} statistics to ${socket.id}`
          )
        } else {
          socket.emit('systemStatus', {
            message: 'No monitoring data available yet',
            type: 'info',
          })
        }
      } catch (error) {
        console.error('❌ Failed to send full update:', error)
        socket.emit('systemStatus', {
          message: 'Failed to fetch latest monitoring data',
          type: 'error',
        })
      }
    })

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)

      clientRooms.delete(socket.id)
      clientLastActivity.delete(socket.id)

      console.log(`📊 Active connections: ${io!.sockets.sockets.size}`)
    })

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
  if (!io) return

  try {
    io.to('global').emit('uptimeUpdate', statistics)

    io.to(`endpoint:${statistics.endpointId}`).emit('uptimeUpdate', statistics)
  } catch (error) {
    console.error('❌ Failed to broadcast uptime update:', error)
  }
}

export function broadcastNewCheck(check: UptimeCheck) {
  if (!io) return

  try {
    io.to('global').emit('newCheck', check)
    io.to(`endpoint:${check.endpointId}`).emit('newCheck', check)
  } catch (error) {
    console.error('❌ Failed to broadcast new check:', error)
  }
}

export function broadcastSystemStatus(
  message: string,
  type: 'info' | 'warning' | 'error'
) {
  if (!io) return

  try {
    io.to('global').emit('systemStatus', { message, type })
  } catch (error) {
    console.error('❌ Failed to broadcast system status:', error)
  }
}

export function shutdownWebSocketServer() {
  if (io) {
    console.log('🛑 Shutting down WebSocket server...')
    io.close(() => {
      console.log('✅ WebSocket server shut down')
    })
    io = null
  }
}
