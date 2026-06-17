import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { BeszelData } from "@/lib/api/types";
import { getOpenRouterAccountUsage, type OpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { SystemPosture } from "@/features/systems/SystemPosture";
import { BeszelSystemList } from "@/features/systems/BeszelSystemList";
import { AlertList } from "@/features/systems/AlertList";
import { ContainerList } from "@/features/systems/ContainerList";
import { OpenRouterUsagePanel } from "@/features/systems/OpenRouterUsagePanel";
import { StatusPagesPanel } from "@/features/systems/StatusPagesPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const dynamic = "force-dynamic";

export default async function SystemsPage() {
  let beszel: BeszelData | null = null;
  let apiAvailable = false;

  try {
    const response = await fetch(`${marvinApiBaseUrl()}/beszel`, { cache: "no-store" });
    if (response.ok) {
      beszel = await response.json();
      apiAvailable = true;
    }
  } catch (err) {
    console.error("Error fetching beszel:", err);
  }

  let openrouter: OpenRouterAccountUsage | null = null;
  try {
    const result = await getOpenRouterAccountUsage();
    if (result.ok) {
      openrouter = result.usage;
    }
  } catch (err) {
    console.error("Error fetching openrouter usage:", err);
  }

  const statusPageUrls = process.env.PUBLIC_STATUS_PAGES?.split(",").map((s) => s.trim()).filter(Boolean) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Systems</h1>

      <SystemPosture
        beszel={beszel}
        openrouter={openrouter}
        apiAvailable={apiAvailable}
      />

      {beszel && (
        <>
          <div>
            <SectionHeader eyebrow="Infrastructure" title="Beszel Systems" />
            <BeszelSystemList systems={beszel.systems} />
          </div>

          <div>
            <SectionHeader eyebrow="Alerts" title="Active Alerts" />
            <AlertList alerts={beszel.alerts} />
          </div>

          <div>
            <SectionHeader eyebrow="Containers" title="Containers" />
            <ContainerList containers={beszel.containers} />
          </div>
        </>
      )}

      <div>
        <SectionHeader eyebrow="Usage" title="OpenRouter" />
        <OpenRouterUsagePanel usage={openrouter} />
      </div>

      <div>
        <SectionHeader eyebrow="External" title="Public Status Pages" />
        <StatusPagesPanel urls={statusPageUrls} />
      </div>
    </div>
  );
}
