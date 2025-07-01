'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, AlertCircle, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/app/lib/api-client'
import { Endpoint } from '@/app/lib/types'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

export function EndpointList() {
  const router = useRouter()
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
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
    router.push('/endpoints/new')
  }

  const handleEdit = (endpoint: Endpoint) => {
    router.push(`/endpoints/${endpoint.id}`)
  }

  const handleDelete = (endpoint: Endpoint) => {
    setDeletingEndpoint(endpoint)
    setShowDeleteModal(true)
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
          <p className="text-gray-600 mb-4">
            Get started by adding your first endpoint to monitor.
          </p>
          <button
            onClick={handleAdd}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Add Your First Endpoint
          </button>
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSeverityColor(
                          endpoint.severity
                        )}`}
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
