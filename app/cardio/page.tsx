import { getCardioEntries } from "@/lib/actions";
import { CardioPageClient } from "@/components/cardio/CardioPageClient";

export default async function CardioPage() {
  const entries = await getCardioEntries();
  return <CardioPageClient entries={entries} />;
}
