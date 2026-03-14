import { DocumentUpload } from '@/components/features/provider/DocumentUpload';
import { DocumentList } from '@/components/features/provider/DocumentList';

export default function ProviderDocumentsPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Document Verification</h1>
      
      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <DocumentUpload 
            providerId={params.id}
            onUploadSuccess={() => window.location.reload()}
          />
        </div>
        
        <div>
          <DocumentList providerId={params.id} />
        </div>
      </div>
    </div>
  );
}
