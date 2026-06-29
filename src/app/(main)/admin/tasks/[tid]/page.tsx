"use client";
import { Suspense } from "react";
import AdminTaskView from "@/components/pages/AdminTaskView";
import FullPageLoader from "@/components/common/FullPageLoader";
export default function AdminTaskViewPage() {
  // AdminTaskView 用 useSearchParams 读 ?uid,需包在 Suspense 边界内。
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AdminTaskView />
    </Suspense>
  );
}
