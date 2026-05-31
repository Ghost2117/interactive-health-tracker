"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { upsertDailyEntry } from "@/lib/actions";
import type { DailyEntry } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const blank = (): DailyEntry => ({
  date: today(), weight_kg: 0, steps: 0, sleep_hours: 0, water_ml: 0, notes: "",
});

type Props = { editing?: DailyEntry; onClose?: () => void };

export function DailyForm({ editing, onClose }: Props) {
  const [form, setForm] = useState<DailyEntry>(editing ?? blank());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DailyEntry, string>>>({});

  function set(field: keyof DailyEntry, value: string) {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setForm((f) => ({
      ...f,
      [field]: ["weight_kg", "steps", "sleep_hours", "water_ml"].includes(field)
        ? Number(value) : value,
    }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof DailyEntry, string>> = {};
    if (!form.date) errs.date = "Date is required";
    if (form.date > today()) errs.date = "Date cannot be in the future";
    if (form.weight_kg < 0) errs.weight_kg = "Must be 0 or greater";
    if (form.steps < 0) errs.steps = "Must be 0 or greater";
    if (form.steps > 100000) errs.steps = "That seems too high — check your value";
    if (form.sleep_hours < 0) errs.sleep_hours = "Must be 0 or greater";
    if (form.sleep_hours > 24) errs.sleep_hours = "Cannot exceed 24 hours";
    if (form.water_ml < 0) errs.water_ml = "Must be 0 or greater";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const result = await upsertDailyEntry(form);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save entry");
      return;
    }
    toast.success(editing ? "Entry updated" : "Daily metrics saved");
    if (onClose) {
      onClose();
    } else {
      setForm(blank());
    }
  }

  return (
    <Card className={editing ? "border-0 shadow-none p-0" : ""}>
      {!editing && (
        <CardHeader>
          <CardTitle className="text-base">Log Daily Metrics</CardTitle>
        </CardHeader>
      )}
      <CardContent className={editing ? "px-0" : ""}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="d-date">Date</Label>
            <Input
              id="d-date" type="date" value={form.date}
              onChange={(e) => set("date", e.target.value)}
              max={today()} required
              aria-invalid={!!errors.date}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-weight">Weight (kg)</Label>
            <Input
              id="d-weight" type="number" step="0.1" min="0" max="999"
              value={form.weight_kg || ""}
              onChange={(e) => set("weight_kg", e.target.value)}
              placeholder="75.0"
              aria-invalid={!!errors.weight_kg}
            />
            {errors.weight_kg && <p className="text-xs text-destructive">{errors.weight_kg}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-steps">Steps</Label>
            <Input
              id="d-steps" type="number" min="0" max="100000"
              value={form.steps || ""}
              onChange={(e) => set("steps", e.target.value)}
              placeholder="10000"
              aria-invalid={!!errors.steps}
            />
            {errors.steps && <p className="text-xs text-destructive">{errors.steps}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-sleep">Sleep (hrs)</Label>
            <Input
              id="d-sleep" type="number" step="0.5" min="0" max="24"
              value={form.sleep_hours || ""}
              onChange={(e) => set("sleep_hours", e.target.value)}
              placeholder="8"
              aria-invalid={!!errors.sleep_hours}
            />
            {errors.sleep_hours && <p className="text-xs text-destructive">{errors.sleep_hours}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-water">Water (ml)</Label>
            <Input
              id="d-water" type="number" step="100" min="0" max="20000"
              value={form.water_ml || ""}
              onChange={(e) => set("water_ml", e.target.value)}
              placeholder="2000"
              aria-invalid={!!errors.water_ml}
            />
            {errors.water_ml && <p className="text-xs text-destructive">{errors.water_ml}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-notes">Notes</Label>
            <Input id="d-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
            {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : editing ? "Save Changes" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
