import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/marvin-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const unauthorized = await requireApiSession();
  if (unauthorized) {
    return unauthorized;
  }

  const { path: parts } = await params;
  const relativePath = parts.join("/");
  if (!relativePath.startsWith("data/invoices/") || relativePath.includes("..")) {
    return NextResponse.json({ error: "Invalid invoice file path." }, { status: 400 });
  }

  const root = path.resolve(process.cwd(), "..");
  const absolutePath = path.resolve(root, relativePath);
  const invoicesRoot = path.resolve(root, "data/invoices");
  if (!absolutePath.startsWith(invoicesRoot) || !existsSync(absolutePath)) {
    return NextResponse.json({ error: "Invoice file not found." }, { status: 404 });
  }

  const file = readFileSync(absolutePath);
  return new NextResponse(file, {
    headers: {
      "Content-Disposition": `inline; filename="${path.basename(absolutePath)}"`,
      "Content-Type": "application/pdf"
    }
  });
}
