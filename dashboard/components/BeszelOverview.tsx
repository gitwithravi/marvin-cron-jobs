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

function timeAgo(value: string | null | undefined) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

function sparkColor(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "#99a6a3";
  if (value >= 90) return "#a23a32";
  if (value >= 70) return "#9b6a22";
  return "#477f68";
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
  const color = sparkColor(value);

  return (
    <div className="beszel-spark">
      <div className="beszel-spark-header">
        <span className="beszel-spark-label">{label}</span>
        <strong className="beszel-spark-value" style={{ color }}>{formatPercent(value)}</strong>
      </div>
      <svg viewBox="0 0 120 46" role="img" aria-label={`${label} trend`}>
        <line x1="4" x2="116" y1="42" y2="42" />
        {path ? <path d={path} style={{ stroke: color }} /> : <text x="60" y="26">No data</text>}
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

function containerStatusClass(status: string | null | undefined) {
  const normalized = (status || "unknown").toLowerCase();
  if (normalized === "running") return "container-status-running";
  if (normalized === "exited" || normalized === "dead") return "container-status-stopped";
  if (normalized === "created" || normalized === "restarting") return "container-status-pending";
  return "container-status-unknown";
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
        <div className="beszel-toolbar-left">
          <div>
            <p className="eyebrow">Infrastructure</p>
            <h2>Beszel overview</h2>
          </div>
          {fetchedAt && (
            <p className="beszel-updated">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Updated {timeAgo(fetchedAt)}
            </p>
          )}
        </div>
        <div className="beszel-toolbar-stats">
          <div className="beszel-stat">
            <span className="beszel-stat-value">{payload?.summary.systemCount ?? 0}</span>
            <span className="beszel-stat-label">Systems</span>
          </div>
          <div className="beszel-stat beszel-stat-up">
            <span className="beszel-stat-value">{upCount}</span>
            <span className="beszel-stat-label">Up</span>
          </div>
          {downCount > 0 && (
            <div className="beszel-stat beszel-stat-down">
              <span className="beszel-stat-value">{downCount}</span>
              <span className="beszel-stat-label">Down</span>
            </div>
          )}
          <div className="beszel-stat">
            <span className="beszel-stat-value">{payload?.summary.containerCount ?? 0}</span>
            <span className="beszel-stat-label">Containers</span>
          </div>
          {triggeredAlerts.length > 0 && (
            <div className="beszel-stat beszel-stat-alert">
              <span className="beszel-stat-value">{triggeredAlerts.length}</span>
              <span className="beszel-stat-label">Alerts</span>
            </div>
          )}
        </div>
        <button className="button beszel-refresh-btn" type="button" onClick={() => refresh(false)} disabled={isRefreshing}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {error && <p className="error-banner">{error}</p>}

      {isLoading ? (
        <section className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          <h2>Loading infrastructure</h2>
          <p className="muted">Fetching live server data from Beszel.</p>
        </section>
      ) : payload ? (
        <>
          <section className="beszel-system-grid" aria-label="Beszel systems">
            {payload.systems.map((system) => (
              <article className="beszel-system-card" key={system.id}>
                <div className="beszel-system-header">
                  <div className="beszel-system-info">
                    <h2>{system.name}</h2>
                    <p>{system.host || "No host recorded"}</p>
                  </div>
                  <span className={`beszel-status ${statusClass(system.status)}`}>
                    {label(system.status)}
                  </span>
                </div>

                <div className="beszel-spark-grid">
                  <Sparkline label="CPU" metric="cpu" points={system.series} value={system.latest.cpu} />
                  <Sparkline label="Memory" metric="memory" points={system.series} value={system.latest.memory} />
                  <Sparkline label="Disk" metric="disk" points={system.series} value={system.latest.disk} />
                </div>

                {system.updated && (
                  <p className="beszel-system-updated">Last updated {timeAgo(system.updated)}</p>
                )}
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
                <span className="beszel-panel-badge">{payload.windows.alertHistoryHours}h window</span>
              </div>
              {triggeredAlerts.length > 0 ? (
                <ul className="beszel-list">
                  {triggeredAlerts.map((alert) => (
                    <li key={alert.id ?? `${alert.system}-${alert.name}`} className="beszel-alert-item">
                      <div className="beszel-alert-top">
                        <strong>{alert.name || "Unnamed alert"}</strong>
                        <span className="beszel-alert-system">{alert.systemName || alert.system || "Unknown"}</span>
                      </div>
                      <small>Value: {alert.value ?? "n/a"} / threshold: {alert.min ?? "n/a"}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="beszel-empty-panel">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <h3>All clear</h3>
                  <p className="muted">No active alert triggers in the last {payload.windows.alertHistoryHours} hours.</p>
                </div>
              )}
            </article>

            <article className="beszel-panel">
              <div className="beszel-panel-header">
                <div>
                  <p className="eyebrow">Containers</p>
                  <h2>Container status</h2>
                </div>
                <span className="beszel-panel-badge">{payload.containers.length} total</span>
              </div>
              {payload.containers.length > 0 ? (
                <ul className="beszel-list beszel-container-list">
                  {payload.containers.slice(0, 20).map((container) => (
                    <li key={container.id ?? `${container.system}-${container.name}`} className="beszel-container-item">
                      <div className="beszel-container-top">
                        <strong>{container.name || "Unnamed container"}</strong>
                        <span className={`beszel-container-status ${containerStatusClass(container.status)}`}>
                          {container.status || "unknown"}
                        </span>
                      </div>
                      <div className="beszel-container-meta">
                        <span>{container.systemName || container.system || "Unknown"}</span>
                        {container.image && <span className="beszel-container-image">{container.image}</span>}
                      </div>
                    </li>
                  ))}
                  {payload.containers.length > 20 && (
                    <li className="beszel-list-more">
                      <span>+{payload.containers.length - 20} more containers</span>
                    </li>
                  )}
                </ul>
              ) : (
                <div className="beszel-empty-panel">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                  <h3>No containers</h3>
                  <p className="muted">No container records found.</p>
                </div>
              )}
            </article>
          </section>
        </>
      ) : (
        <section className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2>Beszel unavailable</h2>
          <p className="muted">No live payload is available.</p>
        </section>
      )}
    </div>
  );
}
