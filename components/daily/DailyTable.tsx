"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { deleteDailyEntry } from "@/lib/actions";
import { DailyForm } from "./DailyForm";
import type { DailyEntry } from "@/lib/types";

export function DailyTable({ entries }: { entries: DailyEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const [editing, setEditing] = useState<DailyEntry | null>(null);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No entries yet. Add your first one above.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Weight (kg)</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Sleep (hrs)</TableHead>
            <TableHead>Water (ml)</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-16" />
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
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditing(e)}>
                    <Pencil size={13} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" />}>
                      <Trash2 size={13} />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete entry for {e.date}?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDailyEntry(e.date)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Entry — {editing?.date}</DialogTitle>
          </DialogHeader>
          {editing && (
            <DailyForm editing={editing} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
