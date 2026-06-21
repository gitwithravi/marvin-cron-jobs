"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

type BeszelContainer = {
  id: string | null;
  name: string | null;
  status: string | null;
  image: string | null;
  systemName?: string | null;
  cpu?: number | null;
  memory?: number | null;
};

type BeszelAlert = {
  id: string | null;
  name: string | null;
  systemName?: string | null;
  triggered?: boolean | null;
  value?: string | number | null;
};

type BeszelSystem = {
  id: string;
  name: string;
  status: string;
  updated: string | null;
  latest: {
    cpu: number | null;
    memory: number | null;
    disk: number | null;
    load: number | null;
  };
};

type BeszelPayload = {
  fetchedAt: string;
  summary: {
    systemCount: number;
    containerCount: number;
    triggeredAlertCount: number;
  };
  systems: BeszelSystem[];
  containers: BeszelContainer[];
  alerts: BeszelAlert[];
};

async function readJson(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Request failed");
  }
  return data as BeszelPayload;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

export function BeszelOverview() {
  const [payload, setPayload] = useState<BeszelPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (initial = false) => {
    if (initial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError("");
    try {
      const data = await fetch("/api/beszel", { cache: "no-store" }).then(readJson);
      setPayload(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPayload(null);
    } finally {
      if (initial) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const timer = window.setInterval(() => refresh(false), 60000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const topAlerts = useMemo(() => payload?.alerts.slice(0, 6) || [], [payload]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading live infrastructure state...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {payload ? `Last refreshed ${timeAgo(payload.fetchedAt)}.` : "No payload yet."}
        </p>
        <Button
          variant="outline"
          onClick={() => refresh(false)}
          disabled={isRefreshing}
          className="w-full justify-center sm:w-auto"
        >
          <RefreshCcw className="size-4" />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Systems" value={payload.summary.systemCount} />
            <MetricCard label="Containers" value={payload.summary.containerCount} />
            <MetricCard label="Triggered alerts" value={payload.summary.triggeredAlertCount} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle>Systems</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 lg:hidden">
                  {payload.systems.map((system) => (
                    <div key={system.id} className="rounded-xl border border-border/60 bg-black/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{system.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Updated {formatDateTime(system.updated)}
                          </p>
                        </div>
                        <StatusBadge value={system.status} className="self-start" />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">CPU</p>
                          <p className="mt-1 text-foreground">{formatPercent(system.latest.cpu)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Memory</p>
                          <p className="mt-1 text-foreground">{formatPercent(system.latest.memory)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Disk</p>
                          <p className="mt-1 text-foreground">{formatPercent(system.latest.disk)}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Load</p>
                          <p className="mt-1 text-foreground">{system.latest.load ?? "n/a"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>System</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Disk</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.systems.map((system) => (
                        <TableRow key={system.id}>
                          <TableCell>{system.name}</TableCell>
                          <TableCell><StatusBadge value={system.status} /></TableCell>
                          <TableCell>{formatPercent(system.latest.cpu)}</TableCell>
                          <TableCell>{formatPercent(system.latest.memory)}</TableCell>
                          <TableCell>{formatPercent(system.latest.disk)}</TableCell>
                          <TableCell>{formatDateTime(system.updated)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Triggered alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topAlerts.length > 0 ? (
                  topAlerts.map((alert) => (
                    <div key={`${alert.id}-${alert.name}`} className="rounded-xl border border-border/60 bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{alert.name || "Unnamed alert"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {alert.systemName || "Unknown system"}
                          </p>
                        </div>
                        <StatusBadge value={alert.triggered ? "critical" : "healthy"} />
                      </div>
                      {alert.value !== undefined && alert.value !== null ? (
                        <p className="mt-3 text-sm text-muted-foreground">Current value: {String(alert.value)}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No triggered alerts in the current window.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Containers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 lg:hidden">
                {payload.containers.map((container) => (
                  <div key={`${container.id}-${container.name}`} className="rounded-xl border border-border/60 bg-black/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{container.name || "Unnamed container"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {container.systemName || "Unknown system"}
                        </p>
                      </div>
                      <StatusBadge value={container.status} className="self-start" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em]">CPU</p>
                        <p className="mt-1 text-foreground">{formatPercent(container.cpu)}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Memory</p>
                        <p className="mt-1 text-foreground">{formatPercent(container.memory)}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Image</p>
                      <p className="mt-1 break-all text-foreground/90">{container.image || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CPU</TableHead>
                      <TableHead>Memory</TableHead>
                      <TableHead>Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payload.containers.map((container) => (
                      <TableRow key={`${container.id}-${container.name}`}>
                        <TableCell>{container.name || "Unnamed container"}</TableCell>
                        <TableCell>{container.systemName || "Unknown"}</TableCell>
                        <TableCell><StatusBadge value={container.status} /></TableCell>
                        <TableCell>{formatPercent(container.cpu)}</TableCell>
                        <TableCell>{formatPercent(container.memory)}</TableCell>
                        <TableCell className="max-w-[220px] break-all">{container.image || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
