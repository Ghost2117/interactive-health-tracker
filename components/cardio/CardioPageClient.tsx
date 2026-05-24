"use client";

import { useUnit } from "@/hooks/useUnit";
import { CardioForm } from "./CardioForm";
import { CardioTable } from "./CardioTable";
import type { CardioEntry } from "@/lib/types";

export function CardioPageClient({ entries }: { entries: CardioEntry[] }) {
  const [unit, setUnit] = useUnit();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cardio</h1>
          <p className="text-sm text-muted-foreground">Running, cycling, swimming, and more</p>
        </div>
        <div className="flex items-center rounded-md border overflow-hidden text-sm">
          <button
            onClick={() => setUnit("mi")}
            className={`px-3 py-1.5 transition-colors ${
              unit === "mi"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            mi
          </button>
          <button
            onClick={() => setUnit("km")}
            className={`px-3 py-1.5 transition-colors ${
              unit === "km"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            km
          </button>
        </div>
      </div>
      <CardioForm unit={unit} />
      <CardioTable entries={entries} unit={unit} />
    </div>
  );
}
