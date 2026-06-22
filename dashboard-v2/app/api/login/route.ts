import { createSession, validateCredentials } from "@/lib/server/auth";

function redirect(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path }
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    if (!validateCredentials(username, password)) {
      return redirect("/login?error=invalid");
    }
    await createSession(username);
    return redirect("/console");
  } catch {
    return redirect("/login?error=config");
  }
}
