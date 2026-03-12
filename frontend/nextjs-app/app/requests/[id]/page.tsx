'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { StatusBadge } from '@/components/ui/Badge';
import { requestService } from '@/services/request-service';
import { proposalService } from '@/services/proposal-service';
import { formatDate, formatCurrency, formatRelativeTime } from '@/utils/helpers';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit } from 'lucide-react';
import Link from 'next/link';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const requestId = params.id as string;

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => requestService.getRequestById(requestId),
  });

  const { data: proposals } = useQuery({
    queryKey: ['proposals', requestId],
    queryFn: () => proposalService.getProposalsByRequest(requestId),
    enabled: !!requestId,
  });

  const acceptProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      proposalService.acceptProposal(proposalId),
    onSuccess: () => {
      toast.success('Proposal accepted!');
      queryClient.invalidateQueries({ queryKey: ['proposals', requestId] });
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
    },
    onError: () => {
      toast.error('Failed to accept proposal');
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      proposalService.rejectProposal(proposalId),
    onSuccess: () => {
      toast.success('Proposal rejected');
      queryClient.invalidateQueries({ queryKey: ['proposals', requestId] });
    },
    onError: () => {
      toast.error('Failed to reject proposal');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout>
        <div className="container-custom py-8">
          <p>Request not found</p>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === request.customerId;

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Request Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {request.title}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                      Posted {formatRelativeTime(request.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {request.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-500">Budget</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(request.budget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {request.category?.name || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {isOwner && request.status === 'open' && (
                    <div className="pt-4 border-t">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Request
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Proposals */}
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">
                  Proposals ({proposals?.length || 0})
                </h2>
              </CardHeader>
              <CardContent>
                {proposals && proposals.length > 0 ? (
                  <div className="space-y-4">
                    {proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {proposal.provider?.name || 'Provider'}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {formatRelativeTime(proposal.createdAt)}
                            </p>
                          </div>
                          <StatusBadge status={proposal.status} />
                        </div>

                        <p className="text-gray-700 mb-3">
                          {proposal.description}
                        </p>

                        <div className="flex items-center gap-4 mb-3 text-sm">
                          <span className="font-medium text-gray-900">
                            Price: {formatCurrency(proposal.price)}
                          </span>
                          <span>•</span>
                          <span className="text-gray-600">
                            Duration: {proposal.estimatedDuration}
                          </span>
                        </div>

                        {isOwner && proposal.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                acceptProposalMutation.mutate(proposal.id)
                              }
                              isLoading={acceptProposalMutation.isPending}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                rejectProposalMutation.mutate(proposal.id)
                              }
                              isLoading={rejectProposalMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-gray-500">
                    No proposals yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Request Info</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500">Status</p>
                    <StatusBadge status={request.status} />
                  </div>
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Updated</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(request.updatedAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
