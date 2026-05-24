import { getStrengthEntries } from "@/lib/actions";
import { StrengthForm } from "@/components/strength/StrengthForm";
import { StrengthTable } from "@/components/strength/StrengthTable";

export default async function StrengthPage() {
  const entries = await getStrengthEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Strength Training</h1>
        <p className="text-sm text-muted-foreground">Log exercises by sets, reps, and weight</p>
      </div>
      <StrengthForm />
      <StrengthTable entries={entries} />
    </div>
  );
}
