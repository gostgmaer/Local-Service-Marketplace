'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useAuth";
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DataTable } from "@/components/ui";
import { adminService } from '@/services/admin-service';
import { formatDate } from '@/utils/helpers';
import { ErrorState } from "@/components/ui/ErrorState";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import Link from "next/link";
import type { ColumnFiltersState, SortingState, Table } from "@tanstack/react-table";

type UserRow = { id: string; name?: string; email?: string; role?: string; status?: string; created_at: string };

const mapUserSortBy = (field?: string): "createdAt" | "email" | "name" | "role" | "lastLoginAt" => {
	switch (field) {
		case "email":
			return "email";
		case "name":
			return "name";
		case "role":
			return "role";
		default:
			return "createdAt";
	}
};

export default function AdminUsersPage() {
  const { user } = useAuth();
	const [serverSearch, setServerSearch] = useState("");
	const [serverSorting, setServerSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
	const [serverFilters, setServerFilters] = useState<ColumnFiltersState>([]);
	const [serverPageIndex, setServerPageIndex] = useState(0);
	const [serverPageSize, setServerPageSize] = useState(10);

	const roleFilter = String(serverFilters.find((f) => f.id === "role")?.value || "");
	const statusFilter = String(serverFilters.find((f) => f.id === "status")?.value || "");
	const activeSort = serverSorting[0];

  const {
		data: users,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useQuery({
		queryKey: [
			"admin-users",
			serverPageIndex,
			serverPageSize,
			serverSearch,
			roleFilter,
			statusFilter,
			activeSort?.id,
			activeSort?.desc,
		],
		queryFn: () =>
			adminService.getUsers({
				page: serverPageIndex + 1,
				limit: serverPageSize,
				search: serverSearch || undefined,
				role: roleFilter || undefined,
				status: statusFilter || undefined,
				sortBy: mapUserSortBy(activeSort?.id),
				sortOrder: activeSort?.desc ? "desc" : "asc",
			}),
		enabled: user?.role === "admin",
		placeholderData: (previousData) => previousData,
	});

	const tableUsers: UserRow[] = useMemo(() => users?.data || [], [users?.data]);

  return (
		<ProtectedRoute requiredRoles={["admin"]}>
			<Layout>
				<div className='container-custom py-12'>
					<div className='mb-8'>
						<h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>User Management</h1>
						<p className='text-gray-600 dark:text-gray-400'>Manage and monitor platform users</p>
					</div>

					{/* Users List */}
					<Card>
						<CardHeader>
							<h2 className='text-lg font-semibold text-gray-900 dark:text-white'>All Users ({tableUsers.length})</h2>
						</CardHeader>
						<CardContent>
							{isLoading && !users ?
								<Loading size='sm' />
							: error ?
								<ErrorState
									title='Failed to load users'
									message="We couldn't load user data. Please try again."
									retry={() => refetch()}
								/>
							:	<DataTable<UserRow>
									data={tableUsers}
									getRowKey={(row: UserRow) => row.id}
									processingMode='server'
									serverTotalRows={users?.total ?? tableUsers.length}
									serverPageIndex={serverPageIndex}
									serverPageSize={serverPageSize}
									serverSearchTerm={serverSearch}
									serverSorting={serverSorting}
									serverColumnFilters={serverFilters}
									onServerPageIndexChange={setServerPageIndex}
									onServerPageSizeChange={setServerPageSize}
									onServerSearchChange={setServerSearch}
									onServerSortingChange={setServerSorting}
									onServerColumnFiltersChange={setServerFilters}
									initialSortField='created_at'
									initialSortDirection='desc'
									searchPlaceholder='Search users by name, email, role, or status...'
									searchableColumns={["name", "email", "role", "status", "created_at"]}
									renderToolbarFields={(table: Table<UserRow>) => {
										const roleOptions = Array.from(new Set(tableUsers.map((u) => u.role).filter(Boolean))) as string[];
										const statusOptions = Array.from(
											new Set(tableUsers.map((u) => u.status).filter(Boolean)),
										) as string[];

										return (
											<>
												<select
													value={(table.getColumn("role")?.getFilterValue() as string) || ""}
													onChange={(e) => table.getColumn("role")?.setFilterValue(e.target.value || undefined)}
													className='rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'>
													<option value=''>All roles</option>
													{roleOptions.map((role) => (
														<option
															key={role}
															value={role}>
															{role}
														</option>
													))}
												</select>

												<select
													value={(table.getColumn("status")?.getFilterValue() as string) || ""}
													onChange={(e) => table.getColumn("status")?.setFilterValue(e.target.value || undefined)}
													className='rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'>
													<option value=''>All statuses</option>
													{statusOptions.map((status) => (
														<option
															key={status}
															value={status}>
															{status}
														</option>
													))}
												</select>
											</>
										);
									}}
									quickSorts={[
										{ label: "Name (A-Z)", field: "name", direction: "asc" },
										{ label: "Email (A-Z)", field: "email", direction: "asc" },
										{ label: "Newest Joined", field: "created_at", direction: "desc" },
										{ label: "Oldest Joined", field: "created_at", direction: "asc" },
									]}
									quickSortLabel='Quick sort'
									enableExport
									exportLabel='Export Users'
									exportFileName='admin-users'
									emptyMessage='No users found'
									isLoading={isFetching && !!users}
									searchDebounceMs={300}
									columns={[
										{
											id: "name",
											header: "Name",
											sortable: true,
											accessor: (row: UserRow) => row.name || "",
											cell: (row: UserRow) => <span className='font-medium'>{row.name || "No name"}</span>,
										},
										{
											id: "email",
											header: "Email",
											sortable: true,
											accessor: (row: UserRow) => row.email || "",
											cell: (row: UserRow) => row.email || "-",
										},
										{
											id: "role",
											header: "Role",
											sortable: true,
											filterable: true,
											accessor: (row: UserRow) => row.role || "",
											cell: (row: UserRow) => (
												<span className='rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
													{row.role}
												</span>
											),
											align: "center",
										},
										{
											id: "status",
											header: "Status",
											sortable: true,
											filterable: true,
											accessor: (row: UserRow) => row.status || "active",
											cell: (row: UserRow) => <StatusBadge status={row.status || "active"} />,
											align: "center",
										},
										{
											id: "created_at",
											header: "Joined",
											sortable: true,
											accessor: (row: UserRow) => new Date(row.created_at),
											cell: (row: UserRow) => formatDate(row.created_at),
										},
										{
											id: "action",
											header: "Action",
											align: "right",
											cell: (row: UserRow) => (
												<Link href={`/dashboard/admin/users/${row.id}`}>
													<Button
														variant='outline'
														size='sm'>
														View Details
													</Button>
												</Link>
											),
										},
									]}
								/>
							}
						</CardContent>
					</Card>
				</div>
			</Layout>
		</ProtectedRoute>
	);
}
