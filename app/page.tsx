import { Activity, Dumbbell, Footprints, Moon, Utensils } from "lucide-react";
import { getDailyEntries, getNutritionEntries, getStrengthEntries } from "@/lib/actions";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function last30DaysCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const [daily, nutrition, strength] = await Promise.all([
    getDailyEntries(),
    getNutritionEntries(),
    getStrengthEntries(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = last30DaysCutoff();

  const todayDaily = daily.find((e) => e.date === today);
  const todayNutrition = nutrition.filter((e) => e.date === today);
  const todayCalories = todayNutrition.reduce((s, e) => s + e.calories, 0);
  const lastWorkoutDate = strength.length > 0 ? strength[strength.length - 1].date : null;

  const recent = daily.filter((e) => e.date >= cutoff);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          title="Steps Today"
          value={todayDaily ? todayDaily.steps.toLocaleString() : "—"}
          icon={Footprints}
          sub={todayDaily ? undefined : "No entry yet"}
        />
        <MetricCard
          title="Sleep Last Night"
          value={todayDaily ? todayDaily.sleep_hours : "—"}
          unit={todayDaily ? "hrs" : undefined}
          icon={Moon}
          sub={todayDaily ? undefined : "No entry yet"}
        />
        <MetricCard
          title="Calories Today"
          value={todayCalories > 0 ? todayCalories.toLocaleString() : "—"}
          unit={todayCalories > 0 ? "kcal" : undefined}
          icon={Utensils}
          sub={todayCalories === 0 ? "No meals logged" : `${todayNutrition.length} meal${todayNutrition.length !== 1 ? "s" : ""}`}
        />
        <MetricCard
          title="Last Workout"
          value={lastWorkoutDate ?? "—"}
          icon={Dumbbell}
          sub={lastWorkoutDate ? undefined : "No workouts yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity size={14} /> Weight (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recent} dataKey="weight_kg" unit=" kg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Footprints size={14} /> Steps (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recent} dataKey="steps" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Moon size={14} /> Sleep (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recent} dataKey="sleep_hours" unit=" hrs" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
