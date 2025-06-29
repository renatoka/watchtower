// lib/types.ts
export interface Endpoint {
  id: string;
  name: string;
  url: string;
  checkInterval: number; // seconds
  timeout: number; // seconds
  expectedStatus: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UptimeCheck {
  id: string;
  endpointId: string;
  endpointName: string;
  status: 'UP' | 'DOWN';
  statusCode: number;
  responseTime: number; // milliseconds
  timestamp: Date;
  errorReason?: string;
}

export interface UptimeStatistics {
  endpointId: string;
  endpointName: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptimePercentage: number;
  averageResponseTime: number;
  lastCheck: Date;
  currentStatus: 'UP' | 'DOWN';
  consecutiveFailures: number;
  recentChecks: UptimeCheck[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
