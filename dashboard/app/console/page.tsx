import { OverviewPage } from "@/components/console/OverviewPage";
import { getConsoleOverviewData } from "@/lib/console/overview";

export const dynamic = "force-dynamic";

export default async function ConsoleOverviewRoute() {
  const data = await getConsoleOverviewData();

  return <OverviewPage data={data} />;
}
