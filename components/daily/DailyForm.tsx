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

export function DailyForm({ existing }: { existing?: DailyEntry }) {
  const [form, setForm] = useState<DailyEntry>(
    existing ?? {
      date: today(),
      weight_kg: 0,
      steps: 0,
      sleep_hours: 0,
      water_ml: 0,
      notes: "",
    }
  );
  const [saving, setSaving] = useState(false);

  function set(field: keyof DailyEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["weight_kg", "steps", "sleep_hours", "water_ml"].includes(field)
        ? Number(value)
        : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await upsertDailyEntry(form);
    setSaving(false);
    if (!existing) {
      setForm({ date: today(), weight_kg: 0, steps: 0, sleep_hours: 0, water_ml: 0, notes: "" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Daily Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" step="0.1" value={form.weight_kg || ""} onChange={(e) => set("weight_kg", e.target.value)} placeholder="75.0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="steps">Steps</Label>
            <Input id="steps" type="number" value={form.steps || ""} onChange={(e) => set("steps", e.target.value)} placeholder="10000" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sleep">Sleep (hrs)</Label>
            <Input id="sleep" type="number" step="0.5" value={form.sleep_hours || ""} onChange={(e) => set("sleep_hours", e.target.value)} placeholder="8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="water">Water (ml)</Label>
            <Input id="water" type="number" step="100" value={form.water_ml || ""} onChange={(e) => set("water_ml", e.target.value)} placeholder="2000" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
