import { PortfolioUpload } from '@/components/features/provider/PortfolioUpload';
import { PortfolioGallery } from '@/components/features/provider/PortfolioGallery';

export default function ProviderPortfolioPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Portfolio Management</h1>
      
      <div className="space-y-8">
        <PortfolioUpload 
          providerId={params.id}
          onUploadSuccess={() => window.location.reload()}
        />
        
        <PortfolioGallery providerId={params.id} />
      </div>
    </div>
  );
}
