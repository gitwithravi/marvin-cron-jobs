import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type TaskReportPageProps = {
  params: Promise<{ taskName: string }>;
  searchParams: Promise<{ report?: string }>;
};

export default async function TaskReportPage({
  params,
  searchParams
}: TaskReportPageProps) {
  const { taskName } = await params;
  const { report } = await searchParams;
  const query = report ? `?report=${encodeURIComponent(report)}` : "";
  redirect(`/console/reports/${encodeURIComponent(taskName)}${query}`);
}
