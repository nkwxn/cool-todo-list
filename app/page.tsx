import { Suspense } from "react";
import { NoteApp } from "@/components/note-app";
import { AppSkeleton } from "@/components/app-skeleton";

export default function Home() {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <NoteApp />
    </Suspense>
  );
}
