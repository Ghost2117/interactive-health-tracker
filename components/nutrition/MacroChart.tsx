"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { NutritionEntry } from "@/lib/types";

const COLORS = {
  protein: "hsl(221,83%,53%)",
  carbs: "hsl(142,71%,45%)",
  fat: "hsl(38,92%,50%)",
};

type DailyTotal = {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
};

function getLast30Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function MacroChart({ entries }: { entries: NutritionEntry[] }) {
  const last30 = getLast30Days();
  const last30Set = new Set(last30);

  // Aggregate daily totals for last 30 days
  const dailyMap = entries
    .filter((e) => last30Set.has(e.date))
    .reduce<Record<string, DailyTotal>>((acc, e) => {
      if (!acc[e.date]) {
        acc[e.date] = { date: e.date, protein: 0, carbs: 0, fat: 0 };
      }
      acc[e.date].protein += e.protein_g;
      acc[e.date].carbs += e.carbs_g;
      acc[e.date].fat += e.fat_g;
      return acc;
    }, {});

  const barData: DailyTotal[] = last30
    .filter((d) => dailyMap[d])
    .map((d) => ({
      ...dailyMap[d],
      date: d.slice(5), // show MM-DD
    }));

  // Today's macro split
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter((e) => e.date === today);
  const todayTotals = todayEntries.reduce(
    (acc, e) => ({
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbs_g,
      fat: acc.fat + e.fat_g,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );

  const pieData = [
    { name: "Protein", value: todayTotals.protein, color: COLORS.protein },
    { name: "Carbs", value: todayTotals.carbs, color: COLORS.carbs },
    { name: "Fat", value: todayTotals.fat, color: COLORS.fat },
  ].filter((d) => d.value > 0);

  const hasTodayData = pieData.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Daily macro stacked bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Macros (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No data in the last 30 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  unit="g"
                />
                <Tooltip
                  formatter={(value, name) => [`${value}g`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="protein" name="Protein" stackId="macros" fill={COLORS.protein} />
                <Bar dataKey="carbs" name="Carbs" stackId="macros" fill={COLORS.carbs} />
                <Bar dataKey="fat" name="Fat" stackId="macros" fill={COLORS.fat} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Today's macro split pie chart */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Macro Split</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasTodayData ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No meals logged today.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value}g`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
