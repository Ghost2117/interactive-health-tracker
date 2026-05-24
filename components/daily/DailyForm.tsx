"use client";

import { useState } from "react";
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

  function set(field: keyof DailyEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["weight_kg", "steps", "sleep_hours", "water_ml"].includes(field)
        ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await upsertDailyEntry(form);
    setSaving(false);
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
            <Input id="d-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-weight">Weight (kg)</Label>
            <Input id="d-weight" type="number" step="0.1" value={form.weight_kg || ""} onChange={(e) => set("weight_kg", e.target.value)} placeholder="75.0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-steps">Steps</Label>
            <Input id="d-steps" type="number" value={form.steps || ""} onChange={(e) => set("steps", e.target.value)} placeholder="10000" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-sleep">Sleep (hrs)</Label>
            <Input id="d-sleep" type="number" step="0.5" value={form.sleep_hours || ""} onChange={(e) => set("sleep_hours", e.target.value)} placeholder="8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-water">Water (ml)</Label>
            <Input id="d-water" type="number" step="100" value={form.water_ml || ""} onChange={(e) => set("water_ml", e.target.value)} placeholder="2000" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-notes">Notes</Label>
            <Input id="d-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
            {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
