import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "marvin_dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET must be set to a long random value.");
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function hashPassword(password: string): string {
  return createHash("sha1").update(password, "utf8").digest("hex");
}

export function validateCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPasswordHash = process.env.DASHBOARD_PASSWORD_HASH?.toLowerCase();

  if (!expectedUsername || !expectedPasswordHash) {
    throw new Error("DASHBOARD_USERNAME and DASHBOARD_PASSWORD_HASH must be set.");
  }

  const usernameMatches = safeEqual(username, expectedUsername);
  const passwordMatches = safeEqual(hashPassword(password), expectedPasswordHash);
  return usernameMatches && passwordMatches;
}

export async function createSession(username: string): Promise<void> {
  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const session = `${encoded}.${sign(encoded)}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.DASHBOARD_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawSession) {
    return null;
  }

  const [encoded, signature] = rawSession.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.username || payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
