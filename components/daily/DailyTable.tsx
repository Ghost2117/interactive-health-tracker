"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PAGE_SIZE = 25;

export function DailyTable({ entries }: { entries: DailyEntry[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [deletedDates, setDeletedDates] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return sorted
      .filter((e) => !deletedDates.has(e.date))
      .filter((e) => (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo));
  }, [sorted, deletedDates, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleDelete(date: string) {
    setDeletedDates((prev) => new Set([...prev, date]));
    const result = await deleteDailyEntry(date);
    if (!result.success) {
      setDeletedDates((prev) => { const s = new Set(prev); s.delete(date); return s; });
      toast.error(result.error ?? "Failed to delete entry");
    } else {
      toast.success("Entry deleted");
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No entries yet</p>
        <p className="text-xs text-muted-foreground">Use the form above to log your first daily metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="df-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="df-from" type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-7 text-xs w-36"
            aria-label="Filter from date"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="df-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="df-to" type="date" value={dateTo}
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
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No entries match the selected date range.</p>
      ) : (
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
              {paginated.map((e) => (
                <TableRow key={e.date} className="group">
                  <TableCell className="font-medium">{e.date}</TableCell>
                  <TableCell>{e.weight_kg || "—"}</TableCell>
                  <TableCell>{e.steps ? e.steps.toLocaleString() : "—"}</TableCell>
                  <TableCell>{e.sleep_hours || "—"}</TableCell>
                  <TableCell>{e.water_ml || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.notes}</TableCell>
                  <TableCell>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => setEditing(e)}
                        aria-label={`Edit entry for ${e.date}`}
                      >
                        <Pencil size={13} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            aria-label={`Delete entry for ${e.date}`}
                          />
                        }>
                          <Trash2 size={13} />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete entry for {e.date}?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(e.date)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
            <DialogTitle>Edit Entry — {editing?.date}</DialogTitle>
          </DialogHeader>
          {editing && (
            <DailyForm editing={editing} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
