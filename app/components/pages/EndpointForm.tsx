'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, X, AlertCircle } from 'lucide-react'
import { apiClient } from '@/app/lib/api-client'
import { Endpoint } from '@/app/lib/types'

interface EndpointFormData {
  name: string
  url: string
  checkInterval: number
  timeout: number
  expectedStatus: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  enabled: boolean
  tags: string[]
}

interface EndpointFormProps {
  endpointId?: string
}

export function EndpointForm({ endpointId }: EndpointFormProps) {
  const router = useRouter()
  const isEditing = !!endpointId

  const [formData, setFormData] = useState<EndpointFormData>({
    name: '',
    url: '',
    checkInterval: 30,
    timeout: 5,
    expectedStatus: 200,
    severity: 'medium',
    enabled: true,
    tags: [],
  })

  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingEndpoint, setLoadingEndpoint] = useState(isEditing)
  const [error, setError] = useState<string | null>(null)

  // Load endpoint data if editing
  useEffect(() => {
    if (isEditing && endpointId) {
      loadEndpoint(endpointId)
    }
  }, [isEditing, endpointId])

  const loadEndpoint = async (id: string) => {
    try {
      setLoadingEndpoint(true)
      const endpoint = await apiClient.getEndpoint(id)

      if (!endpoint) {
        setError('Endpoint not found')
        return
      }

      setFormData({
        name: endpoint.name,
        url: endpoint.url,
        checkInterval: endpoint.checkInterval,
        timeout: endpoint.timeout,
        expectedStatus: endpoint.expectedStatus,
        severity: endpoint.severity,
        enabled: endpoint.enabled,
        tags: [...endpoint.tags],
      })
    } catch (err) {
      setError('Failed to load endpoint')
    } finally {
      setLoadingEndpoint(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Name is required')
      }
      if (!formData.url.trim()) {
        throw new Error('URL is required')
      }
      if (
        !formData.url.startsWith('http://') &&
        !formData.url.startsWith('https://')
      ) {
        throw new Error('URL must start with http:// or https://')
      }
      if (formData.checkInterval < 5) {
        throw new Error('Check interval must be at least 5 seconds')
      }
      if (formData.timeout < 1) {
        throw new Error('Timeout must be at least 1 second')
      }

      if (isEditing && endpointId) {
        // Update existing endpoint
        await apiClient.updateEndpoint(endpointId, formData)
      } else {
        // Create new endpoint
        await apiClient.createEndpoint(formData)
      }

      // Navigate back to endpoints list
      router.push('/endpoints')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save endpoint')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const handleBack = () => {
    router.push('/endpoints')
  }

  if (loadingEndpoint) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-gray-600">Loading endpoint...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Endpoints
          </button>
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Endpoint' : 'Add New Endpoint'}
            </h1>
            <p className="text-gray-600">
              {isEditing
                ? 'Update your endpoint configuration'
                : 'Configure a new endpoint for monitoring'}
            </p>
          </div> */}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Payment API"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity Level
              </label>
              <select
                value={formData.severity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    severity: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  url: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://api.example.com/health"
              disabled={loading}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              The URL that will be monitored for uptime and response time
            </p>
          </div>

          {/* Monitoring Configuration */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Monitoring Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check Interval (seconds)
                </label>
                <input
                  type="number"
                  value={formData.checkInterval}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      checkInterval: parseInt(e.target.value) || 30,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="5"
                  disabled={loading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  How often to check the endpoint (minimum 5 seconds)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={formData.timeout}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      timeout: parseInt(e.target.value) || 5,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  disabled={loading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum time to wait for a response
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Status Code
                </label>
                <input
                  type="number"
                  value={formData.expectedStatus}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      expectedStatus: parseInt(e.target.value) || 200,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="100"
                  max="599"
                  disabled={loading}
                />
                <p className="mt-1 text-sm text-gray-500">
                  HTTP status code that indicates success
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    disabled={loading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add tag and press Enter"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
                disabled={loading || !tagInput.trim()}
              >
                Add Tag
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Tags help organize and filter your endpoints
            </p>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <div className="ml-3">
              <label
                htmlFor="enabled"
                className="text-sm font-medium text-gray-700"
              >
                Enable monitoring for this endpoint
              </label>
              <p className="text-sm text-gray-500">
                When enabled, this endpoint will be monitored according to the
                configured interval
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Update Endpoint' : 'Create Endpoint'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
