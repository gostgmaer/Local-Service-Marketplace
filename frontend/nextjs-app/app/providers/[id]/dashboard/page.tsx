'use client';

import { Tabs } from '@/components/ui';
import { DocumentUpload } from '@/components/features/provider/DocumentUpload';
import { DocumentList } from '@/components/features/provider/DocumentList';
import { PortfolioUpload } from '@/components/features/provider/PortfolioUpload';
import { PortfolioGallery } from '@/components/features/provider/PortfolioGallery';
import { ReviewAggregates } from '@/components/features/review/ReviewAggregates';
import { FileText, ImageIcon, Star } from 'lucide-react';

export default function ProviderDashboard({ params }: { params: { id: string } }) {
  const tabs = [
    {
      id: 'documents',
      label: 'Documents',
      content: (
        <div className="grid lg:grid-cols-2 gap-8">
          <DocumentUpload 
            providerId={params.id}
            onUploadSuccess={() => window.location.reload()}
          />
          <DocumentList providerId={params.id} />
        </div>
      )
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      content: (
        <div className="space-y-8">
          <PortfolioUpload 
            providerId={params.id}
            onUploadSuccess={() => window.location.reload()}
          />
          <PortfolioGallery providerId={params.id} />
        </div>
      )
    },
    {
      id: 'reviews',
      label: 'Reviews',
      content: <ReviewAggregates providerId={params.id} />
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Provider Dashboard</h1>
      <Tabs tabs={tabs} defaultTab="documents" />
    </div>
  );
}
