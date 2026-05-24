"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addStrengthEntry } from "@/lib/actions";
import type { StrengthEntry } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const empty = (): StrengthEntry => ({
  date: today(),
  exercise: "",
  muscle_group: "",
  sets: 3,
  reps: 8,
  weight_kg: 0,
  notes: "",
});

export function StrengthForm() {
  const [form, setForm] = useState<StrengthEntry>(empty());
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
    await addStrengthEntry(form);
    setSaving(false);
    setForm(empty());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Exercise</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exercise">Exercise</Label>
            <Input id="exercise" value={form.exercise} onChange={(e) => set("exercise", e.target.value)} placeholder="Bench Press" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="muscle_group">Muscle Group</Label>
            <Input id="muscle_group" value={form.muscle_group} onChange={(e) => set("muscle_group", e.target.value)} placeholder="Chest" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sets">Sets</Label>
            <Input id="sets" type="number" min="1" value={form.sets} onChange={(e) => set("sets", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reps">Reps</Label>
            <Input id="reps" type="number" min="1" value={form.reps} onChange={(e) => set("reps", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" step="0.5" min="0" value={form.weight_kg || ""} onChange={(e) => set("weight_kg", e.target.value)} placeholder="80" />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Set"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
