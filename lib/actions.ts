"use server";

import { revalidatePath } from "next/cache";
import { readCsv, writeCsv } from "./csv";
import { readRoute, writeRoute, type RouteFeature } from "./routes";
import type {
  CardioEntry,
  DailyEntry,
  NutritionEntry,
  StrengthEntry,
} from "./types";

export type ActionResult = { success: boolean; error?: string };

// ── Daily ──────────────────────────────────────────────────────────────────

export async function getDailyEntries(): Promise<DailyEntry[]> {
  try {
    return readCsv<DailyEntry>("daily.csv").sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch {
    return [];
  }
}

export async function upsertDailyEntry(entry: DailyEntry): Promise<ActionResult> {
  try {
    const rows = readCsv<DailyEntry>("daily.csv").filter(
      (r) => r.date !== entry.date
    );
    rows.push(entry);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("daily.csv", rows);
    revalidatePath("/");
    revalidatePath("/daily");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save entry" };
  }
}

export async function deleteDailyEntry(date: string): Promise<ActionResult> {
  try {
    const rows = readCsv<DailyEntry>("daily.csv").filter((r) => r.date !== date);
    writeCsv("daily.csv", rows);
    revalidatePath("/");
    revalidatePath("/daily");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete entry" };
  }
}

// ── Strength ───────────────────────────────────────────────────────────────

export async function getExerciseNames(): Promise<string[]> {
  try {
    const rows = readCsv<StrengthEntry>("strength.csv");
    const names = Array.from(new Set(rows.map((r) => r.exercise).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function getStrengthEntries(): Promise<StrengthEntry[]> {
  try {
    return readCsv<StrengthEntry>("strength.csv").sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch {
    return [];
  }
}

export async function addStrengthEntry(entry: StrengthEntry): Promise<ActionResult> {
  try {
    const rows = readCsv<StrengthEntry>("strength.csv");
    rows.push(entry);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("strength.csv", rows);
    revalidatePath("/");
    revalidatePath("/strength");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save exercise" };
  }
}

export async function deleteStrengthEntry(
  date: string,
  exercise: string
): Promise<ActionResult> {
  try {
    const rows = readCsv<StrengthEntry>("strength.csv").filter(
      (r) => !(r.date === date && r.exercise === exercise)
    );
    writeCsv("strength.csv", rows);
    revalidatePath("/");
    revalidatePath("/strength");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete exercise" };
  }
}

export async function updateStrengthEntry(
  original: StrengthEntry,
  updated: StrengthEntry
): Promise<ActionResult> {
  try {
    const rows = readCsv<StrengthEntry>("strength.csv").filter(
      (r) => !(r.date === original.date && r.exercise === original.exercise)
    );
    rows.push(updated);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("strength.csv", rows);
    revalidatePath("/");
    revalidatePath("/strength");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update exercise" };
  }
}

// ── Cardio ─────────────────────────────────────────────────────────────────

export async function getCardioEntries(): Promise<CardioEntry[]> {
  try {
    return readCsv<CardioEntry>("cardio.csv").sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch {
    return [];
  }
}

export async function addCardioEntry(
  entry: CardioEntry,
  routeFeature?: RouteFeature
): Promise<ActionResult> {
  try {
    let entryToSave = entry;
    if (routeFeature) {
      const route_id = new Date().toISOString();
      writeRoute(route_id, routeFeature);
      entryToSave = { ...entry, route_id };
    }
    const rows = readCsv<CardioEntry>("cardio.csv");
    rows.push(entryToSave);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("cardio.csv", rows);
    revalidatePath("/");
    revalidatePath("/cardio");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save session" };
  }
}

export async function getRoute(routeId: string): Promise<RouteFeature | null> {
  try {
    return readRoute(routeId);
  } catch {
    return null;
  }
}

export async function deleteCardioEntry(
  date: string,
  activity_type: string
): Promise<ActionResult> {
  try {
    const rows = readCsv<CardioEntry>("cardio.csv").filter(
      (r) => !(r.date === date && r.activity_type === activity_type)
    );
    writeCsv("cardio.csv", rows);
    revalidatePath("/");
    revalidatePath("/cardio");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete session" };
  }
}

export async function updateCardioEntry(
  original: CardioEntry,
  updated: CardioEntry,
  routeFeature?: RouteFeature
): Promise<ActionResult> {
  try {
    let entryToSave = updated;
    if (routeFeature) {
      const route_id = new Date().toISOString();
      writeRoute(route_id, routeFeature);
      entryToSave = { ...updated, route_id };
    }
    const rows = readCsv<CardioEntry>("cardio.csv").filter(
      (r) => !(r.date === original.date && r.activity_type === original.activity_type)
    );
    rows.push(entryToSave);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("cardio.csv", rows);
    revalidatePath("/");
    revalidatePath("/cardio");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update session" };
  }
}

// ── Nutrition ──────────────────────────────────────────────────────────────

export async function getNutritionEntries(): Promise<NutritionEntry[]> {
  try {
    return readCsv<NutritionEntry>("nutrition.csv").sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch {
    return [];
  }
}

export async function addNutritionEntry(entry: NutritionEntry): Promise<ActionResult> {
  try {
    const rows = readCsv<NutritionEntry>("nutrition.csv");
    rows.push(entry);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("nutrition.csv", rows);
    revalidatePath("/");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save meal" };
  }
}

export async function deleteNutritionEntry(
  date: string,
  meal_type: string,
  food: string
): Promise<ActionResult> {
  try {
    const rows = readCsv<NutritionEntry>("nutrition.csv").filter(
      (r) => !(r.date === date && r.meal_type === meal_type && r.food === food)
    );
    writeCsv("nutrition.csv", rows);
    revalidatePath("/");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete meal" };
  }
}

export async function updateNutritionEntry(
  original: NutritionEntry,
  updated: NutritionEntry
): Promise<ActionResult> {
  try {
    const rows = readCsv<NutritionEntry>("nutrition.csv").filter(
      (r) =>
        !(
          r.date === original.date &&
          r.meal_type === original.meal_type &&
          r.food === original.food
        )
    );
    rows.push(updated);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    writeCsv("nutrition.csv", rows);
    revalidatePath("/");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update meal" };
  }
}
