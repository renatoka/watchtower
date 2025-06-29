import { NextRequest, NextResponse } from 'next/server';
import { monitoringEngine } from '@/app/lib/monitoring';
import { ApiResponse, UptimeStatistics } from '@/app/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date();
  const endpointId = params.id;

  try {
    const statistics = await monitoringEngine.getUptimeStatistics(
      endpointId
    );

    if (!statistics) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Endpoint not found',
          timestamp,
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<UptimeStatistics>>({
      success: true,
      data: statistics,
      timestamp,
    });
  } catch (error) {
    console.error(
      `Error fetching statistics for endpoint ${endpointId}:`,
      error
    );

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch statistics',
        timestamp,
      },
      { status: 500 }
    );
  }
}
