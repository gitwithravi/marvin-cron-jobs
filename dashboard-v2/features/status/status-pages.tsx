"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";

function extractLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || parsed.hostname;
  } catch {
    return url;
  }
}

export function StatusPages({ urls }: { urls: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (urls.length === 0) {
    return (
      <EmptyState
        title="No status pages configured"
        description="Add PUBLIC_STATUS_PAGES to dashboard-v2/.env.local."
      />
    );
  }

  const activeUrl = urls[activeIndex] ?? urls[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={String(activeIndex)} onValueChange={(value) => setActiveIndex(Number(value))}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {urls.map((url, index) => (
              <TabsTrigger
                key={url}
                value={String(index)}
                className="rounded-full border border-border/70 bg-card/70 px-4 py-2 data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10"
              >
                {extractLabel(url)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button asChild variant="outline">
          <a href={activeUrl} target="_blank" rel="noreferrer">
            Open in new tab
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/65">
        <iframe
          src={activeUrl}
          className="h-[70vh] w-full bg-white"
          title={extractLabel(activeUrl)}
          sandbox="allow-scripts allow-same-origin allow-forms"
          loading="lazy"
        />
      </div>
    </div>
  );
}
