type DataListProps = {
  items: Array<{ label: string; value: React.ReactNode }>;
};

export function DataList({ items }: DataListProps) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "var(--spacing-xs) var(--spacing)",
        fontSize: "0.85rem"
      }}
    >
      {items.map((item, index) => (
        <div key={index} style={{ display: "contents" }}>
          <dt style={{ color: "var(--text-muted)", fontWeight: 500 }}>{item.label}</dt>
          <dd style={{ color: "var(--text)" }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
