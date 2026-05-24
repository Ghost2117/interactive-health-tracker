"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addNutritionEntry } from "@/lib/actions";
import type { NutritionEntry } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const MEAL_TYPES: NutritionEntry["meal_type"][] = ["breakfast", "lunch", "dinner", "snack"];

const empty = (): NutritionEntry => ({
  date: today(),
  meal_type: "breakfast",
  food: "",
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  notes: "",
});

export function NutritionForm() {
  const [form, setForm] = useState<NutritionEntry>(empty());
  const [saving, setSaving] = useState(false);

  function set(field: keyof NutritionEntry, value: string) {
    setForm((f) => ({
      ...f,
      [field]: ["calories", "protein_g", "carbs_g", "fat_g"].includes(field)
        ? Number(value)
        : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await addNutritionEntry(form);
    setSaving(false);
    setForm(empty());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Meal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="meal_type">Meal</Label>
            <select
              id="meal_type"
              value={form.meal_type}
              onChange={(e) => set("meal_type", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label htmlFor="food">Food</Label>
            <Input id="food" value={form.food} onChange={(e) => set("food", e.target.value)} placeholder="Chicken rice bowl" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="calories">Calories</Label>
            <Input id="calories" type="number" min="0" value={form.calories || ""} onChange={(e) => set("calories", e.target.value)} placeholder="500" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="protein">Protein (g)</Label>
            <Input id="protein" type="number" min="0" value={form.protein_g || ""} onChange={(e) => set("protein_g", e.target.value)} placeholder="40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="carbs">Carbs (g)</Label>
            <Input id="carbs" type="number" min="0" value={form.carbs_g || ""} onChange={(e) => set("carbs_g", e.target.value)} placeholder="60" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fat">Fat (g)</Label>
            <Input id="fat" type="number" min="0" value={form.fat_g || ""} onChange={(e) => set("fat_g", e.target.value)} placeholder="15" />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-4">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Meal"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
