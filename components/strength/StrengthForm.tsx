"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addStrengthEntry, updateStrengthEntry } from "@/lib/actions";
import type { StrengthEntry } from "@/lib/types";

function today() { return new Date().toISOString().slice(0, 10); }

const blank = (): StrengthEntry => ({
  date: today(), exercise: "", muscle_group: "", sets: 3, reps: 8, weight_kg: 0, notes: "",
});

type Props = { editing?: StrengthEntry; onClose?: () => void };

export function StrengthForm({ editing, onClose }: Props) {
  const [form, setForm] = useState<StrengthEntry>(editing ?? blank());
  const [saving, setSaving] = useState(false);

  function set(field: keyof StrengthEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["sets", "reps", "weight_kg"].includes(field) ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await updateStrengthEntry(editing, form);
      onClose?.();
    } else {
      await addStrengthEntry(form);
      setForm(blank());
    }
    setSaving(false);
  }

  return (
    <Card className={editing ? "border-0 shadow-none p-0" : ""}>
      {!editing && <CardHeader><CardTitle className="text-base">Log Exercise</CardTitle></CardHeader>}
      <CardContent className={editing ? "px-0" : ""}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="s-date">Date</Label>
            <Input id="s-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-exercise">Exercise</Label>
            <Input id="s-exercise" value={form.exercise} onChange={(e) => set("exercise", e.target.value)} placeholder="Bench Press" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-muscle">Muscle Group</Label>
            <Input id="s-muscle" value={form.muscle_group} onChange={(e) => set("muscle_group", e.target.value)} placeholder="Chest" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-sets">Sets</Label>
            <Input id="s-sets" type="number" min="1" value={form.sets} onChange={(e) => set("sets", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-reps">Reps</Label>
            <Input id="s-reps" type="number" min="1" value={form.reps} onChange={(e) => set("reps", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-weight">Weight (kg)</Label>
            <Input id="s-weight" type="number" step="0.5" min="0" value={form.weight_kg || ""} onChange={(e) => set("weight_kg", e.target.value)} placeholder="80" />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label htmlFor="s-notes">Notes</Label>
            <Input id="s-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
            {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Set"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
