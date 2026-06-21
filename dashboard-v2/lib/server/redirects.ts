export function appRedirectUrl(request: Request, pathname: string) {
  return new URL(pathname, request.url);
}
