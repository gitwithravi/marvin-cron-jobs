function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function appRedirectUrl(request: Request, pathname: string): URL {
  const headers = request.headers;
  const proto =
    firstHeaderValue(headers.get("x-forwarded-proto")) ??
    new URL(request.url).protocol.replace(":", "");
  const host =
    firstHeaderValue(headers.get("x-forwarded-host")) ??
    headers.get("host") ??
    new URL(request.url).host;

  return new URL(pathname, `${proto}://${host}`);
}
