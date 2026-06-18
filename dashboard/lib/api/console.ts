import { marvinApiBaseUrl } from "@/lib/marvin-server";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchMarvinApi<T>(path: string): Promise<T> {
  const response = await fetch(`${marvinApiBaseUrl()}${path}`, {
    cache: "no-store"
  });
  return readJson<T>(response);
}
