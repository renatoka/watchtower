'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import type { UptimeStatistics, UptimeCheck } from '@/app/lib/types'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/app/lib/websocket-server'

interface SystemMessage {
  id: string // Add ID for proper React keys
  message: string
  type: 'info' | 'warning' | 'error'
  timestamp: Date
}

interface UseRealtimeUpdatesOptions {
  autoConnect?: boolean
  endpointId?: string
  maxReconnectAttempts?: number
  maxMessages?: number
  maxRecentChecks?: number
}

const DEFAULT_MAX_MESSAGES = 50
const DEFAULT_MAX_RECENT_CHECKS = 100
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_INTERVAL_BASE = 1000 // 1 second
const RECONNECT_INTERVAL_MAX = 30000 // 30 seconds

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const {
    autoConnect = true,
    endpointId,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    maxMessages = DEFAULT_MAX_MESSAGES,
    maxRecentChecks = DEFAULT_MAX_RECENT_CHECKS,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<UptimeStatistics[]>([])
  const [recentChecks, setRecentChecks] = useState<UptimeCheck[]>([])
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([])

  const reconnectAttempts = useRef(0)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageIdCounter = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const getWebSocketUrl = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL
    if (wsUrl) {
      return wsUrl
    }

    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const hostname = window.location.hostname
    const port = window.location.port || '3000'
    return `${protocol}//${hostname}:${port}`
  }

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }

    if (!isMountedRef.current) {
      setIsConnected(false)
      setConnectionError(null)
      setStatistics([])
      setRecentChecks([])
      setSystemMessages([])
    }
  }, [])

  const connect = useCallback(() => {
    if (socketRef.current?.connected || !isMountedRef.current) {
      return
    }

    const wsUrl = getWebSocketUrl()
    console.log('🔌 Connecting to WebSocket:', wsUrl)

    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: false, // Handle reconnection manually
    })

    socket.on('connect', () => {
      if (!isMountedRef.current) return

      console.log('✅ WebSocket connected successfully')
      setIsConnected(true)
      setConnectionError(null)
      reconnectAttempts.current = 0

      if (endpointId) {
        socket.emit('subscribe', endpointId)
      } else {
        socket.emit('subscribe')
      }

      console.log('🔄 Requesting full update...')
      socket.emit('requestFullUpdate')
    })

    socket.on('connect_error', (error: Error) => {
      if (!isMountedRef.current) return

      console.error('❌ WebSocket connection error:', error.message)
      setConnectionError(`Connection failed: ${error.message}`)
      setIsConnected(false)

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        const delay = Math.min(
          RECONNECT_INTERVAL_BASE * Math.pow(2, reconnectAttempts.current - 1),
          RECONNECT_INTERVAL_MAX
        )

        console.log(
          `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`
        )

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            cleanup()
            connect()
          }
        }, delay)
      } else {
        setConnectionError('Unable to connect after multiple attempts')
      }
    })

    socket.on('disconnect', (reason: string) => {
      if (!isMountedRef.current) return

      console.log('🔌 WebSocket disconnected:', reason)
      setIsConnected(false)

      if (reason === 'io client disconnect') return

      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = RECONNECT_INTERVAL_BASE
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect()
          }
        }, delay)
      }
    })

    socket.on('uptimeUpdate', (data: UptimeStatistics) => {
      if (!isMountedRef.current) return

      setStatistics((prev) => {
        const index = prev.findIndex((s) => s.endpointId === data.endpointId)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = data
          return updated
        } else {
          const newStats = [...prev, data]
          return newStats.slice(-100) // Keep last 100 endpoints
        }
      })
    })

    socket.on('newCheck', (data: UptimeCheck) => {
      if (!isMountedRef.current) return

      setRecentChecks((prev) => {
        const updated = [data, ...prev]
        return updated.slice(0, maxRecentChecks)
      })
    })

    socket.on('bulkUpdate', (data: UptimeStatistics[]) => {
      if (!isMountedRef.current) return

      setStatistics((prev) => {
        const statsMap = new Map(prev.map((s) => [s.endpointId, s]))
        data.forEach((stat) => statsMap.set(stat.endpointId, stat))

        return Array.from(statsMap.values()).slice(-100)
      })
    })

    socket.on(
      'systemStatus',
      (data: { message: string; type: 'info' | 'warning' | 'error' }) => {
        if (!isMountedRef.current) return

        const message: SystemMessage = {
          id: `msg-${Date.now()}-${messageIdCounter.current++}`,
          ...data,
          timestamp: new Date(),
        }

        setSystemMessages((prev) => {
          const updated = [message, ...prev]
          return updated.slice(0, maxMessages)
        })

        if (data.type === 'info') {
          setTimeout(() => {
            if (isMountedRef.current) {
              setSystemMessages((prev) =>
                prev.filter((m) => m.id !== message.id)
              )
            }
          }, 5000)
        }
      }
    )

    socketRef.current = socket
  }, [endpointId, maxReconnectAttempts, maxMessages, maxRecentChecks, cleanup])

  const disconnect = useCallback(() => {
    console.log('🔌 Manually disconnecting WebSocket')
    cleanup()
  }, [cleanup])

  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnect requested')
    reconnectAttempts.current = 0 // Reset attempts for manual reconnect
    cleanup()
    setTimeout(() => {
      if (isMountedRef.current) {
        connect()
      }
    }, 100)
  }, [connect, cleanup])

  const clearMessages = useCallback(() => {
    setSystemMessages([])
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      cleanup()
    }
  }, [autoConnect, connect, cleanup])

  return {
    isConnected,
    connectionError,
    statistics,
    recentChecks,
    systemMessages,
    connect,
    disconnect,
    reconnect,
    clearMessages,
    subscribeToEndpoint: (id: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('subscribe', id)
      }
    },
    unsubscribeFromEndpoint: (id: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe', id)
      }
    },
  }
}
