import { EndpointForm } from '@/app/components/pages/EndpointForm'

interface EditEndpointPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditEndpointPage({ params }: EditEndpointPageProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <EndpointForm endpointId={id} />
      </div>
    </div>
  )
}

