import { Activity, Dumbbell, Flame, Footprints, Moon, Utensils } from "lucide-react";
import {
  getCardioEntries, getDailyEntries, getNutritionEntries, getStrengthEntries,
} from "@/lib/actions";
import { MetricCard } from "@/components/MetricCard";
import { TrendChart } from "@/components/TrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function last30DaysCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff.toISOString().slice(0, 10);
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const [daily, nutrition, strength, cardio] = await Promise.all([
    getDailyEntries(),
    getNutritionEntries(),
    getStrengthEntries(),
    getCardioEntries(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = last30DaysCutoff();
  const weekStart = startOfWeek();

  const todayDaily = daily.find((e) => e.date === today);
  const todayNutrition = nutrition.filter((e) => e.date === today);
  const todayCalories = todayNutrition.reduce((s, e) => s + e.calories, 0);
  const todayProtein = todayNutrition.reduce((s, e) => s + e.protein_g, 0);
  const lastWorkoutDate = strength.length > 0 ? strength[strength.length - 1].date : null;
  const weekCardioSessions = cardio.filter((e) => e.date >= weekStart).length;

  const recentDaily = daily.filter((e) => e.date >= cutoff);

  // Aggregate daily calories from nutrition (multiple rows per day → one point)
  const calByDate = nutrition.reduce<Record<string, number>>((acc, e) => {
    if (e.date >= cutoff) acc[e.date] = (acc[e.date] ?? 0) + e.calories;
    return acc;
  }, {});
  const calTrend = Object.entries(calByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, calories]) => ({ date, calories }));

  // Aggregate daily cardio distance
  const cardioByDate = cardio.reduce<Record<string, number>>((acc, e) => {
    if (e.date >= cutoff) acc[e.date] = (acc[e.date] ?? 0) + e.distance_km;
    return acc;
  }, {});
  const cardioTrend = Object.entries(cardioByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, distance_km]) => ({ date, distance_km }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
          title="Protein Today"
          value={todayProtein > 0 ? todayProtein : "—"}
          unit={todayProtein > 0 ? "g" : undefined}
          icon={Flame}
          sub={todayProtein === 0 ? "No meals logged" : undefined}
        />
        <MetricCard
          title="Last Workout"
          value={lastWorkoutDate ?? "—"}
          icon={Dumbbell}
          sub={lastWorkoutDate ? undefined : "No workouts yet"}
        />
        <MetricCard
          title="Cardio This Week"
          value={weekCardioSessions}
          unit={weekCardioSessions === 1 ? "session" : "sessions"}
          icon={Activity}
          sub={weekCardioSessions === 0 ? "No sessions yet" : undefined}
        />
      </div>

      {/* Trend charts — row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity size={14} /> Weight (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recentDaily} dataKey="weight_kg" unit=" kg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Footprints size={14} /> Steps (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recentDaily} dataKey="steps" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Moon size={14} /> Sleep (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={recentDaily} dataKey="sleep_hours" unit=" hrs" />
          </CardContent>
        </Card>
      </div>

      {/* Trend charts — row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Utensils size={14} /> Calories (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {calTrend.length > 0
              ? <TrendChart data={calTrend} dataKey="calories" unit=" kcal" />
              : <p className="text-xs text-muted-foreground text-center py-8">No nutrition data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity size={14} /> Cardio Distance (30 days, km)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cardioTrend.length > 0
              ? <TrendChart data={cardioTrend} dataKey="distance_km" unit=" km" />
              : <p className="text-xs text-muted-foreground text-center py-8">No cardio data yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
