import { getConsoleOverviewData } from "@/features/overview/data";
import { OverviewPage } from "@/features/overview/overview-page";

export const dynamic = "force-dynamic";

export default async function ConsoleOverviewRoute() {
  const data = await getConsoleOverviewData();
  return <OverviewPage data={data} />;
}
