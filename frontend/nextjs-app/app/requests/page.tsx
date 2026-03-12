'use client';

import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { requestService } from '@/services/request-service';
import { formatDate, formatCurrency } from '@/utils/helpers';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function RequestsPage() {
  const { page, limit, goToPage } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['requests', page, limit],
    queryFn: () => requestService.getRequests({ page, limit }),
  });

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Service Requests
            </h1>
            <p className="mt-2 text-gray-600">
              Browse and manage service requests
            </p>
          </div>
          <Link href="/requests/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Loading />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="grid gap-6">
              {data.data.map((request) => (
                <Card key={request.id} hover>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link href={`/requests/${request.id}`}>
                          <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600">
                            {request.title}
                          </h3>
                        </Link>
                        <p className="text-gray-600 mt-2 line-clamp-2">
                          {request.description}
                        </p>
                        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(request.budget)}
                          </span>
                          <span>•</span>
                          <span>{request.category?.name || 'Uncategorized'}</span>
                          <span>•</span>
                          <span>{formatDate(request.createdAt)}</span>
                        </div>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Pagination
              currentPage={page}
              totalPages={Math.ceil(data.total / limit)}
              onPageChange={goToPage}
            />
          </>
        ) : (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No requests found</p>
                <Link href="/requests/create">
                  <Button>Create Your First Request</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
