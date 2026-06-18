import { getSession } from "@/lib/auth";
import { marvinCopy } from "@/lib/marvin-copy";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) {
    redirect("/console");
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
        <div className="login-intro">
          <p className="console-eyebrow">Local Ops / Single Operator</p>
          <h1 id="login-title">{marvinCopy.consoleName}</h1>
          <p className="login-copy">{marvinCopy.loginSubtitle}</p>

          <div className="login-posture">
            <div>
              <span className="login-posture-label">Purpose</span>
              <strong>See what broke, what MARVIN concluded, and what still needs human ceremony.</strong>
            </div>
            <div>
              <span className="login-posture-label">Surface</span>
              <strong>Private command center. Not an admin panel.</strong>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-header">
            <p className="console-eyebrow">Authenticate</p>
            <h2>Sign in</h2>
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
            <button type="submit">Enter console</button>
          </form>
        </div>
      </section>
    </main>
  );
}
