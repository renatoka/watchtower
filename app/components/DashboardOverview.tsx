'use client'

import { useState, useEffect } from 'react'
import { UptimeStatistics } from '@/app/lib/types'
import { apiClient } from '@/app/lib/api-client'
import { StatusCard } from './StatusCard'
import { RefreshCw, Plus, AlertCircle } from 'lucide-react'

export function DashboardOverview() {
  const [statistics, setStatistics] = useState<UptimeStatistics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    try {
      setError(null)
      const data = await apiClient.getAllUptimeStatuses()
      setStatistics(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await fetchData()
  }

  const handleInitializeSampleData = async () => {
    try {
      await apiClient.initializeSampleData()
      // Wait a moment for monitoring to start
      setTimeout(() => {
        fetchData()
      }, 2000)
    } catch (err) {
      setError('Failed to initialize sample data')
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate summary stats
  const totalEndpoints = statistics.length
  const upEndpoints = statistics.filter((s) => s.currentStatus === 'UP').length
  const downEndpoints = totalEndpoints - upEndpoints
  const avgUptime =
    statistics.length > 0
      ? statistics.reduce((sum, s) => sum + s.uptimePercentage, 0) /
        statistics.length
      : 0

  if (loading && statistics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            API Monitoring Dashboard
          </h1>
          <p className="text-gray-600">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>

          <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Endpoint
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && statistics.length === 0 && !error && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No endpoints configured
          </h3>
          <p className="text-gray-600 mb-4">
            Get started by adding some sample endpoints to monitor.
          </p>
          <button
            onClick={handleInitializeSampleData}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Initialize Sample Data
          </button>
        </div>
      )}

      {/* Summary Stats */}
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

      {/* Endpoints Grid */}
      {statistics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statistics.map((stat) => (
            <StatusCard
              key={stat.endpointId}
              statistics={stat}
              onClick={() => {
                // TODO: Navigate to detailed view
                console.log('View details for:', stat.endpointName)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
