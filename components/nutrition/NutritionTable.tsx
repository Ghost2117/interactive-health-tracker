"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { deleteNutritionEntry } from "@/lib/actions";
import type { NutritionEntry } from "@/lib/types";

const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-yellow-100 text-yellow-800",
  lunch: "bg-green-100 text-green-800",
  dinner: "bg-blue-100 text-blue-800",
  snack: "bg-purple-100 text-purple-800",
};

export function NutritionTable({ entries }: { entries: NutritionEntry[] }) {
  const sorted = [...entries].sort((a, b) =>
    b.date.localeCompare(a.date) || a.meal_type.localeCompare(b.meal_type)
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No meals logged yet.</p>;
  }

  let lastDate = "";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Meal</TableHead>
          <TableHead>Food</TableHead>
          <TableHead>Cal</TableHead>
          <TableHead>Protein (g)</TableHead>
          <TableHead>Carbs (g)</TableHead>
          <TableHead>Fat (g)</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((e, i) => {
          const showDate = e.date !== lastDate;
          lastDate = e.date;

          const dayEntries = sorted.filter((x) => x.date === e.date);
          const isLastInDay =
            i === sorted.length - 1 || sorted[i + 1].date !== e.date;

          const dayTotals = {
            calories: dayEntries.reduce((s, x) => s + x.calories, 0),
            protein_g: dayEntries.reduce((s, x) => s + x.protein_g, 0),
            carbs_g: dayEntries.reduce((s, x) => s + x.carbs_g, 0),
            fat_g: dayEntries.reduce((s, x) => s + x.fat_g, 0),
          };

          return (
            <>
              <TableRow key={`${e.date}-${e.meal_type}-${e.food}-${i}`}>
                <TableCell className="font-medium">
                  {showDate ? e.date : ""}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEAL_COLORS[e.meal_type] ?? ""}`}>
                    {e.meal_type}
                  </span>
                </TableCell>
                <TableCell>{e.food}</TableCell>
                <TableCell>{e.calories}</TableCell>
                <TableCell>{e.protein_g}</TableCell>
                <TableCell>{e.carbs_g}</TableCell>
                <TableCell>{e.fat_g}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNutritionEntry(e.date, e.meal_type, e.food)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
              {isLastInDay && (
                <TableRow key={`${e.date}-total`} className="bg-muted/40 font-medium text-sm">
                  <TableCell />
                  <TableCell colSpan={2} className="text-muted-foreground text-xs">Daily total</TableCell>
                  <TableCell>{dayTotals.calories}</TableCell>
                  <TableCell>{dayTotals.protein_g}</TableCell>
                  <TableCell>{dayTotals.carbs_g}</TableCell>
                  <TableCell>{dayTotals.fat_g}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
