import { NextRequest, NextResponse } from "next/server";
import { chatServerBaseUrl, requireApiSession } from "@/lib/marvin-server";

export async function POST(req: NextRequest) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Invoice PDF is required." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  let response: Response;
  try {
    response = await fetch(`${chatServerBaseUrl()}/invoices/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        pdf_base64: buffer.toString("base64")
      })
    });
  } catch {
    return NextResponse.json(
      { error: "MARVIN chat server is unavailable." },
      { status: 503 }
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    return NextResponse.json(data ?? { error: "Chat server error" }, { status: response.status });
  }
  return NextResponse.json(data);
}
