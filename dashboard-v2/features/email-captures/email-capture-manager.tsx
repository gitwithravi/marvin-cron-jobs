"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime, timeAgo, truncateText } from "@/lib/utils/format";

type EmailCaptureEvent = {
  eventName: string;
  createdAt: string;
};

type EmailCapture = {
  id: string;
  from: string;
  subject: string | null;
  receivedAt: string;
  textBody: string | null;
  htmlBody: string | null;
  status: string;
  createdTaskId: number | null;
  events?: EmailCaptureEvent[];
};

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data;
}

function previewText(capture: EmailCapture) {
  return (capture.textBody || capture.htmlBody || "").replace(/\s+/g, " ").trim();
}

export function EmailCaptureManager() {
  const [captures, setCaptures] = useState<EmailCapture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCapture, setSelectedCapture] = useState<EmailCapture | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const data = await fetch("/api/email-captures?limit=75").then(readJson);
      setCaptures(data.captures || []);
      setSelectedId((current) => current || data.captures?.[0]?.id || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    setIsDetailLoading(true);
    fetch(`/api/email-captures/${encodeURIComponent(selectedId)}`)
      .then(readJson)
      .then((data) => setSelectedCapture(data.capture || null))
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setIsDetailLoading(false));
  }, [selectedId]);

  const detail = useMemo(
    () => (selectedCapture?.id === selectedId ? selectedCapture : captures.find((capture) => capture.id === selectedId) || null),
    [captures, selectedCapture, selectedId]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Email captures</CardTitle>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <div className="space-y-2 p-3">
              {isLoading ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">Loading captures...</p>
              ) : captures.length === 0 ? (
                <EmptyState
                  title="No captured emails"
                  description="Forwarded emails will appear here after ingestion."
                />
              ) : (
                captures.map((capture) => (
                  <button
                    key={capture.id}
                    type="button"
                    onClick={() => setSelectedId(capture.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      selectedId === capture.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-black/10 hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{capture.subject || "No subject"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{capture.from}</p>
                      </div>
                      <StatusBadge value={capture.status} />
                    </div>
                    {previewText(capture) ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {truncateText(previewText(capture), 100)}
                      </p>
                    ) : null}
                    <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {timeAgo(capture.receivedAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{detail?.subject || "Capture detail"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {isDetailLoading ? (
            <p className="text-sm text-muted-foreground">Loading capture detail...</p>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <StatusBadge value={detail.status} />
                <span>{detail.from}</span>
                <span>{formatDateTime(detail.receivedAt)}</span>
              </div>
              {detail.createdTaskId ? (
                <Button asChild variant="outline">
                  <Link href="/console/todos">Open todos</Link>
                </Button>
              ) : null}
              <div className="space-y-2">
                <h3 className="font-medium">Body preview</h3>
                <div className="rounded-xl border border-border/60 bg-black/10 p-4 text-sm leading-7 text-foreground/90">
                  {detail.textBody || detail.htmlBody || "No body content stored."}
                </div>
              </div>
              {detail.events?.length ? (
                <div className="space-y-2">
                  <h3 className="font-medium">Event log</h3>
                  <div className="space-y-2">
                    {detail.events.map((event, index) => (
                      <div key={`${event.eventName}-${index}`} className="rounded-lg border border-border/60 bg-black/10 p-3 text-sm">
                        <div className="font-medium">{event.eventName}</div>
                        <div className="text-muted-foreground">{formatDateTime(event.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No capture selected"
              description="Choose an item from the inbox to inspect its body and event history."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
