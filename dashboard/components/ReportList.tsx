import Link from "next/link";
import { marvinCopy } from "@/lib/marvin-copy";
import type { ReportSummary } from "@/lib/tasks";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
          <span>Latest</span>
          <small>{formatDate(latestReport.modifiedAt)}</small>
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
          <span>{report.fileName}</span>
          <small>{formatDate(report.modifiedAt)}</small>
        </Link>
      ))}
    </nav>
  );
}
