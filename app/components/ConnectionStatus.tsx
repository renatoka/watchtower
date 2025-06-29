'use client'

import { Wifi, WifiOff, AlertTriangle } from 'lucide-react'

interface ConnectionStatusProps {
  isConnected: boolean
  error?: string | null
}

export function ConnectionStatus({
  isConnected,
  error,
}: ConnectionStatusProps) {
  if (error) {
    return (
      <div className="flex items-center text-red-600">
        <AlertTriangle className="w-4 h-4 mr-1" />
        <span className="text-sm">Connection Error</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center ${
        isConnected ? 'text-green-600' : 'text-yellow-600'
      }`}
    >
      {isConnected ? (
        <Wifi className="w-4 h-4 mr-1" />
      ) : (
        <WifiOff className="w-4 h-4 mr-1" />
      )}
      <span className="text-sm">{isConnected ? 'Live' : 'Connecting...'}</span>
      {isConnected && (
        <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  )
}
