type EmailMessage = {
  from: string;
  to: string;
  headers: Headers;
  raw?: ReadableStream<Uint8Array>;
  setReject(reason: string): void;
};

type WorkerEnv = {
  MARVIN_API_BASE_URL: string;
  MARVIN_EMAIL_CAPTURE_SECRET: string;
};

async function readRawEmail(message: EmailMessage): Promise<string | null> {
  if (!message.raw) return null;
  const reader = message.raw.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function rawToText(rawEmail: string | null): string | null {
  if (!rawEmail) return null;
  const parts = rawEmail.split(/\r?\n\r?\n/);
  return parts.slice(1).join("\n\n").trim() || null;
}

export default {
  async email(message: EmailMessage, env: WorkerEnv) {
    const rawEmail = await readRawEmail(message);
    const payload = {
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      messageId: message.headers.get("message-id"),
      date: message.headers.get("date"),
      headers: Object.fromEntries(message.headers.entries()),
      textBody: rawToText(rawEmail),
      htmlBody: null,
      rawEmail,
      attachments: []
    };

    const response = await fetch(`${env.MARVIN_API_BASE_URL}/api/marvin/email-capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Marvin-Email-Secret": env.MARVIN_EMAIL_CAPTURE_SECRET
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      message.setReject("MARVIN failed to capture this email.");
    }
  }
};
