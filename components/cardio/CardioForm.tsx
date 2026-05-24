"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Maximize2, Minimize2, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDisplay, toKm, unitLabel, type Unit } from "@/lib/units";
import { addCardioEntry, updateCardioEntry } from "@/lib/actions";
import type { CardioEntry } from "@/lib/types";
import type { RouteFeature } from "@/lib/routes";

const RouteMapPicker = dynamic(
  () => import("./RouteMapPicker").then((m) => m.RouteMapPicker),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground text-center py-8">Loading map…</p> }
);

function today() { return new Date().toISOString().slice(0, 10); }

const blank = (): CardioEntry => ({
  date: today(), activity_type: "", duration_min: 0, distance_km: 0, avg_heart_rate: 0, notes: "",
});

type Props = { unit: Unit; editing?: CardioEntry; onClose?: () => void };

export function CardioForm({ unit, editing, onClose }: Props) {
  const [form, setForm] = useState<CardioEntry>(editing ?? blank());
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<RouteFeature | null>(null);

  function set(field: keyof CardioEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["duration_min", "distance_km", "avg_heart_rate"].includes(field) ? Number(value) : value,
    }));
  }

  function handleRouteConfirm({ distance_km, duration_min, routeFeature }: {
    distance_km: number; duration_min: number; routeFeature: RouteFeature;
  }) {
    setForm((f) => ({ ...f, distance_km, duration_min }));
    setPendingRoute(routeFeature);
    setMapOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await updateCardioEntry(editing, form, pendingRoute ?? undefined);
      onClose?.();
    } else {
      await addCardioEntry(form, pendingRoute ?? undefined);
      setForm(blank());
      setPendingRoute(null);
    }
    setSaving(false);
  }

  const isEditing = !!editing;

  return (
    <>
      <Card className={isEditing ? "border-0 shadow-none p-0" : ""}>
        {!isEditing && <CardHeader><CardTitle className="text-base">Log Session</CardTitle></CardHeader>}
        <CardContent className={isEditing ? "px-0" : ""}>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="c-date">Date</Label>
              <Input id="c-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-activity">Activity</Label>
              <Input id="c-activity" value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)} placeholder="Run / Cycle / Swim" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-duration">Duration (min)</Label>
              <Input id="c-duration" type="number" min="1" value={form.duration_min || ""} onChange={(e) => set("duration_min", e.target.value)} placeholder="30" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-distance">Distance ({unitLabel(unit)})</Label>
              <div className="flex gap-2">
                <Input
                  id="c-distance"
                  type="number" step="0.1" min="0"
                  value={form.distance_km ? toDisplay(form.distance_km, unit) : ""}
                  onChange={(e) => {
                    const km = e.target.value ? toKm(Number(e.target.value), unit) : 0;
                    setForm((f) => ({ ...f, distance_km: km }));
                    setPendingRoute(null);
                  }}
                  placeholder={unit === "mi" ? "3.1" : "5.0"}
                />
                <Button type="button" variant={pendingRoute ? "default" : "outline"} size="icon" title="Draw route on map" onClick={() => setMapOpen(true)}>
                  <Map size={14} />
                </Button>
              </div>
              {pendingRoute && <p className="text-xs text-muted-foreground">Route drawn ✓</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-hr">Avg Heart Rate</Label>
              <Input id="c-hr" type="number" min="0" value={form.avg_heart_rate || ""} onChange={(e) => set("avg_heart_rate", e.target.value)} placeholder="150" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-notes">Notes</Label>
              <Input id="c-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
              {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEditing ? "Save Changes" : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={mapOpen} onOpenChange={(open) => { setMapOpen(open); if (!open) setExpanded(false); }}>
        <DialogContent className={cn("flex flex-col p-4 gap-0 transition-all duration-200", expanded ? "!max-w-none !w-screen !h-screen !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none" : "max-w-5xl w-[92vw] h-[88vh]")}>
          <DialogHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
            <DialogTitle>Draw Your Route</DialogTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 mr-7" title={expanded ? "Collapse" : "Expand to fullscreen"} onClick={() => setExpanded((e) => !e)}>
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <RouteMapPicker expanded={expanded} unit={unit} onConfirm={handleRouteConfirm} onCancel={() => setMapOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
