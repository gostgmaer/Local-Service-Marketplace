import { Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <div className="container-custom py-12">
      <Skeleton className="h-10 w-64 mb-4" />
      <Skeleton className="h-5 w-96 mb-8" />
      <Skeleton className="h-12 w-full mb-8" />
      <div className="flex gap-4 mb-8">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
