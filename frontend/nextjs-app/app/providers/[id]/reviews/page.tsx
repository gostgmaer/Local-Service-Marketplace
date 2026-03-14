import { ReviewAggregates } from '@/components/features/review/ReviewAggregates';

export default function ProviderReviewsPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Customer Reviews</h1>
      
      <ReviewAggregates providerId={params.id} />
    </div>
  );
}
