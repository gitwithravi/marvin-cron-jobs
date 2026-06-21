"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, timeAgo } from "@/lib/utils/format";
import { JsonTree } from "@/features/reports/json-tree";

type ReportRun = {
  id: number;
  task_name: string;
  status: string;
  observed_at?: string | null;
  risk_level?: string | null;
  error?: string | null;
  factual_payload?: Record<string, unknown> | null;
  deterministic_analysis?: {
    summary?: string;
    notable_facts?: string[];
    recommended_actions?: string[];
  } | null;
  summary?: {
    summary_json?: {
      summary?: string;
      notable_facts?: string[];
      recommended_actions?: string[];
      risk_level?: string;
    } | null;
  } | null;
};

export function ReportDetailClient({ run }: { run: ReportRun }) {
  const [summary, setSummary] = useState(run.summary?.summary_json || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateSummary() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/runs/${run.id}/summary?task_name=${encodeURIComponent(run.task_name)}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate summary");
      }
      const data = await response.json();
      setSummary(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  const deterministic = run.deterministic_analysis || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/90">
                Run #{run.id}
              </p>
              <CardTitle className="mt-2 break-words text-xl sm:text-2xl">{run.task_name}</CardTitle>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <StatusBadge value={run.risk_level || run.status} />
              {run.observed_at ? (
                <>
                  <span>{timeAgo(run.observed_at)}</span>
                  <span className="break-words">{formatDateTime(run.observed_at)}</span>
                </>
              ) : null}
            </div>
          </div>
          <Button
            onClick={handleGenerateSummary}
            disabled={loading || Boolean(summary)}
            className="w-full sm:w-auto"
          >
            <Sparkles className="size-4" />
            {summary ? "Summary cached" : loading ? "Thinking..." : "Generate summary"}
          </Button>
        </CardHeader>
        {error ? (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deterministic analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-foreground/90">
              {deterministic.summary || "No deterministic summary available."}
            </p>
            {deterministic.notable_facts?.length ? (
              <div className="space-y-2">
                <h3 className="font-medium">Notable facts</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {deterministic.notable_facts.map((fact) => (
                    <li key={fact}>• {fact}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {deterministic.recommended_actions?.length ? (
              <div className="space-y-2">
                <h3 className="font-medium">Recommended actions</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {deterministic.recommended_actions.map((action) => (
                    <li key={action}>• {action}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MARVIN summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary ? (
              <>
                <p className="text-sm leading-7 text-foreground/90">{summary.summary}</p>
                {summary.notable_facts?.length ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Notable facts</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.notable_facts.map((fact: string) => (
                        <li key={fact}>• {fact}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {summary.recommended_actions?.length ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Recommended actions</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {summary.recommended_actions.map((action: string) => (
                        <li key={action}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No cached summary yet. Deterministic analysis remains the source of truth.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {run.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Execution error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/20 p-4 text-xs sm:text-sm">
              <code>{run.error}</code>
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {run.factual_payload ? <JsonTree data={run.factual_payload as never} /> : null}
    </div>
  );
}
