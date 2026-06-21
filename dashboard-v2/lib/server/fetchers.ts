import { marvinApiBaseUrl } from "@/lib/server/marvin-server";

export async function fetchMarvinApi<T>(path: string): Promise<T> {
  const response = await fetch(`${marvinApiBaseUrl()}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`MARVIN API returned ${response.status}.`);
  }
  return (await response.json()) as T;
}
