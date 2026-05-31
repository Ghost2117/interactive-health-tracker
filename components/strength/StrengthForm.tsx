"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addStrengthEntry, updateStrengthEntry } from "@/lib/actions";
import type { StrengthEntry } from "@/lib/types";
import { ExerciseInput } from "./ExerciseInput";

function today() { return new Date().toISOString().slice(0, 10); }

const blank = (): StrengthEntry => ({
  date: today(), exercise: "", muscle_group: "", sets: 3, reps: 8, weight_kg: 0, notes: "",
});

type Props = { editing?: StrengthEntry; onClose?: () => void };

export function StrengthForm({ editing, onClose }: Props) {
  const [form, setForm] = useState<StrengthEntry>(editing ?? blank());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StrengthEntry, string>>>({});

  function set(field: keyof StrengthEntry, value: string) {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setForm((f) => ({
      ...f,
      [field]: ["sets", "reps", "weight_kg"].includes(field) ? Number(value) : value,
    }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof StrengthEntry, string>> = {};
    if (!form.date) errs.date = "Date is required";
    if (form.date > today()) errs.date = "Date cannot be in the future";
    if (!form.exercise.trim()) errs.exercise = "Exercise name is required";
    if (form.sets < 1) errs.sets = "Must be at least 1";
    if (form.reps < 1) errs.reps = "Must be at least 1";
    if (form.weight_kg < 0) errs.weight_kg = "Must be 0 or greater";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const result = editing
      ? await updateStrengthEntry(editing, form)
      : await addStrengthEntry(form);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save exercise");
      return;
    }
    toast.success(editing ? "Exercise updated" : "Exercise logged");
    if (editing) {
      onClose?.();
    } else {
      setForm(blank());
    }
  }

  return (
    <Card className={editing ? "border-0 shadow-none p-0" : ""}>
      {!editing && <CardHeader><CardTitle className="text-base">Log Exercise</CardTitle></CardHeader>}
      <CardContent className={editing ? "px-0" : ""}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="s-date">Date</Label>
            <Input
              id="s-date" type="date" value={form.date}
              onChange={(e) => set("date", e.target.value)}
              max={today()} required
              aria-invalid={!!errors.date}
            />
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-exercise">Exercise</Label>
            <ExerciseInput
              id="s-exercise" value={form.exercise}
              onChange={(v) => { setErrors((e) => ({ ...e, exercise: undefined })); set("exercise", v); }}
              placeholder="Bench Press" required
              aria-invalid={!!errors.exercise}
            />
            {errors.exercise && <p className="text-xs text-destructive">{errors.exercise}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-muscle">Muscle Group</Label>
            <Input id="s-muscle" value={form.muscle_group} onChange={(e) => set("muscle_group", e.target.value)} placeholder="Chest" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-sets">Sets</Label>
            <Input
              id="s-sets" type="number" min="1" value={form.sets}
              onChange={(e) => set("sets", e.target.value)} required
              aria-invalid={!!errors.sets}
            />
            {errors.sets && <p className="text-xs text-destructive">{errors.sets}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-reps">Reps</Label>
            <Input
              id="s-reps" type="number" min="1" value={form.reps}
              onChange={(e) => set("reps", e.target.value)} required
              aria-invalid={!!errors.reps}
            />
            {errors.reps && <p className="text-xs text-destructive">{errors.reps}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="s-weight">Weight (kg)</Label>
            <Input
              id="s-weight" type="number" step="0.5" min="0"
              value={form.weight_kg || ""}
              onChange={(e) => set("weight_kg", e.target.value)}
              placeholder="80"
              aria-invalid={!!errors.weight_kg}
            />
            {errors.weight_kg && <p className="text-xs text-destructive">{errors.weight_kg}</p>}
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label htmlFor="s-notes">Notes</Label>
            <Input id="s-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex justify-end gap-2">
            {onClose && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Set"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
