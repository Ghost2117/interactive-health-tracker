"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Pencil, Trash2 } from "lucide-react";
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
import { deleteCardioEntry } from "@/lib/actions";
import { CardioForm } from "./CardioForm";
import { toDisplay, unitLabel, type Unit } from "@/lib/units";
import type { CardioEntry } from "@/lib/types";

const RouteViewer = dynamic(
  () => import("./RouteViewer").then((m) => m.RouteViewer),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground text-center py-8">Loading map…</p> }
);

export function CardioTable({ entries, unit }: { entries: CardioEntry[]; unit: Unit }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const uLabel = unitLabel(unit);
  const [editing, setEditing] = useState<CardioEntry | null>(null);
  const [viewingRouteId, setViewingRouteId] = useState<string | null>(null);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No sessions logged yet.</p>;
  }

  return (
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
          {sorted.map((e, i) => {
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" title="View route" onClick={() => setViewingRouteId(e.route_id!)}>
                        <MapPin size={13} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setEditing(e)}>
                      <Pencil size={13} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" />}>
                        <Trash2 size={13} />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {e.activity_type} on {e.date}?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCardioEntry(e.date, e.activity_type)}>Delete</AlertDialogAction>
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

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit — {editing?.activity_type} ({editing?.date})</DialogTitle>
          </DialogHeader>
          {editing && <CardioForm unit={unit} editing={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Route viewer dialog */}
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
    </>
  );
}
