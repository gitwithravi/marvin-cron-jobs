import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import YAML from "yaml";

function formatCode(language: string | undefined, value: string): string {
  const normalized = language?.toLowerCase();
  const trimmed = value.trim();

  if (normalized === "json") {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }

  if (normalized === "yaml" || normalized === "yml") {
    try {
      return YAML.stringify(YAML.parse(trimmed)).trimEnd();
    } catch {
      return value;
    }
  }

  return value;
}

const components: Components = {
  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className ?? "")?.[1];
    const value = String(children ?? "");

    if (!className) {
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    }

    return (
      <code className={className} {...props}>
        {formatCode(language, value)}
      </code>
    );
  },
  a({ children, href, ...props }) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }
};

export function MarkdownViewer({ markdown }: { markdown: string }) {
  return (
    <article className="markdown-viewer">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
