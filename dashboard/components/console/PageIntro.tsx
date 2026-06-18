import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="console-page-intro">
      <div>
        <p className="console-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="console-page-copy">{description}</p>
      </div>
      {actions ? <div className="console-page-actions">{actions}</div> : null}
    </header>
  );
}
