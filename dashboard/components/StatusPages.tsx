"use client";

import { useState } from "react";

function extractLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url;
  }
}

export function StatusPages({ urls }: { urls: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (urls.length === 0) {
    return (
      <section className="empty-state">
        <h2>No status pages configured</h2>
        <p className="muted">Add PUBLIC_STATUS_PAGES to your .env.local file.</p>
      </section>
    );
  }

  const activeUrl = urls[activeIndex] ?? urls[0];

  return (
    <div className="status-pages-stack">
      <nav className="status-tabs" role="tablist">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            role="tab"
            className={i === activeIndex ? "tab active" : "tab"}
            aria-selected={i === activeIndex}
            onClick={() => setActiveIndex(i)}
          >
            {extractLabel(url)}
          </button>
        ))}
        <a
          href={activeUrl}
          target="_blank"
          rel="noreferrer"
          className="tab tab-external"
        >
          Open in new tab ↗
        </a>
      </nav>
      <iframe
        src={activeUrl}
        className="status-page-iframe"
        title={extractLabel(activeUrl)}
        sandbox="allow-scripts allow-same-origin allow-forms"
        loading="lazy"
      />
    </div>
  );
}
