'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import type { UptimeStatistics, UptimeCheck } from '@/app/lib/types';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/app/lib/websocket-server';

interface SystemMessage {
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: Date;
}

interface UseRealtimeUpdatesOptions {
  autoConnect?: boolean;
  endpointId?: string;
}

export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions = {}
) {
  const { autoConnect = true, endpointId } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<UptimeStatistics[]>([]);
  const [recentChecks, setRecentChecks] = useState<UptimeCheck[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // Get WebSocket URL - Updated logic for integrated server
  const getWebSocketUrl = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (wsUrl) {
      console.log('🌐 Using configured WebSocket URL:', wsUrl);
      return wsUrl;
    }

    // For integrated server, use the same port as the main app
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    const port = window.location.port || '3000'; // Use same port as main app
    const fallbackUrl = `${protocol}//${hostname}:${port}`;

    console.log('⚠️ NEXT_PUBLIC_WS_URL not set, using same port as app:', fallbackUrl);
    return fallbackUrl;
  };

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔌 Already connected, skipping...');
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('🔌 Connecting to WebSocket:', wsUrl);

    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true, // Force new connection
    });

    // Connection successful
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;

      // Subscribe to updates
      if (endpointId) {
        console.log('📡 Subscribing to endpoint:', endpointId);
        newSocket.emit('subscribe', endpointId);
      } else {
        console.log('📡 Subscribing to global updates');
        newSocket.emit('subscribe');
      }

      // Request initial data
      console.log('🔄 Requesting full update...');
      newSocket.emit('requestFullUpdate');
    });

    // Connection failed
    newSocket.on('connect_error', (error: any) => {
      console.error('❌ WebSocket connection error:', error);
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    // Disconnection handling
    newSocket.on('disconnect', (reason: any) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);

      // Don't auto-reconnect if manually disconnected
      if (reason === 'io client disconnect') return;

      // Auto-reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

        setTimeout(() => {
          if (socketRef.current) {
            newSocket.connect();
          }
        }, delay);
      } else {
        setConnectionError('Unable to connect after multiple attempts');
      }
    });

    // Data event handlers
    newSocket.on('uptimeUpdate', (data: UptimeStatistics) => {
      console.log('📊 Received uptime update:', data);
      setStatistics((prev) => {
        const index = prev.findIndex((s) => s.endpointId === data.endpointId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        } else {
          return [...prev, data];
        }
      });
    });

    newSocket.on('newCheck', (data: UptimeCheck) => {
      console.log('🔍 Received new check:', data);
      setRecentChecks((prev) => [data, ...prev.slice(0, 49)]);
    });

    newSocket.on('bulkUpdate', (data: UptimeStatistics[]) => {
      console.log('📊 Received bulk update:', data.length, 'statistics');
      setStatistics(data);
    });

    newSocket.on('systemStatus', (data: any) => {
      console.log('💬 System message:', data);
      const message: SystemMessage = {
        ...data,
        timestamp: new Date(),
      };

      setSystemMessages((prev) => [message, ...prev.slice(0, 19)]);

      // Auto-clear info messages
      if (data.type === 'info') {
        setTimeout(() => {
          setSystemMessages((prev) => prev.filter((m) => m !== message));
        }, 5000);
      }
    });

    socketRef.current = newSocket;
  }, [endpointId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Manually disconnecting WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnect requested');
    disconnect();
    setTimeout(connect, 1000);
  }, [connect, disconnect]);

  const clearMessages = useCallback(() => {
    setSystemMessages([]);
  }, []);

  // Initialize connection
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [autoConnect, connect]);

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
        socketRef.current.emit('subscribe', id);
      }
    },
    unsubscribeFromEndpoint: (id: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('unsubscribe', id);
      }
    },
  };
}