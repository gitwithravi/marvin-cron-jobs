"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { AttentionList } from "@/features/attention/AttentionList";
import { AttentionDetail } from "@/features/attention/AttentionDetail";

type AttentionScreenProps = {
  items: AttentionItem[];
};

export function AttentionScreen({ items }: AttentionScreenProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "critical") return item.severity === "critical";
    if (activeFilter === "approvals") return item.kind === "approval";
    if (activeFilter === "failed") return item.kind === "run" && item.severity === "critical";
    if (activeFilter === "waiting") return item.kind === "todo" && item.evidence.toLowerCase().includes("waiting");
    if (activeFilter === "systems") return item.kind === "beszel";
    return true;
  });

  const selectedItem = selectedId ? filteredItems.find((i) => i.id === selectedId) ?? null : null;

  const filterTabs = [
    { id: "all", label: "All", count: items.length },
    { id: "critical", label: "Critical", count: items.filter((i) => i.severity === "critical").length },
    { id: "approvals", label: "Approvals", count: items.filter((i) => i.kind === "approval").length },
    { id: "failed", label: "Failed runs", count: items.filter((i) => i.kind === "run" && i.severity === "critical").length },
    { id: "waiting", label: "Waiting on humans", count: items.filter((i) => i.kind === "todo" && i.evidence.toLowerCase().includes("waiting")).length },
    { id: "systems", label: "Systems", count: items.filter((i) => i.kind === "beszel").length }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Attention</h1>

      <Tabs tabs={filterTabs} activeTab={activeFilter} onTabChange={setActiveFilter} />

      {filteredItems.length === 0 ? (
        <Panel>
          <EmptyState
            title="The queue is empty"
            message="Suspicious, but acceptable."
          />
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing)", minHeight: "600px" }}>
          <AttentionList
            items={filteredItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <AttentionDetail item={selectedItem} />
        </div>
      )}
    </div>
  );
}
