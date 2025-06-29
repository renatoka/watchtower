import { NextResponse } from 'next/server';
import { testConnection } from '@/app/lib/database';

export async function GET() {
  const timestamp = new Date();

  try {
    // Test database connection
    const dbHealthy = await testConnection();

    const status = dbHealthy ? 'healthy' : 'degraded';

    return NextResponse.json(
      {
        success: true,
        data: {
          status,
          services: {
            database: dbHealthy ? 'healthy' : 'unhealthy',
            monitoring: 'healthy', // You can add monitoring service status here
          },
          timestamp,
        },
      },
      {
        status: dbHealthy ? 200 : 503,
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Service unhealthy',
        services: {
          database: 'unhealthy',
          monitoring: 'unknown',
        },
        timestamp,
      },
      { status: 503 }
    );
  }
}
