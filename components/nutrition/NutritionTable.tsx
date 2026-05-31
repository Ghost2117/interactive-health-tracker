"use client";

import { Fragment, useState, useMemo } from "react";
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
import { deleteNutritionEntry } from "@/lib/actions";
import { NutritionForm } from "./NutritionForm";
import type { NutritionEntry } from "@/lib/types";

const PAGE_SIZE = 25;

const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  lunch: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  dinner: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  snack: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

type DeleteKey = `${string}|${string}|${string}`;
function entryKey(e: NutritionEntry): DeleteKey {
  return `${e.date}|${e.meal_type}|${e.food}`;
}

export function NutritionTable({ entries }: { entries: NutritionEntry[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) =>
      b.date.localeCompare(a.date) || a.meal_type.localeCompare(b.meal_type)
    ),
    [entries]
  );

  const [editing, setEditing] = useState<NutritionEntry | null>(null);
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

  async function handleDelete(e: NutritionEntry) {
    const key = entryKey(e);
    setDeletedKeys((prev) => new Set([...prev, key]));
    const result = await deleteNutritionEntry(e.date, e.meal_type, e.food);
    if (!result.success) {
      setDeletedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      toast.error(result.error ?? "Failed to delete meal");
    } else {
      toast.success(`"${e.food}" deleted`);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No meals logged yet</p>
        <p className="text-xs text-muted-foreground">Use the form above to log your first meal.</p>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div className="space-y-3">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="nt-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="nt-from" type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-7 text-xs w-36"
            aria-label="Filter from date"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="nt-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="nt-to" type="date" value={dateTo}
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
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "meal" : "meals"}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No meals match the selected date range.</p>
      ) : (
        <>
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
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((e, i) => {
                const showDate = e.date !== lastDate;
                lastDate = e.date;
                const dayEntries = filtered.filter((x) => x.date === e.date);
                const isLastInDay = i === paginated.length - 1 || paginated[i + 1].date !== e.date;
                const dayTotals = {
                  calories: dayEntries.reduce((s, x) => s + x.calories, 0),
                  protein_g: dayEntries.reduce((s, x) => s + x.protein_g, 0),
                  carbs_g: dayEntries.reduce((s, x) => s + x.carbs_g, 0),
                  fat_g: dayEntries.reduce((s, x) => s + x.fat_g, 0),
                };

                return (
                  <Fragment key={`${e.date}-${e.meal_type}-${e.food}-${i}`}>
                    <TableRow className="group">
                      <TableCell className="font-medium">{showDate ? e.date : ""}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEAL_COLORS[e.meal_type] ?? ""}`}>
                          {e.meal_type}
                        </span>
                      </TableCell>
                      <TableCell>{e.food}</TableCell>
                      <TableCell>{e.calories || "—"}</TableCell>
                      <TableCell>{e.protein_g || "—"}</TableCell>
                      <TableCell>{e.carbs_g || "—"}</TableCell>
                      <TableCell>{e.fat_g || "—"}</TableCell>
                      <TableCell>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => setEditing(e)}
                            aria-label={`Edit ${e.food}`}
                          >
                            <Pencil size={13} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger render={
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Delete ${e.food}`}
                              />
                            }>
                              <Trash2 size={13} />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{e.food}"?</AlertDialogTitle>
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
                    {isLastInDay && (
                      <TableRow className="bg-muted/40 font-medium text-sm">
                        <TableCell />
                        <TableCell colSpan={2} className="text-muted-foreground text-xs">Daily total</TableCell>
                        <TableCell>{dayTotals.calories}</TableCell>
                        <TableCell>{dayTotals.protein_g}</TableCell>
                        <TableCell>{dayTotals.carbs_g}</TableCell>
                        <TableCell>{dayTotals.fat_g}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </Fragment>
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
            <DialogTitle>Edit — {editing?.food} ({editing?.date})</DialogTitle>
          </DialogHeader>
          {editing && <NutritionForm editing={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
