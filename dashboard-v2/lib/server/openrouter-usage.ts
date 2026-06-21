import { existsSync, readFileSync } from "fs";
import path from "path";

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

export type OpenRouterAccountUsage = {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
  usagePercent: number;
  fetchedAt: string;
};

export type OpenRouterUsageResult =
  | { ok: true; usage: OpenRouterAccountUsage }
  | { ok: false; error: string };

type CreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
};

function readRootEnvValue(name: string): string | undefined {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env")
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const envFile = readFileSync(envPath, "utf8");
    const line = envFile
      .split(/\r?\n/)
      .find((candidate) => candidate.trim().startsWith(`${name}=`));
    if (!line) {
      continue;
    }

    const rawValue = line.slice(line.indexOf("=") + 1).trim();
    return rawValue.replace(/^['"]|['"]$/g, "");
  }

  return undefined;
}

function openRouterManagementKey(): string | undefined {
  return process.env.OPENROUTER_MANAGEMENT_KEY || readRootEnvValue("OPENROUTER_MANAGEMENT_KEY");
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getOpenRouterAccountUsage(): Promise<OpenRouterUsageResult> {
  const apiKey = openRouterManagementKey();
  if (!apiKey) {
    return { ok: false, error: "OPENROUTER_MANAGEMENT_KEY is not configured." };
  }

  try {
    const response = await fetch(OPENROUTER_CREDITS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return { ok: false, error: `OpenRouter returned ${response.status}.` };
    }

    const payload = (await response.json()) as CreditsResponse;
    const totalCredits = asNumber(payload.data?.total_credits);
    const totalUsage = asNumber(payload.data?.total_usage);
    const remainingCredits = Math.max(totalCredits - totalUsage, 0);
    const usagePercent = totalCredits > 0 ? Math.min((totalUsage / totalCredits) * 100, 100) : 0;

    return {
      ok: true,
      usage: {
        totalCredits,
        totalUsage,
        remainingCredits,
        usagePercent,
        fetchedAt: new Date().toISOString()
      }
    };
  } catch {
    return { ok: false, error: "OpenRouter usage could not be loaded." };
  }
}
