import { ApiResponse, UptimeStatistics, Endpoint } from './types'

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || ''

export class ApiClient {
    private async fetchApi<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<ApiResponse<T>> {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
                ...options,
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`)
            }

            return data
        } catch (error) {
            throw new Error(
                error instanceof Error ? error.message : 'Network error'
            )
        }
    }

    async getAllUptimeStatuses(): Promise<UptimeStatistics[]> {
        const response = await this.fetchApi<UptimeStatistics[]>('/api/uptime')
        return response.data || []
    }

    async getUptimeStatistics(
        endpointId: string
    ): Promise<UptimeStatistics | null> {
        try {
            const response = await this.fetchApi<UptimeStatistics>(
                `/api/uptime/${endpointId}`
            )
            return response.data || null
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return null
            }
            throw error
        }
    }

    async getAllEndpoints(): Promise<Endpoint[]> {
        const response = await this.fetchApi<Endpoint[]>('/api/endpoints')
        return response.data || []
    }

    async createEndpoint(
        endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<{ id: string }> {
        const response = await this.fetchApi<{ id: string }>('/api/endpoints', {
            method: 'POST',
            body: JSON.stringify(endpoint),
        })
        return response.data!
    }

    async updateEndpoint(
        id: string,
        endpoint: Partial<Endpoint>
    ): Promise<void> {
        await this.fetchApi(`/api/endpoints/${id}`, {
            method: 'PUT',
            body: JSON.stringify(endpoint),
        })
    }

    async deleteEndpoint(id: string): Promise<void> {
        await this.fetchApi(`/api/endpoints/${id}`, {
            method: 'DELETE',
        })
    }

    async getHealth(): Promise<any> {
        const response = await this.fetchApi('/api/health')
        return response.data
    }

    async initializeSampleData(): Promise<void> {
        await this.fetchApi('/api/admin/init-sample-data', {
            method: 'POST',
        })
    }
}

export const apiClient = new ApiClient()
