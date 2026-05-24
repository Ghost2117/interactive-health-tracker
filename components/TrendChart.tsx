"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DataPoint = Record<string, string | number>;

type Props = {
  data: DataPoint[];
  dataKey: string;
  xKey?: string;
  color?: string;
  unit?: string;
};

export function TrendChart({
  data,
  dataKey,
  xKey = "date",
  color = "#3b82f6",
  unit = "",
}: Props) {
  const formatted = data.map((d) => ({
    ...d,
    [xKey]: typeof d[xKey] === "string"
      ? (d[xKey] as string).slice(5)
      : d[xKey],
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v) => [`${v}${unit}`, ""]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey={dataKey} fill={color} opacity={0.25} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
