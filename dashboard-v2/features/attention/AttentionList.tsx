import { Panel } from "@/components/ui/Panel";
import { type AttentionItem } from "@/features/attention/getAttentionItems";
import { AttentionItemCard } from "./AttentionItemCard";

type AttentionListProps = {
  items: AttentionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function AttentionList({ items, selectedId, onSelect }: AttentionListProps) {
  return (
    <Panel style={{ overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        {items.map((item) => (
          <AttentionItemCard
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </Panel>
  );
}
