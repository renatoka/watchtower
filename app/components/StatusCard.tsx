'use client';

import { UptimeStatistics } from '@/app/lib/types';
import {
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface StatusCardProps {
  statistics: UptimeStatistics;
  onClick?: () => void;
  isRealTime?: boolean;
}

export function StatusCard({ statistics, onClick }: StatusCardProps) {
  const getStatusColor = (
    status: string,
    uptimePercentage: number
  ) => {
    if (status === 'DOWN') return 'bg-red-500';
    if (uptimePercentage < 95) return 'bg-yellow-500';
    if (uptimePercentage < 99) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (status: string) => {
    return status === 'UP' ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-red-600" />
    );
  };

  const formatLastCheck = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {statistics.endpointName}
        </h3>
        {getStatusIcon(statistics.currentStatus)}
      </div>

      {/* Status Indicator */}
      <div className="flex items-center mb-3">
        <div
          className={`w-3 h-3 rounded-full ${getStatusColor(
            statistics.currentStatus,
            statistics.uptimePercentage
          )} mr-2`}
        />
        <span
          className={`text-sm font-medium ${
            statistics.currentStatus === 'UP'
              ? 'text-green-600'
              : 'text-red-600'
          }`}
        >
          {statistics.currentStatus}
        </span>
        {statistics.consecutiveFailures > 0 && (
          <span className="ml-2 text-xs text-red-500">
            ({statistics.consecutiveFailures} failures)
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Activity className="w-4 h-4 mr-1" />
            Uptime
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {statistics.uptimePercentage.toFixed(1)}%
          </div>
        </div>

        <div>
          <div className="flex items-center text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4 mr-1" />
            Avg Response
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {statistics.averageResponseTime.toFixed(0)}ms
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>Last check: {formatLastCheck(statistics.lastCheck)}</div>
        <div>{statistics.totalChecks} checks in 24h</div>
      </div>
    </div>
  );
}
