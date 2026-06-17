import Link from "next/link";
import { marvinCopy } from "@/lib/marvin-copy";
import type { ReportSummary } from "@/lib/tasks";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function timeAgo(value: string): string {
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

export function ReportList({
  reports,
  selectedFileName
}: {
  reports: ReportSummary[];
  selectedFileName: string | null;
}) {
  const latestReport = reports.find((report) => report.isLatest) ?? null;
  const historicalReports = reports.filter((report) => !report.isLatest);

  if (reports.length === 0) {
    return <p className="muted">{marvinCopy.noTaskReports}</p>;
  }

  return (
    <nav className="report-list" aria-label="Task reports">
      {latestReport ? (
        <Link
          className={
            selectedFileName === latestReport.fileName ? "report-link active" : "report-link"
          }
          href={latestReport.href}
        >
          <div className="report-link-content">
            <span className="report-link-label">Latest</span>
            {latestReport.riskLevel && (
              <span className={`report-link-risk risk-${latestReport.riskLevel}`}>{latestReport.riskLevel}</span>
            )}
          </div>
          <div className="report-link-meta">
            <small>{formatDate(latestReport.modifiedAt)}</small>
            <small className="report-link-ago">{timeAgo(latestReport.modifiedAt)}</small>
          </div>
          {latestReport.hasSummary && (
            <span className="report-link-summary-badge" title="Has LLM summary">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          )}
        </Link>
      ) : null}
      {historicalReports.map((report) => (
        <Link
          key={report.fileName}
          className={
            selectedFileName === report.fileName ? "report-link active" : "report-link"
          }
          href={report.href}
        >
          <div className="report-link-content">
            <span className="report-link-label">{report.label}</span>
            {report.riskLevel && (
              <span className={`report-link-risk risk-${report.riskLevel}`}>{report.riskLevel}</span>
            )}
          </div>
          <div className="report-link-meta">
            <small>{formatDate(report.modifiedAt)}</small>
            <small className="report-link-ago">{timeAgo(report.modifiedAt)}</small>
          </div>
          {report.hasSummary && (
            <span className="report-link-summary-badge" title="Has LLM summary">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
