"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StrengthEntry } from "@/lib/types";

type Props = {
  entries: StrengthEntry[];
};

type SessionData = {
  date: string;
  maxWeight: number;
  volume: number;
};

export function ProgressionChart({ entries }: Props) {
  const exercises = Array.from(
    new Set(entries.map((e) => e.exercise))
  ).sort();

  const [selectedExercise, setSelectedExercise] = useState<string>(
    exercises[0] ?? ""
  );

  const filtered = entries.filter((e) => e.exercise === selectedExercise);

  const byDate = filtered.reduce<Record<string, SessionData>>((acc, e) => {
    const existing = acc[e.date];
    const volume = e.sets * e.reps * e.weight_kg;
    if (existing) {
      existing.maxWeight = Math.max(existing.maxWeight, e.weight_kg);
      existing.volume += volume;
    } else {
      acc[e.date] = { date: e.date, maxWeight: e.weight_kg, volume };
    }
    return acc;
  }, {});

  const chartData: SessionData[] = Object.values(byDate).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const hasData = chartData.length > 0;

  const noDataNode = (
    <p className="text-sm text-muted-foreground text-center py-8">
      No data yet
    </p>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Progression</CardTitle>
        {exercises.length > 0 && (
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {exercises.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardContent>
        {!hasData || !selectedExercise ? (
          noDataNode
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Max Weight (kg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--card-foreground)",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      name="Max Weight (kg)"
                      stroke="#0d9488"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Volume (sets × reps × kg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--card-foreground)",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      name="Total Volume (kg)"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
