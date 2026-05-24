import { getStrengthEntries } from "@/lib/actions";
import { StrengthForm } from "@/components/strength/StrengthForm";
import { StrengthTable } from "@/components/strength/StrengthTable";
import { ProgressionChart } from "@/components/strength/ProgressionChart";

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
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Exercise Progression</h2>
        <ProgressionChart entries={entries} />
      </section>
    </div>
  );
}
