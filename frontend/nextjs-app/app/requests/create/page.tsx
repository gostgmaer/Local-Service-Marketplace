'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { requestService, CreateRequestData } from '@/services/request-service';
import toast from 'react-hot-toast';

export default function CreateRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateRequestData>({
    categoryId: '',
    title: '',
    description: '',
    budget: 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRequestData) => requestService.createRequest(data),
    onSuccess: (data) => {
      toast.success('Request created successfully!');
      router.push(`/requests/${data.id}`);
    },
    onError: () => {
      toast.error('Failed to create request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'budget' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Create Service Request
          </h1>

          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Need a plumber for bathroom repair"
                />

                <Select
                  label="Category"
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
                  required
                  options={[
                    { value: '1', label: 'Plumbing' },
                    { value: '2', label: 'Electrical' },
                    { value: '3', label: 'Carpentry' },
                    { value: '4', label: 'Cleaning' },
                    { value: '5', label: 'Painting' },
                  ]}
                />

                <Textarea
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={6}
                  placeholder="Describe your service needs in detail..."
                />

                <Input
                  label="Budget"
                  type="number"
                  name="budget"
                  value={formData.budget.toString()}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  helperText="Enter your estimated budget for this service"
                />

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    isLoading={createMutation.isPending}
                    disabled={createMutation.isPending}
                  >
                    Create Request
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
