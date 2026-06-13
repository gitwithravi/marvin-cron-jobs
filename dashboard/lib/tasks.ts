import { promises as fs } from "fs";
import path from "path";
import YAML from "yaml";

export type ReportSummary = {
  fileName: string;
  label: string;
  href: string;
  modifiedAt: string;
  isLatest: boolean;
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
  markdown: string | null;
};

type TaskConfig = {
  task_name?: string;
  report_dir?: string;
};

const projectRoot = path.resolve(process.cwd(), "..");
const tasksRoot = path.join(projectRoot, "tasks");

function isInsideProject(filePath: string): boolean {
  const relative = path.relative(projectRoot, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function titleize(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function reportLabel(fileName: string): string {
  if (fileName === "latest.md") {
    return "Latest";
  }
  return fileName.replace(/\.md$/i, "").replace(/_/g, " ");
}

function reportHref(taskName: string, fileName: string): string {
  const base = `/dashboard/reports/${encodeURIComponent(taskName)}`;
  if (fileName === "latest.md") {
    return base;
  }
  return `${base}?report=${encodeURIComponent(fileName)}`;
}

function normalizeReportFileName(fileName: string): string | null {
  if (!fileName.endsWith(".md")) {
    return null;
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return null;
  }
  return fileName;
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

async function listReports(taskName: string, reportDir: string): Promise<ReportSummary[]> {
  const absoluteReportDir = path.resolve(projectRoot, reportDir);
  if (!isInsideProject(absoluteReportDir) || !(await pathExists(absoluteReportDir))) {
    return [];
  }

  const entries = await fs.readdir(absoluteReportDir, { withFileTypes: true });
  const reports = await Promise.all(
    entries
      .filter((entry) => entry.isFile() || entry.isSymbolicLink())
      .map(async (entry): Promise<ReportSummary | null> => {
        const fileName = normalizeReportFileName(entry.name);
        if (!fileName) {
          return null;
        }
        const filePath = path.join(absoluteReportDir, fileName);
        let stats;
        try {
          const realPath = await fs.realpath(filePath);
          if (!isInsideProject(realPath)) {
            return null;
          }
          stats = await fs.stat(realPath);
        } catch {
          return null;
        }
        return {
          fileName,
          label: reportLabel(fileName),
          href: reportHref(taskName, fileName),
          modifiedAt: stats.mtime.toISOString(),
          isLatest: fileName === "latest.md"
        };
      })
  );

  return reports
    .filter((report): report is ReportSummary => report !== null)
    .sort((a, b) => {
      if (a.isLatest) {
        return -1;
      }
      if (b.isLatest) {
        return 1;
      }
      return b.fileName.localeCompare(a.fileName);
    });
}

async function readRiskLevel(reportDir: string): Promise<string | null> {
  const latestPath = path.resolve(projectRoot, reportDir, "latest.md");
  if (!isInsideProject(latestPath) || !(await pathExists(latestPath))) {
    return null;
  }
  const realPath = await fs.realpath(latestPath);
  if (!isInsideProject(realPath)) {
    return null;
  }
  const markdown = await fs.readFile(latestPath, "utf8");
  const match = markdown.match(/## Risk Level\s+([a-zA-Z]+)/);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function getTasks(): Promise<TaskSummary[]> {
  const entries = await fs.readdir(tasksRoot, { withFileTypes: true });
  const tasks = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<TaskSummary | null> => {
        const config = await readTaskConfig(path.join(tasksRoot, entry.name));
        if (!config?.task_name || !config.report_dir) {
          return null;
        }
        const reports = await listReports(config.task_name, config.report_dir);
        const latestReport =
          reports.find((report) => report.isLatest) ??
          reports.find((report) => report.fileName !== "latest.md") ??
          null;

        return {
          taskName: config.task_name,
          displayName: titleize(config.task_name),
          reportDir: config.report_dir,
          reportCount: reports.filter((report) => !report.isLatest).length,
          latestReport,
          reports,
          riskLevel: await readRiskLevel(config.report_dir)
        };
      })
  );

  return tasks
    .filter((task): task is TaskSummary => task !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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

  const selectedFileName = requestedReport
    ? normalizeReportFileName(requestedReport)
    : "latest.md";
  if (!selectedFileName) {
    return {
      task,
      selectedReport: null,
      markdown: null
    };
  }

  const selectedReport =
    task.reports.find((report) => report.fileName === selectedFileName) ?? null;
  if (!selectedReport) {
    return {
      task,
      selectedReport: null,
      markdown: null
    };
  }

  const reportPath = path.resolve(projectRoot, task.reportDir, selectedReport.fileName);
  if (!isInsideProject(reportPath)) {
    return {
      task,
      selectedReport: null,
      markdown: null
    };
  }
  const realPath = await fs.realpath(reportPath);
  if (!isInsideProject(realPath)) {
    return {
      task,
      selectedReport: null,
      markdown: null
    };
  }

  return {
    task,
    selectedReport,
    markdown: await fs.readFile(realPath, "utf8")
  };
}
