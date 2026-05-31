"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAGE_SIZE = 25;

type DeleteKey = `${string}|${string}`;
function entryKey(e: StrengthEntry): DeleteKey {
  return `${e.date}|${e.exercise}`;
}

export function StrengthTable({ entries }: { entries: StrengthEntry[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const [editing, setEditing] = useState<StrengthEntry | null>(null);
  const [deletedKeys, setDeletedKeys] = useState<Set<DeleteKey>>(new Set());
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return sorted
      .filter((e) => !deletedKeys.has(entryKey(e)))
      .filter((e) => (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo));
  }, [sorted, deletedKeys, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleDelete(e: StrengthEntry) {
    const key = entryKey(e);
    setDeletedKeys((prev) => new Set([...prev, key]));
    const result = await deleteStrengthEntry(e.date, e.exercise);
    if (!result.success) {
      setDeletedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      toast.error(result.error ?? "Failed to delete exercise");
    } else {
      toast.success(`${e.exercise} deleted`);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No exercises logged yet</p>
        <p className="text-xs text-muted-foreground">Use the form above to log your first workout.</p>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div className="space-y-3">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="st-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="st-from" type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-7 text-xs w-36"
            aria-label="Filter from date"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="st-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="st-to" type="date" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-7 text-xs w-36"
            aria-label="Filter to date"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            className="h-7 text-xs"
          >
            Clear filter
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "set" : "sets"}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No exercises match the selected date range.</p>
      ) : (
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
              {paginated.map((e, i) => {
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
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => setEditing(e)}
                          aria-label={`Edit ${e.exercise} on ${e.date}`}
                        >
                          <Pencil size={13} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger render={
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${e.exercise} on ${e.date}`}
                            />
                          }>
                            <Trash2 size={13} />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {e.exercise}?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(e)}>Delete</AlertDialogAction>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {safePage} of {totalPages}</span>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="icon-sm"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline" size="icon-sm"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit — {editing?.exercise} ({editing?.date})</DialogTitle>
          </DialogHeader>
          {editing && <StrengthForm editing={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
