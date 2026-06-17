import { getAttentionItems } from "@/features/attention/getAttentionItems";
import { AttentionScreen } from "@/features/attention/AttentionScreen";

export const dynamic = "force-dynamic";

export default async function AttentionPage() {
  const items = await getAttentionItems();

  return <AttentionScreen items={items} />;
}
