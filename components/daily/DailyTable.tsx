"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { deleteDailyEntry } from "@/lib/actions";
import type { DailyEntry } from "@/lib/types";

export function DailyTable({ entries }: { entries: DailyEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No entries yet. Add your first one above.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Weight (kg)</TableHead>
          <TableHead>Steps</TableHead>
          <TableHead>Sleep (hrs)</TableHead>
          <TableHead>Water (ml)</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((e) => (
          <TableRow key={e.date}>
            <TableCell className="font-medium">{e.date}</TableCell>
            <TableCell>{e.weight_kg}</TableCell>
            <TableCell>{e.steps.toLocaleString()}</TableCell>
            <TableCell>{e.sleep_hours}</TableCell>
            <TableCell>{e.water_ml}</TableCell>
            <TableCell className="text-muted-foreground">{e.notes}</TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteDailyEntry(e.date)}
              >
                <Trash2 size={14} />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
