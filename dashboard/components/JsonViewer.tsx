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

function primitiveClassName(value: JsonPrimitive): string {
  if (value === null) {
    return "json-null";
  }
  return `json-${typeof value}`;
}

function JsonPrimitiveValue({ value }: { value: JsonPrimitive }) {
  const display = typeof value === "string" ? JSON.stringify(value) : String(value);

  return <span className={`json-primitive ${primitiveClassName(value)}`}>{display}</span>;
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
      <div className="json-row json-leaf">
        {name ? <span className="json-key">{name}</span> : null}
        {name ? <span className="json-separator">:</span> : null}
        <JsonPrimitiveValue value={value} />
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const isOpenByDefault = depth < 2;

  return (
    <details className="json-node" open={isOpenByDefault}>
      <summary>
        {name ? <span className="json-key">{name}</span> : null}
        {name ? <span className="json-separator">:</span> : null}
        <span className="json-type">{Array.isArray(value) ? "array" : "object"}</span>
        <span className="json-count">{summarize(value)}</span>
      </summary>
      <div className="json-children">
        {entries.length > 0 ? (
          entries.map(([entryName, entryValue]) => (
            <JsonNode
              key={entryName}
              name={entryName}
              value={entryValue}
              depth={depth + 1}
            />
          ))
        ) : (
          <p className="json-empty">Empty. Astonishingly concise.</p>
        )}
      </div>
    </details>
  );
}

export function JsonViewer({
  data,
  raw
}: {
  data: JsonValue;
  raw: string;
}) {
  return (
    <section className="json-viewer" aria-label="JSON data viewer">
      <header className="json-viewer-header">
        <div>
          <p className="eyebrow">Factual Data</p>
          <h3>Structured JSON</h3>
        </div>
        <span className="status-chip">{summarize(data)}</span>
      </header>
      <div className="json-tree">
        <JsonNode value={data} />
      </div>
      <details className="json-raw">
        <summary>Raw JSON</summary>
        <pre>
          <code>{raw}</code>
        </pre>
      </details>
    </section>
  );
}
