'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Save, AlertCircle, Check } from 'lucide-react'
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

function EndpointFormModal({
  isOpen,
  onClose,
  endpoint,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  endpoint?: Endpoint
  onSave: (data: EndpointFormData) => Promise<void>
}) {
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (endpoint) {
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
    } else {
      setFormData({
        name: '',
        url: '',
        checkInterval: 30,
        timeout: 5,
        expectedStatus: 200,
        severity: 'medium',
        enabled: true,
        tags: [],
      })
    }
    setError(null)
  }, [endpoint, isOpen])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
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

      await onSave(formData)
      onClose()
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {endpoint ? 'Edit Endpoint' : 'Add New Endpoint'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Payment API"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <select
                value={formData.severity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    severity: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.example.com/health"
              disabled={loading}
            />
          </div>

          {/* Monitoring Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="5"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="100"
                max="599"
                disabled={loading}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add tag and press Enter"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
                disabled={loading || !tagInput.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center">
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
            <label
              htmlFor="enabled"
              className="ml-2 text-sm font-medium text-gray-700"
            >
              Enable monitoring for this endpoint
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {endpoint ? 'Update' : 'Create'} Endpoint
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  endpoint,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  endpoint?: Endpoint
  loading: boolean
}) {
  if (!isOpen || !endpoint) return null

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Endpoint
            </h3>
          </div>

          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>{endpoint.name}</strong>?
            This action cannot be undone and will stop all monitoring for this
            endpoint.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EndpointManagement() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | undefined>()
  const [deletingEndpoint, setDeletingEndpoint] = useState<
    Endpoint | undefined
  >()
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadEndpoints()
  }, [])

  const loadEndpoints = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getAllEndpoints()
      setEndpoints(data)
      setError(null)
    } catch (err) {
      setError('Failed to load endpoints')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingEndpoint(undefined)
    setShowFormModal(true)
  }

  const handleEdit = (endpoint: Endpoint) => {
    setEditingEndpoint(endpoint)
    setShowFormModal(true)
  }

  const handleDelete = (endpoint: Endpoint) => {
    setDeletingEndpoint(endpoint)
    setShowDeleteModal(true)
  }

  const handleSave = async (formData: EndpointFormData) => {
    if (editingEndpoint) {
      await apiClient.updateEndpoint(editingEndpoint.id, formData)
      setEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === editingEndpoint.id
            ? { ...ep, ...formData, updatedAt: new Date() }
            : ep
        )
      )
    } else {
      const { id } = await apiClient.createEndpoint(formData)
      const newEndpoint: Endpoint = {
        id,
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setEndpoints((prev) => [...prev, newEndpoint])
    }

    setTimeout(() => {
      loadEndpoints()
    }, 1000)
  }

  const confirmDelete = async () => {
    if (!deletingEndpoint) return

    try {
      setDeleteLoading(true)
      await apiClient.deleteEndpoint(deletingEndpoint.id)
      setEndpoints((prev) => prev.filter((ep) => ep.id !== deletingEndpoint.id))
      setShowDeleteModal(false)
      setDeletingEndpoint(undefined)
    } catch (err) {
      setError('Failed to delete endpoint')
    } finally {
      setDeleteLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Endpoint Management
          </h1>
          <p className="text-gray-600">Manage your monitoring endpoints</p>
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Endpoint
        </button>
      </div>

      {/* Error Message */}
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

      {/* Endpoints Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : endpoints.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No endpoints configured
          </h3>
          <p className="text-gray-600">
            Get started by adding your first endpoint to monitor.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check Interval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {endpoint.name}
                        </div>
                        {endpoint.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {endpoint.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {endpoint.url}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSeverityColor(endpoint.severity)}`}
                      >
                        {endpoint.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endpoint.checkInterval}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          endpoint.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {endpoint.enabled ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Enabled
                          </>
                        ) : (
                          'Disabled'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(endpoint)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit endpoint"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(endpoint)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete endpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <EndpointFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        endpoint={editingEndpoint}
        onSave={handleSave}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        endpoint={deletingEndpoint}
        loading={deleteLoading}
      />
    </div>
  )
}
