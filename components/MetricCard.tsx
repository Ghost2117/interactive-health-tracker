import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  sub?: string;
  accent?: string;
};

export function MetricCard({ title, value, unit, icon: Icon, sub, accent }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div
          className="rounded-lg p-1.5"
          style={{
            color: accent ?? "var(--muted-foreground)",
            backgroundColor: accent ? `${accent}18` : undefined,
          }}
        >
          <Icon size={16} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
