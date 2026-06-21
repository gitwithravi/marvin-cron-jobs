import { redirect } from "next/navigation";
import { Shield, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession } from "@/lib/server/auth";
import { marvinCopy } from "@/lib/marvin-copy";

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
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_420px]">
        <Card className="border-primary/12 bg-black/20">
          <CardContent className="flex h-full flex-col justify-between gap-8 p-8 lg:p-10">
            <div className="space-y-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary/90">
                Local Ops / Single Operator
              </p>
              <div className="space-y-3">
                <h1 className="max-w-[12ch] text-5xl font-medium tracking-tight text-foreground">
                  {marvinCopy.consoleName}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  {marvinCopy.loginSubtitle}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card/65 p-5">
                <SquareTerminal className="size-5 text-primary" />
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Purpose
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/90">
                  See what broke, what MARVIN concluded, and what still needs human ceremony.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/65 p-5">
                <Shield className="size-5 text-primary" />
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Surface
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/90">
                  Private command center. Not an admin panel.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/90">
              Authenticate
            </p>
            <CardTitle>Enter console</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/api/login" method="post" className="space-y-5">
              {message ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
                  {message}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" type="text" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
