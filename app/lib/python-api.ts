import { UptimeStatistics, Endpoint } from './types';

const PYTHON_API_URL =
  process.env.PYTHON_API_URL || 'http://localhost:8000';

export class PythonApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = PYTHON_API_URL;
  }

  async fetchAllUptimeStatuses(): Promise<UptimeStatistics[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/uptime/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 seconds
      });

      if (!response.ok) {
        throw new Error(
          `Python API responded with status: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        'Failed to fetch uptime statuses from Python service:',
        error
      );
      throw new Error('Failed to connect to monitoring service');
    }
  }

  async fetchUptimeStatistics(
    endpointId: string
  ): Promise<UptimeStatistics> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/uptime/statistics/${endpointId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Endpoint not found');
        }
        throw new Error(
          `Python API responded with status: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `Failed to fetch statistics for endpoint ${endpointId}:`,
        error
      );
      throw error;
    }
  }

  async getEndpoints(): Promise<Endpoint[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/endpoints`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `Python API responded with status: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        'Failed to fetch endpoints from Python service:',
        error
      );
      throw new Error('Failed to connect to monitoring service');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const pythonApi = new PythonApiClient();
