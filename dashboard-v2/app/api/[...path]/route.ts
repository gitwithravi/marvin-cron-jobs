import { NextRequest } from "next/server";
import { marvinApiBaseUrl, requireApiSession } from "@/lib/server/marvin-server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { path } = await params;
  const url = new URL(req.url);
  const upstreamUrl = `${marvinApiBaseUrl()}/${path.join("/")}${url.search}`;
  const headers = new Headers(req.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
    cache: "no-store"
  });

  const responseHeaders = new Headers(response.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header);
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(req, context.params);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(req, context.params);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(req, context.params);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(req, context.params);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(req, context.params);
}
