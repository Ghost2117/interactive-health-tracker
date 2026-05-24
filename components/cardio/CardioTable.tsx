"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { deleteCardioEntry } from "@/lib/actions";
import type { CardioEntry } from "@/lib/types";

export function CardioTable({ entries }: { entries: CardioEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No sessions logged yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead>Duration (min)</TableHead>
          <TableHead>Distance (km)</TableHead>
          <TableHead>Avg HR</TableHead>
          <TableHead>Pace</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((e, i) => {
          const pace =
            e.distance_km > 0
              ? `${Math.floor(e.duration_min / e.distance_km)}:${String(Math.round(((e.duration_min / e.distance_km) % 1) * 60)).padStart(2, "0")} /km`
              : "—";
          return (
            <TableRow key={`${e.date}-${e.activity_type}-${i}`}>
              <TableCell className="font-medium">{e.date}</TableCell>
              <TableCell><Badge variant="secondary">{e.activity_type}</Badge></TableCell>
              <TableCell>{e.duration_min}</TableCell>
              <TableCell>{e.distance_km > 0 ? e.distance_km : "—"}</TableCell>
              <TableCell>{e.avg_heart_rate > 0 ? e.avg_heart_rate : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{pace}</TableCell>
              <TableCell className="text-muted-foreground">{e.notes}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteCardioEntry(e.date, e.activity_type)}
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
