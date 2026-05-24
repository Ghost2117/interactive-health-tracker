"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { deleteStrengthEntry } from "@/lib/actions";
import { StrengthForm } from "./StrengthForm";
import type { StrengthEntry } from "@/lib/types";

export function StrengthTable({ entries }: { entries: StrengthEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const [editing, setEditing] = useState<StrengthEntry | null>(null);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No exercises logged yet.</p>;
  }

  let lastDate = "";

  return (
    <>
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
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((e, i) => {
            const showDate = e.date !== lastDate;
            lastDate = e.date;
            return (
              <TableRow
                key={`${e.date}-${e.exercise}-${i}`}
                className={`group ${showDate ? "bg-muted/30 dark:bg-muted/10" : ""}`}
              >
                <TableCell className={showDate
                  ? "pl-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-l-2 border-primary"
                  : "pl-6 text-muted-foreground"
                }>
                  {showDate ? e.date : ""}
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
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setEditing(e)}>
                      <Pencil size={13} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" />}>
                        <Trash2 size={13} />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {e.exercise}?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteStrengthEntry(e.date, e.exercise)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit — {editing?.exercise} ({editing?.date})</DialogTitle>
          </DialogHeader>
          {editing && <StrengthForm editing={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
