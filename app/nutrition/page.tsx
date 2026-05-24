import { getNutritionEntries } from "@/lib/actions";
import { NutritionForm } from "@/components/nutrition/NutritionForm";
import { NutritionTable } from "@/components/nutrition/NutritionTable";
import { MacroChart } from "@/components/nutrition/MacroChart";
import { ExportButton } from "@/components/ExportButton";

export default async function NutritionPage() {
  const entries = await getNutritionEntries();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Nutrition</h1>
          <p className="text-sm text-muted-foreground">Meals, calories, and macros</p>
        </div>
        <ExportButton href="/api/export/nutrition" filename="nutrition.csv" />
      </div>
      <NutritionForm />
      <NutritionTable entries={entries} />
      <MacroChart entries={entries} />
    </div>
  );
}
