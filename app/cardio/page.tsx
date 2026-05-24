import { getCardioEntries } from "@/lib/actions";
import { CardioForm } from "@/components/cardio/CardioForm";
import { CardioTable } from "@/components/cardio/CardioTable";

export default async function CardioPage() {
  const entries = await getCardioEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cardio</h1>
        <p className="text-sm text-muted-foreground">Running, cycling, swimming, and more</p>
      </div>
      <CardioForm />
      <CardioTable entries={entries} />
    </div>
  );
}
