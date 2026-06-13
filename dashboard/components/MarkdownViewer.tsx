import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import YAML from "yaml";
import { JsonViewer } from "@/components/JsonViewer";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

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
  pre({ children }) {
    if (
      isValidElement<{ className?: string; children?: ReactNode }>(children) &&
      typeof children.props.className === "string"
    ) {
      const language = /language-(\w+)/.exec(children.props.className)?.[1];
      const value = String(children.props.children ?? "");

      if (language?.toLowerCase() === "json") {
        try {
          const parsed: unknown = JSON.parse(value.trim());
          if (isJsonValue(parsed)) {
            return (
              <JsonViewer
                data={parsed}
                raw={JSON.stringify(parsed, null, 2)}
              />
            );
          }
        } catch {
          return <pre>{children}</pre>;
        }
      }
    }

    return <pre>{children}</pre>;
  },
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
