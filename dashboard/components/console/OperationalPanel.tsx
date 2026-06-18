import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateTime, timeAgo } from "@/lib/console/format";
import { StatusBadge } from "@/components/console/StatusBadge";

export function OperationalPanel({
  title,
  href,
  status,
  conclusion,
  evidence,
  timestamp,
  meta
}: {
  title: string;
  href?: string;
  status: string | null | undefined;
  conclusion: string;
  evidence?: ReactNode;
  timestamp?: string | null;
  meta?: ReactNode;
}) {
  const content = (
    <>
      <div className="console-panel-head">
        <div>
          <h3>{title}</h3>
          {timestamp ? (
            <p className="console-panel-time">
              {timeAgo(timestamp)} <span>{formatDateTime(timestamp)}</span>
            </p>
          ) : null}
        </div>
        <StatusBadge status={status} compact />
      </div>
      <p className="console-panel-conclusion">{conclusion}</p>
      {evidence ? <div className="console-panel-evidence">{evidence}</div> : null}
      {meta ? <div className="console-panel-meta">{meta}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="console-operational-panel">
        {content}
      </Link>
    );
  }

  return <section className="console-operational-panel">{content}</section>;
}
