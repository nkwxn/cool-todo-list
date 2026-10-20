import { Skeleton } from "@/components/ui/feedback";

/** Shown while the notes store hydrates from local storage. */
export function AppSkeleton() {
  return (
    <div className="flex h-dvh" aria-busy="true" aria-label="Loading notes">
      <div className="hidden w-64 shrink-0 border-r border-border p-4 lg:block">
        <Skeleton className="mb-8 h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-10 w-64 max-w-full" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="size-10" />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </div>
    </div>
  );
}
