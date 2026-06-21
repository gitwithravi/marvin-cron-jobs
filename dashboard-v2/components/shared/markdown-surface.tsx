import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MarkdownSurface({
  markdown,
  className
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="markdown-surface p-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </CardContent>
    </Card>
  );
}
