"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Map, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [errors, setErrors] = useState<Partial<Record<keyof CardioEntry, string>>>({});

  function set(field: keyof CardioEntry, value: string) {
    setErrors((e) => ({ ...e, [field]: undefined }));
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
    toast.success("Route saved — distance and duration updated");
  }

  function clearRoute() {
    setPendingRoute(null);
    setForm((f) => ({ ...f, distance_km: 0 }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof CardioEntry, string>> = {};
    if (!form.date) errs.date = "Date is required";
    if (form.date > today()) errs.date = "Date cannot be in the future";
    if (!form.activity_type.trim()) errs.activity_type = "Activity type is required";
    if (!form.duration_min || form.duration_min < 1) errs.duration_min = "Must be at least 1 minute";
    if (form.distance_km < 0) errs.distance_km = "Must be 0 or greater";
    if (form.avg_heart_rate < 0) errs.avg_heart_rate = "Must be 0 or greater";
    if (form.avg_heart_rate > 250) errs.avg_heart_rate = "Check your value — seems too high";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const result = editing
      ? await updateCardioEntry(editing, form, pendingRoute ?? undefined)
      : await addCardioEntry(form, pendingRoute ?? undefined);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save session");
      return;
    }
    toast.success(editing ? "Session updated" : "Session logged");
    if (editing) {
      onClose?.();
    } else {
      setForm(blank());
      setPendingRoute(null);
    }
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
              <Input
                id="c-date" type="date" value={form.date}
                onChange={(e) => set("date", e.target.value)}
                max={today()} required
                aria-invalid={!!errors.date}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-activity">Activity</Label>
              <Input
                id="c-activity" value={form.activity_type}
                onChange={(e) => set("activity_type", e.target.value)}
                placeholder="Run / Cycle / Swim" required
                aria-invalid={!!errors.activity_type}
              />
              {errors.activity_type && <p className="text-xs text-destructive">{errors.activity_type}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-duration">Duration (min)</Label>
              <Input
                id="c-duration" type="number" min="1"
                value={form.duration_min || ""}
                onChange={(e) => set("duration_min", e.target.value)}
                placeholder="30" required
                aria-invalid={!!errors.duration_min}
              />
              {errors.duration_min && <p className="text-xs text-destructive">{errors.duration_min}</p>}
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
                  disabled={!!pendingRoute}
                  aria-invalid={!!errors.distance_km}
                />
                {pendingRoute ? (
                  <Button
                    type="button" variant="outline" size="icon"
                    title="Clear drawn route"
                    aria-label="Clear drawn route"
                    onClick={clearRoute}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <X size={14} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline" size="icon"
                    title="Draw route on map"
                    aria-label="Open map to draw route"
                    onClick={() => setMapOpen(true)}
                    className="shrink-0"
                  >
                    <Map size={14} />
                  </Button>
                )}
              </div>
              {pendingRoute && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Route drawn — distance auto-filled. Click × to remove.
                </p>
              )}
              {errors.distance_km && <p className="text-xs text-destructive">{errors.distance_km}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-hr">Avg Heart Rate</Label>
              <Input
                id="c-hr" type="number" min="0" max="250"
                value={form.avg_heart_rate || ""}
                onChange={(e) => set("avg_heart_rate", e.target.value)}
                placeholder="150"
                aria-invalid={!!errors.avg_heart_rate}
              />
              {errors.avg_heart_rate && <p className="text-xs text-destructive">{errors.avg_heart_rate}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-notes">Notes</Label>
              <Input id="c-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
              {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Saving…" : isEditing ? "Save Changes" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={mapOpen} onOpenChange={(open) => { setMapOpen(open); if (!open) setExpanded(false); }}>
        <DialogContent className={cn("flex flex-col p-4 gap-0 transition-all duration-200", expanded ? "!max-w-none !w-screen !h-screen !top-0 !left-0 !translate-x-0 !translate-y-0 !rounded-none" : "max-w-5xl w-[92vw] h-[88vh]")}>
          <DialogHeader className="flex flex-row items-center justify-between pb-3 shrink-0">
            <DialogTitle>Draw Your Route</DialogTitle>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 mr-7"
              title={expanded ? "Collapse map" : "Expand to fullscreen"}
              aria-label={expanded ? "Collapse map" : "Expand map to fullscreen"}
              onClick={() => setExpanded((e) => !e)}
            >
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
