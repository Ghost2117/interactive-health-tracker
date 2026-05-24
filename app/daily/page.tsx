import { getDailyEntries } from "@/lib/actions";
import { DailyForm } from "@/components/daily/DailyForm";
import { DailyTable } from "@/components/daily/DailyTable";

export default async function DailyPage() {
  const entries = await getDailyEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Daily Metrics</h1>
        <p className="text-sm text-muted-foreground">Weight, steps, sleep, and hydration</p>
      </div>
      <DailyForm />
      <DailyTable entries={entries} />
    </div>
  );
}
