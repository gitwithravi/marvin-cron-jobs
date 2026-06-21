"use client";

import Link from "next/link";
import { List } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

type ReportItem = {
  fileName: string;
  status?: string;
  riskLevel?: string;
  isLatest: boolean;
  label: string;
  modifiedAt: string;
};

function ReportLinks({
  taskName,
  reports,
  selectedFileName,
  mobile = false
}: {
  taskName: string;
  reports: ReportItem[];
  selectedFileName: string | null;
  mobile?: boolean;
}) {
  return (
    <div className="space-y-2">
      {reports.map((item) => {
        const isSelected = item.fileName === selectedFileName;
        return (
          <Link
            key={item.fileName}
            href={`/console/reports/${encodeURIComponent(taskName)}?report=${item.fileName}`}
            className={`block rounded-lg border p-3 transition-colors ${
              isSelected
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-black/10 hover:border-primary/20"
            }`}
          >
            <div className={`flex gap-3 ${mobile ? "flex-col" : "items-start justify-between"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.isLatest ? "Latest" : item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.modifiedAt)}</p>
              </div>
              <StatusBadge value={item.riskLevel || item.status} className={mobile ? "self-start" : ""} />
            </div>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {timeAgo(item.modifiedAt)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

export function ReportRunSelector({
  taskName,
  reports,
  selectedFileName
}: {
  taskName: string;
  reports: ReportItem[];
  selectedFileName: string | null;
}) {
  return (
    <>
      <div className="xl:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-center sm:w-auto">
              <List className="size-4" />
              All runs
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Report runs</DialogTitle>
              <DialogDescription>Select a run to inspect conclusions and evidence.</DialogDescription>
            </DialogHeader>
            <ReportLinks
              taskName={taskName}
              reports={reports}
              selectedFileName={selectedFileName}
              mobile
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="hidden h-fit xl:block">
        <CardContent className="p-3">
          <ReportLinks taskName={taskName} reports={reports} selectedFileName={selectedFileName} />
        </CardContent>
      </Card>
    </>
  );
}
