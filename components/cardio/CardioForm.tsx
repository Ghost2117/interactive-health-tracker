"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addCardioEntry } from "@/lib/actions";
import type { CardioEntry } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const empty = (): CardioEntry => ({
  date: today(),
  activity_type: "",
  duration_min: 0,
  distance_km: 0,
  avg_heart_rate: 0,
  notes: "",
});

export function CardioForm() {
  const [form, setForm] = useState<CardioEntry>(empty());
  const [saving, setSaving] = useState(false);

  function set(field: keyof CardioEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["duration_min", "distance_km", "avg_heart_rate"].includes(field)
        ? Number(value)
        : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addCardioEntry(form);
    setSaving(false);
    setForm(empty());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Session</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity">Activity</Label>
            <Input id="activity" value={form.activity_type} onChange={(e) => set("activity_type", e.target.value)} placeholder="Run / Cycle / Swim" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="duration">Duration (min)</Label>
            <Input id="duration" type="number" min="1" value={form.duration_min || ""} onChange={(e) => set("duration_min", e.target.value)} placeholder="30" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="distance">Distance (km)</Label>
            <Input id="distance" type="number" step="0.1" min="0" value={form.distance_km || ""} onChange={(e) => set("distance_km", e.target.value)} placeholder="5.0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr">Avg Heart Rate</Label>
            <Input id="hr" type="number" min="0" value={form.avg_heart_rate || ""} onChange={(e) => set("avg_heart_rate", e.target.value)} placeholder="150" />
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
