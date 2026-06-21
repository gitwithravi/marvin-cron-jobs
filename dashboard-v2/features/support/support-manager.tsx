"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCcw, SearchCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, truncateText } from "@/lib/utils/format";

type Suggestion = {
  status: string;
  confidence: "low" | "medium" | "high";
  requires_human_attention: boolean;
  retrieval_backend: string | null;
  updated_at: string;
};

type Ticket = {
  id: number;
  ticket_number?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  message?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  latest_suggestion?: Suggestion | null;
};

function confidenceLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

export function SupportManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadTickets(options?: { syncFirst?: boolean }) {
    setIsLoading(true);
    setError(null);
    try {
      if (options?.syncFirst) {
        const sync = await fetch("/api/agent-runs/support-reply/sync?limit=25", { method: "POST" }).then(readJson);
        if (sync.created_count > 0) {
          setNotice(`Queued ${sync.created_count} new approval${sync.created_count === 1 ? "" : "s"}.`);
        }
      }
      const data = await fetch("/api/support-rag/tickets?statuses=open&limit=25").then(readJson);
      setTickets(data.tickets || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTickets({ syncFirst: true });
  }, []);

  async function rebuildIndex() {
    setBusyKey("index");
    setError(null);
    setNotice(null);
    try {
      const data = await fetch("/api/support-rag/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_qdrant: true })
      }).then(readJson);
      setNotice(`Indexed ${data.examples} examples${data.qdrant_error ? "; Qdrant fallback is active" : ""}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyKey(null);
    }
  }

  const queuedCount = useMemo(
    () => tickets.filter((ticket) => ticket.latest_suggestion?.status === "draft").length,
    [tickets]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Support intake</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Open tickets are synced into the shared approval workflow automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/console/approvals">Open approvals</Link>
            </Button>
            <Button variant="outline" onClick={() => loadTickets({ syncFirst: true })} disabled={isLoading || busyKey !== null}>
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Button onClick={rebuildIndex} disabled={busyKey !== null}>
              <SearchCheck className="size-4" />
              {busyKey === "index" ? "Indexing..." : "Rebuild index"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 bg-black/10 p-4 text-sm text-muted-foreground">
            {queuedCount} tickets currently have a draft suggestion on record. New open tickets are queued for approval automatically.
          </div>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {notice}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading support tickets...</p>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No reviewable support tickets found"
          description="The queue is empty for now. This condition is unlikely to last."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tickets.map((ticket) => {
            const suggestion = ticket.latest_suggestion;
            return (
              <Card key={ticket.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/90">
                        {ticket.ticket_number || `Ticket ${ticket.id}`}
                      </p>
                      <CardTitle className="mt-2 text-lg">
                        {ticket.subject || "Untitled ticket"}
                      </CardTitle>
                    </div>
                    <StatusBadge value={suggestion?.status || "pending"} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{ticket.status || "unknown status"}</span>
                    <span>{ticket.priority || "priority unknown"}</span>
                    <span>{ticket.owner_name || ticket.owner_email || "owner unknown"}</span>
                    {suggestion ? <span>{confidenceLabel(suggestion.confidence)}</span> : null}
                  </div>
                  <p className="text-sm leading-7 text-foreground/90">
                    {truncateText(ticket.message || "No customer message in payload.", 280)}
                  </p>
                  {suggestion ? (
                    <div className="rounded-xl border border-border/60 bg-black/10 p-4 text-sm text-muted-foreground">
                      <p>
                        Retrieval: {suggestion.retrieval_backend || "unknown"}.
                        {suggestion.requires_human_attention ? " Needs review." : " Queueing again will produce a fresh approval."}
                      </p>
                      <p className="mt-2">Last updated {formatDateTime(suggestion.updated_at)}.</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
