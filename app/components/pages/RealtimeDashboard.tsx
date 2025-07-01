'use client'

import { useState, useEffect } from 'react'
import { UptimeStatistics } from '@/app/lib/types'
import { useRealtimeUpdates } from '@/app/hooks/useRealtimeUpdates'
import { StatusCard } from '../StatusCard'
import { RefreshCw, Plus, Wifi, WifiOff } from 'lucide-react'
import { ConnectionStatus } from '../ConnectionStatus'
import { SystemMessages } from '../SystemMessages'
import { useRouter } from 'next/navigation'

export function RealtimeDashboard() {
  const router = useRouter()
  const {
    isConnected,
    connectionError,
    statistics,
    recentChecks,
    systemMessages,
    reconnect,
    clearMessages,
  } = useRealtimeUpdates({ autoConnect: true })

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setLastUpdate(new Date())
  }, [])

  useEffect(() => {
    if (statistics.length > 0 && isClient) {
      setLastUpdate(new Date())
    }
  }, [statistics, isClient])

  const totalEndpoints = statistics.length
  const upEndpoints = statistics.filter((s) => s.currentStatus === 'UP').length
  const downEndpoints = totalEndpoints - upEndpoints
  const avgUptime =
    statistics.length > 0
      ? statistics.reduce((sum, s) => sum + s.uptimePercentage, 0) /
        statistics.length
      : 0

  const renderLastUpdate = () => {
    if (!isClient || !lastUpdate) {
      return <span className="text-sm text-gray-600">Loading...</span>
    }

    return (
      <span className="text-sm text-gray-600">
        Last update: {lastUpdate.toLocaleTimeString()}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            API Monitoring Dashboard
            <span className="ml-3 text-sm font-normal text-gray-500">
              Real-time
            </span>
          </h1>
          <div className="flex items-center space-x-4 mt-1">
            <ConnectionStatus
              isConnected={isConnected}
              error={connectionError}
            />
            {renderLastUpdate()}
          </div>
        </div>
      </div>

      <SystemMessages messages={systemMessages} onClear={clearMessages} />

      {statistics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">
              {totalEndpoints}
            </div>
            <div className="text-sm text-gray-600">Total Endpoints</div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">
              {upEndpoints}
            </div>
            <div className="text-sm text-gray-600">Online</div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-red-600">
              {downEndpoints}
            </div>
            <div className="text-sm text-gray-600">Offline</div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">
              {avgUptime.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Avg Uptime</div>
          </div>
        </div>
      )}

      {statistics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statistics.map((stat) => (
            <StatusCard
              key={stat.endpointId}
              statistics={stat}
              isRealTime={true}
              onClick={() => {
                console.log('View details for:', stat.endpointName)
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <RefreshCw className="inline-block w-6 h-6 mb-2" />
            <p className="text-lg font-semibold">No endpoints monitored yet</p>
            <p className="text-sm">Add your first endpoint to get started.</p>
            <button
              onClick={() => {
                router.push('/endpoints/new')
              }}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Endpoint
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
