import { EndpointList } from '@/app/components/pages/EndpointList'

export default function EndpointsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <EndpointList />
      </div>
    </div>
  )
}
