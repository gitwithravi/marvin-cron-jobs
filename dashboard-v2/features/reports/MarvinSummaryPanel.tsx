"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiFetch } from "@/lib/api/client";
import { Sparkles } from "lucide-react";

type MarvinSummaryPanelProps = {
  runId: number;
  taskName: string;
  initialSummary: string | null;
};

export function MarvinSummaryPanel({ runId, taskName, initialSummary }: MarvinSummaryPanelProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ summary: string }>(
        `/api/runs/${runId}/summary?task_name=${encodeURIComponent(taskName)}`,
        { method: "POST" }
      );
      setSummary(response.summary);
    } catch (err) {
      setError("Failed to generate summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel>
      <SectionHeader
        eyebrow="Explanation"
        title="MARVIN's explanation"
        action={
          !summary && !loading && (
            <Button variant="secondary" icon={<Sparkles size={16} />} onClick={generateSummary}>
              Generate explanation
            </Button>
          )
        }
      />

      {loading && <LoadingState message="Thinking, tragically." />}

      {error && <ErrorState message={error} />}

      {!loading && !error && summary && (
        <div style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {summary}
        </div>
      )}

      {!loading && !error && !summary && (
        <EmptyState
          title="No explanation yet"
          message="MARVIN has not been asked to explain this run."
        />
      )}
    </Panel>
  );
}
