/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "fs";
import path from "path";
import YAML from "yaml";
import { marvinApiBaseUrl } from "./marvin-server";

export type ReportSummary = {
  fileName: string; // mapped to run ID (string)
  label: string;
  href: string;
  modifiedAt: string;
  isLatest: boolean;
  hasSummary?: boolean;
  status?: string;
  riskLevel?: string;
};

export type TaskSummary = {
  taskName: string;
  displayName: string;
  reportDir: string;
  reportCount: number;
  latestReport: ReportSummary | null;
  reports: ReportSummary[];
  riskLevel: string | null;
};

export type ReportDetail = {
  task: TaskSummary;
  selectedReport: ReportSummary | null;
  run: any | null;
};

type TaskConfig = {
  task_name?: string;
  report_dir?: string;
};

const projectRoot = path.resolve(process.cwd(), "..");
const tasksRoot = path.join(projectRoot, "tasks");

function titleize(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTaskConfig(taskDir: string): Promise<TaskConfig | null> {
  const configPath = path.join(taskDir, "config.yaml");
  if (!(await pathExists(configPath))) {
    return null;
  }
  const raw = await fs.readFile(configPath, "utf8");
  return YAML.parse(raw) as TaskConfig;
}

export async function getTasks(): Promise<TaskSummary[]> {
  try {
    const entries = await fs.readdir(tasksRoot, { withFileTypes: true });
    const tasks = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry): Promise<TaskSummary | null> => {
          const config = await readTaskConfig(path.join(tasksRoot, entry.name));
          if (!config?.task_name) {
            return null;
          }
          const taskName = config.task_name;

          // Fetch runs from the MARVIN API
          const url = `${marvinApiBaseUrl()}/runs?task_name=${encodeURIComponent(taskName)}`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            return {
              taskName: taskName,
              displayName: titleize(taskName),
              reportDir: config.report_dir || "",
              reportCount: 0,
              latestReport: null,
              reports: [],
              riskLevel: null
            };
          }

          const runs = (await res.json()) as any[];
          const reports: ReportSummary[] = runs.map((run: any, index: number) => {
            const timeVal = run.observed_at || run.started_at;
            return {
              fileName: String(run.id),
              label: formatDateLabel(timeVal),
              href: `/dashboard/reports/${encodeURIComponent(taskName)}?report=${run.id}`,
              modifiedAt: timeVal,
              isLatest: index === 0,
              hasSummary: !!run.has_summary,
              status: run.status,
              riskLevel: run.risk_level
            };
          });

          const latestReport = reports[0] || null;
          const riskLevel = latestReport ? latestReport.riskLevel || null : null;

          return {
            taskName: taskName,
            displayName: titleize(taskName),
            reportDir: config.report_dir || "",
            reportCount: reports.length,
            latestReport,
            reports,
            riskLevel
          };
        })
    );

    return tasks
      .filter((task): task is TaskSummary => task !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    console.error("Error in getTasks:", err);
    return [];
  }
}

export async function getTask(taskName: string): Promise<TaskSummary | null> {
  const tasks = await getTasks();
  return tasks.find((task) => task.taskName === taskName) ?? null;
}

export async function getReportDetail(
  taskName: string,
  requestedReport?: string
): Promise<ReportDetail | null> {
  const task = await getTask(taskName);
  if (!task) {
    return null;
  }

  let selectedReport: ReportSummary | null = null;
  if (requestedReport) {
    selectedReport = task.reports.find((r) => r.fileName === requestedReport) || null;
  } else {
    selectedReport = task.latestReport;
  }

  if (!selectedReport) {
    return {
      task,
      selectedReport: null,
      run: null
    };
  }

  try {
    const url = `${marvinApiBaseUrl()}/runs/${selectedReport.fileName}?task_name=${encodeURIComponent(taskName)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        task,
        selectedReport,
        run: null
      };
    }
    const run = await res.json();
    return {
      task,
      selectedReport,
      run
    };
  } catch (err) {
    console.error("Error in getReportDetail:", err);
    return {
      task,
      selectedReport,
      run: null
    };
  }
}
