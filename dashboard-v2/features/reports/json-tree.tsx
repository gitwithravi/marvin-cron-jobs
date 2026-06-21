type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarize(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isJsonObject(value)) {
    const keys = Object.keys(value);
    return `${keys.length} field${keys.length === 1 ? "" : "s"}`;
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function PrimitiveValue({ value }: { value: JsonPrimitive }) {
  const display = typeof value === "string" ? JSON.stringify(value) : String(value);
  return <span className="text-sky-200">{display}</span>;
}

function JsonNode({
  name,
  value,
  depth = 0
}: {
  name?: string;
  value: JsonValue;
  depth?: number;
}) {
  if (!Array.isArray(value) && !isJsonObject(value)) {
    return (
      <div className="flex gap-2">
        {name ? <span className="text-muted-foreground">{name}</span> : null}
        {name ? <span className="text-muted-foreground">:</span> : null}
        <PrimitiveValue value={value} />
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);

  return (
    <details open={depth < 2} className="rounded-lg border border-border/50 bg-black/10 p-3">
      <summary className="cursor-pointer list-none text-sm text-foreground">
        {name ? <span className="text-muted-foreground">{name}: </span> : null}
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-primary/90">
          {Array.isArray(value) ? "array" : "object"}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">{summarize(value)}</span>
      </summary>
      <div className="mt-3 space-y-2 pl-3">
        {entries.length > 0 ? (
          entries.map(([entryName, entryValue]) => (
            <JsonNode key={entryName} name={entryName} value={entryValue} depth={depth + 1} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Empty. Astonishingly concise.</p>
        )}
      </div>
    </details>
  );
}

export function JsonTree({ data }: { data: JsonValue }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/90">
            Factual data
          </p>
          <h3 className="text-base font-medium">Structured JSON</h3>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {summarize(data)}
        </span>
      </div>
      <JsonNode value={data} />
      <details className="rounded-lg border border-border/50 bg-black/10 p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto text-xs">
          <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}
