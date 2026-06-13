import { getSession } from "@/lib/auth";
import { marvinCopy } from "@/lib/marvin-copy";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;
  const message =
    error === "config"
      ? marvinCopy.authConfigError
      : error === "invalid"
        ? marvinCopy.authInvalidError
        : null;

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">{marvinCopy.productName}</p>
          <h1 id="login-title">{marvinCopy.consoleName}</h1>
          <p className="muted">{marvinCopy.loginSubtitle}</p>
        </div>
        {message ? <p className="error-banner">{message}</p> : null}
        <form action="/api/login" method="post" className="login-form">
          <label>
            Username
            <input name="username" type="text" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
