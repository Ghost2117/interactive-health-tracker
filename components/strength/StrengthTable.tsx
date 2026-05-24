"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { deleteStrengthEntry } from "@/lib/actions";
import type { StrengthEntry } from "@/lib/types";

export function StrengthTable({ entries }: { entries: StrengthEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No exercises logged yet.</p>;
  }

  let lastDate = "";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Exercise</TableHead>
          <TableHead>Muscle Group</TableHead>
          <TableHead>Sets</TableHead>
          <TableHead>Reps</TableHead>
          <TableHead>Weight (kg)</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((e, i) => {
          const showDate = e.date !== lastDate;
          lastDate = e.date;
          return (
            <TableRow key={`${e.date}-${e.exercise}-${i}`}>
              <TableCell className="font-medium">
                {showDate ? e.date : <span className="text-muted-foreground">↳</span>}
              </TableCell>
              <TableCell>{e.exercise}</TableCell>
              <TableCell>
                {e.muscle_group && <Badge variant="secondary">{e.muscle_group}</Badge>}
              </TableCell>
              <TableCell>{e.sets}</TableCell>
              <TableCell>{e.reps}</TableCell>
              <TableCell>{e.weight_kg > 0 ? e.weight_kg : "BW"}</TableCell>
              <TableCell className="text-muted-foreground">{e.notes}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteStrengthEntry(e.date, e.exercise)}
                >
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
