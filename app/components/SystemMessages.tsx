'use client'

import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react'

interface SystemMessage {
  message: string
  type: 'info' | 'warning' | 'error'
  timestamp: Date
}

interface SystemMessagesProps {
  messages: SystemMessage[]
  onClear: () => void
}

export function SystemMessages({ messages, onClear }: SystemMessagesProps) {
  if (messages.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getStyles = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  return (
    <div className="space-y-2">
      {messages.slice(0, 3).map((message, index) => (
        <div
          key={`${message.timestamp.getTime()}-${index}`}
          className={`border rounded-md p-3 ${getStyles(message.type)}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getIcon(message.type)}
              <span className="text-sm font-medium">{message.message}</span>
              <span className="text-xs opacity-75">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>

            {messages.length > 1 && (
              <button
                onClick={onClear}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {messages.length > 3 && (
        <div className="text-center">
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear {messages.length - 3} more messages
          </button>
        </div>
      )}
    </div>
  )
}
