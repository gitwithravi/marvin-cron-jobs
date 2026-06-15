"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BeszelSeriesPoint = {
  created: string | null;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
};

type BeszelAlert = {
  id: string | null;
  name: string | null;
  system: string | null;
  systemName?: string | null;
  triggered?: boolean | null;
  value?: string | number | null;
  min?: string | number | null;
};

type BeszelContainer = {
  id: string | null;
  name: string | null;
  system: string | null;
  systemName?: string | null;
  status: string | null;
  image: string | null;
  cpu?: number | null;
  memory?: number | null;
  health?: string | number | null;
};

type BeszelSystem = {
  id: string;
  name: string;
  host: string | null;
  status: string;
  updated: string | null;
  latest: {
    cpu: number | null;
    memory: number | null;
    disk: number | null;
    load: number | null;
  };
  series: BeszelSeriesPoint[];
  containers: BeszelContainer[];
  alerts: BeszelAlert[];
};

type BeszelPayload = {
  fetchedAt: string;
  summary: {
    systemCount: number;
    containerCount: number;
    triggeredAlertCount: number;
    unresolvedAlertHistoryCount: number;
    systemStatusCounts: Record<string, number>;
    containerStatusCounts: Record<string, number>;
  };
  systems: BeszelSystem[];
  containers: BeszelContainer[];
  alerts: BeszelAlert[];
  windows: {
    alertHistoryHours: number;
    systemStatsHours: number;
  };
};

const POLL_INTERVAL_MS = 60000;

function label(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

async function readJson(response: Response) {
  const text = await response.text();
  let data: { detail?: string; error?: string } & Record<string, unknown> = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      const fallback = text.trim().slice(0, 180);
      throw new Error(
        response.ok
          ? "Beszel API returned an invalid response."
          : fallback || `Beszel API returned HTTP ${response.status}.`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.detail || data.error || `Beszel API returned HTTP ${response.status}.`);
  }

  if (!text.trim()) {
    throw new Error("Beszel API returned an empty response.");
  }

  return data as BeszelPayload;
}

function sparkPath(points: BeszelSeriesPoint[], metric: keyof BeszelSeriesPoint) {
  const values = points
    .map((point, index) => ({
      index,
      value: typeof point[metric] === "number" ? point[metric] : null
    }))
    .filter((point): point is { index: number; value: number } => point.value !== null);

  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    const y = 42 - Math.min(Math.max(values[0].value, 0), 100) * 0.34;
    return `M 4 ${y.toFixed(2)} L 116 ${y.toFixed(2)}`;
  }

  return values
    .map((point, position) => {
      const x = 4 + (position / (values.length - 1)) * 112;
      const y = 42 - Math.min(Math.max(point.value, 0), 100) * 0.34;
      return `${position === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({
  label,
  metric,
  points,
  value
}: {
  label: string;
  metric: "cpu" | "memory" | "disk";
  points: BeszelSeriesPoint[];
  value: number | null;
}) {
  const path = sparkPath(points, metric);

  return (
    <div className="beszel-spark">
      <div>
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <svg viewBox="0 0 120 46" role="img" aria-label={`${label} trend`}>
        <line x1="4" x2="116" y1="42" y2="42" />
        {path ? <path d={path} /> : <text x="60" y="26">No data</text>}
      </svg>
    </div>
  );
}

function statusClass(status: string | null | undefined) {
  const normalized = (status || "unknown").toLowerCase();
  if (normalized.includes("up") || normalized.includes("running")) {
    return "beszel-status-up";
  }
  if (normalized.includes("down") || normalized.includes("failed") || normalized.includes("exited")) {
    return "beszel-status-down";
  }
  return "beszel-status-unknown";
}

export function BeszelOverview() {
  const [payload, setPayload] = useState<BeszelPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

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
      setFetchedAt(data.fetchedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (initial) {
        setPayload(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const interval = window.setInterval(() => refresh(false), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const triggeredAlerts = useMemo(
    () => (payload?.alerts ?? []).filter((alert) => alert.triggered),
    [payload]
  );

  const downCount = payload?.summary.systemStatusCounts.down ?? 0;
  const upCount = payload?.summary.systemStatusCounts.up ?? 0;

  return (
    <div className="beszel-stack">
      <section className="beszel-toolbar">
        <div>
          <p className="eyebrow">Live API</p>
          <h2>Beszel overview</h2>
          <p className="muted">
            {fetchedAt ? `Updated ${formatDateTime(fetchedAt)}` : "Waiting for first refresh"}
          </p>
        </div>
        <button className="button" type="button" onClick={() => refresh(false)} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {isLoading ? (
        <section className="empty-state">
          <h2>Loading Beszel</h2>
          <p className="muted">Fetching live infrastructure data.</p>
        </section>
      ) : payload ? (
        <>
          <section className="metric-grid" aria-label="Beszel summary">
            <div className="metric">
              <span>{payload.summary.systemCount}</span>
              <p>Systems</p>
            </div>
            <div className="metric">
              <span>{upCount} up / {downCount} down</span>
              <p>Status</p>
            </div>
            <div className="metric">
              <span>{payload.summary.triggeredAlertCount}</span>
              <p>Triggered alerts</p>
            </div>
            <div className="metric">
              <span>{payload.summary.containerCount}</span>
              <p>Containers</p>
            </div>
          </section>

          <section className="beszel-system-grid" aria-label="Beszel systems">
            {payload.systems.map((system) => (
              <article className="beszel-system-card" key={system.id}>
                <div className="beszel-system-header">
                  <div>
                    <h2>{system.name}</h2>
                    <p>{system.host || "No host recorded"}</p>
                  </div>
                  <span className={`beszel-status ${statusClass(system.status)}`}>
                    {label(system.status)}
                  </span>
                </div>

                <div className="beszel-spark-grid">
                  <Sparkline label="CPU" metric="cpu" points={system.series} value={system.latest.cpu} />
                  <Sparkline
                    label="Memory"
                    metric="memory"
                    points={system.series}
                    value={system.latest.memory}
                  />
                  <Sparkline label="Disk" metric="disk" points={system.series} value={system.latest.disk} />
                </div>

                <div className="beszel-system-meta">
                  <span>{system.containers.length} containers</span>
                  <span>{system.alerts.filter((alert) => alert.triggered).length} triggered alerts</span>
                  <span>{system.series.length} chart points</span>
                </div>
              </article>
            ))}
          </section>

          <section className="beszel-detail-grid">
            <article className="beszel-panel">
              <div className="beszel-panel-header">
                <div>
                  <p className="eyebrow">Alerts</p>
                  <h2>Triggered alerts</h2>
                </div>
                <span>{payload.windows.alertHistoryHours}h history</span>
              </div>
              {triggeredAlerts.length > 0 ? (
                <ul className="beszel-list">
                  {triggeredAlerts.map((alert) => (
                    <li key={alert.id ?? `${alert.system}-${alert.name}`}>
                      <strong>{alert.name || "Unnamed alert"}</strong>
                      <span>{alert.systemName || alert.system || "Unknown system"}</span>
                      <small>Value {alert.value ?? "n/a"} / min {alert.min ?? "n/a"}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="beszel-empty-panel">
                  <h3>No triggered alerts</h3>
                  <p className="muted">Beszel returned no active alert triggers.</p>
                </div>
              )}
            </article>

            <article className="beszel-panel">
              <div className="beszel-panel-header">
                <div>
                  <p className="eyebrow">Containers</p>
                  <h2>Container status</h2>
                </div>
                <span>{Object.keys(payload.summary.containerStatusCounts).length} states</span>
              </div>
              {payload.containers.length > 0 ? (
                <ul className="beszel-list beszel-container-list">
                  {payload.containers.slice(0, 18).map((container) => (
                    <li key={container.id ?? `${container.system}-${container.name}`}>
                      <strong>{container.name || "Unnamed container"}</strong>
                      <span>{container.systemName || container.system || "Unknown system"}</span>
                      <small>{container.status || "unknown"} {container.image ? `- ${container.image}` : ""}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="beszel-empty-panel">
                  <h3>No containers found</h3>
                  <p className="muted">The Beszel containers collection returned no records.</p>
                </div>
              )}
            </article>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>Beszel unavailable</h2>
          <p className="muted">No live payload is available.</p>
        </section>
      )}
    </div>
  );
}
