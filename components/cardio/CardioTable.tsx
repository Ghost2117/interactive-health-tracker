"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Trash2 } from "lucide-react";
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
import { deleteCardioEntry } from "@/lib/actions";
import { CardioForm } from "./CardioForm";
import { toDisplay, unitLabel, type Unit } from "@/lib/units";
import type { CardioEntry } from "@/lib/types";

const RouteViewer = dynamic(
  () => import("./RouteViewer").then((m) => m.RouteViewer),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground text-center py-8">Loading map…</p> }
);

const PAGE_SIZE = 25;

type DeleteKey = `${string}|${string}`;
function entryKey(e: CardioEntry): DeleteKey {
  return `${e.date}|${e.activity_type}`;
}

export function CardioTable({ entries, unit }: { entries: CardioEntry[]; unit: Unit }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const uLabel = unitLabel(unit);
  const [editing, setEditing] = useState<CardioEntry | null>(null);
  const [viewingRouteId, setViewingRouteId] = useState<string | null>(null);
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

  async function handleDelete(e: CardioEntry) {
    const key = entryKey(e);
    setDeletedKeys((prev) => new Set([...prev, key]));
    const result = await deleteCardioEntry(e.date, e.activity_type);
    if (!result.success) {
      setDeletedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      toast.error(result.error ?? "Failed to delete session");
    } else {
      toast.success("Session deleted");
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No sessions logged yet</p>
        <p className="text-xs text-muted-foreground">Use the form above to log your first cardio session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="ct-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input
            id="ct-from" type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-7 text-xs w-36"
            aria-label="Filter from date"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="ct-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input
            id="ct-to" type="date" value={dateTo}
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
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "session" : "sessions"}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No sessions match the selected date range.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Distance ({uLabel})</TableHead>
                <TableHead>Avg HR</TableHead>
                <TableHead>Pace (/{uLabel})</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((e, i) => {
                const displayDist = e.distance_km > 0 ? toDisplay(e.distance_km, unit) : 0;
                const pace = displayDist > 0
                  ? `${Math.floor(e.duration_min / displayDist)}:${String(Math.round(((e.duration_min / displayDist) % 1) * 60)).padStart(2, "0")}`
                  : "—";
                return (
                  <TableRow key={`${e.date}-${e.activity_type}-${i}`} className="group">
                    <TableCell className="font-medium">{e.date}</TableCell>
                    <TableCell><Badge variant="secondary">{e.activity_type}</Badge></TableCell>
                    <TableCell>{e.duration_min}</TableCell>
                    <TableCell>{displayDist > 0 ? displayDist : "—"}</TableCell>
                    <TableCell>{e.avg_heart_rate > 0 ? e.avg_heart_rate : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{pace}</TableCell>
                    <TableCell className="text-muted-foreground">{e.notes}</TableCell>
                    <TableCell>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {e.route_id && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="View route"
                            aria-label={`View route for ${e.activity_type} on ${e.date}`}
                            onClick={() => setViewingRouteId(e.route_id!)}
                          >
                            <MapPin size={13} />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => setEditing(e)}
                          aria-label={`Edit ${e.activity_type} on ${e.date}`}
                        >
                          <Pencil size={13} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger render={
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${e.activity_type} on ${e.date}`}
                            />
                          }>
                            <Trash2 size={13} />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {e.activity_type} on {e.date}?</AlertDialogTitle>
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
            <DialogTitle>Edit — {editing?.activity_type} ({editing?.date})</DialogTitle>
          </DialogHeader>
          {editing && <CardioForm unit={unit} editing={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingRouteId} onOpenChange={(o) => !o && setViewingRouteId(null)}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-4 gap-0">
          <DialogHeader className="pb-3 shrink-0">
            <DialogTitle>Saved Route</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewingRouteId && <RouteViewer routeId={viewingRouteId} unit={unit} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
