import { marvinApiBaseUrl } from "@/lib/marvin-server";
import type { TaskRun, BeszelData } from "@/lib/api/types";
import type { OpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { getOpenRouterAccountUsage } from "@/lib/openrouter-usage";
import { getAttentionItems } from "@/features/attention/getAttentionItems";
import { PostureStrip } from "@/features/console/PostureStrip";
import { AttentionPreview } from "@/features/attention/AttentionPreview";
import { LatestConclusions } from "@/features/reports/LatestConclusions";
import { SystemPosture } from "@/features/systems/SystemPosture";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const [attentionItems, runsResult, beszelResult, openrouterResult] = await Promise.allSettled([
    getAttentionItems(),
    fetch(`${marvinApiBaseUrl()}/runs`, { cache: "no-store" }),
    fetch(`${marvinApiBaseUrl()}/beszel`, { cache: "no-store" }),
    getOpenRouterAccountUsage()
  ]);

  const attentionItemsData = attentionItems.status === "fulfilled" ? attentionItems.value : [];
  const runs: TaskRun[] = runsResult.status === "fulfilled" && runsResult.value.ok
    ? await runsResult.value.json()
    : [];
  const beszel: BeszelData | null = beszelResult.status === "fulfilled" && beszelResult.value.ok
    ? await beszelResult.value.json()
    : null;
  const openrouter: OpenRouterAccountUsage | null = openrouterResult.status === "fulfilled" && openrouterResult.value.ok
    ? openrouterResult.value.usage
    : null;

  const apiAvailable = runsResult.status === "fulfilled" && runsResult.value.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Command</h1>

      <PostureStrip
        attentionItems={attentionItemsData}
        runs={runs}
        beszel={beszel}
        apiAvailable={apiAvailable}
      />

      <AttentionPreview items={attentionItemsData} />

      <LatestConclusions runs={runs} />

      <SystemPosture
        beszel={beszel}
        openrouter={openrouter}
        apiAvailable={apiAvailable}
      />
    </div>
  );
}
