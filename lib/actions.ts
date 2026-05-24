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

// ── Daily ──────────────────────────────────────────────────────────────────

export async function getDailyEntries(): Promise<DailyEntry[]> {
  return readCsv<DailyEntry>("daily.csv").sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export async function upsertDailyEntry(entry: DailyEntry): Promise<void> {
  const rows = readCsv<DailyEntry>("daily.csv").filter(
    (r) => r.date !== entry.date
  );
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("daily.csv", rows);
  revalidatePath("/");
  revalidatePath("/daily");
}

export async function deleteDailyEntry(date: string): Promise<void> {
  const rows = readCsv<DailyEntry>("daily.csv").filter((r) => r.date !== date);
  writeCsv("daily.csv", rows);
  revalidatePath("/");
  revalidatePath("/daily");
}

// ── Strength ───────────────────────────────────────────────────────────────

export async function getStrengthEntries(): Promise<StrengthEntry[]> {
  return readCsv<StrengthEntry>("strength.csv").sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export async function addStrengthEntry(entry: StrengthEntry): Promise<void> {
  const rows = readCsv<StrengthEntry>("strength.csv");
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("strength.csv", rows);
  revalidatePath("/");
  revalidatePath("/strength");
}

export async function deleteStrengthEntry(
  date: string,
  exercise: string
): Promise<void> {
  const rows = readCsv<StrengthEntry>("strength.csv").filter(
    (r) => !(r.date === date && r.exercise === exercise)
  );
  writeCsv("strength.csv", rows);
  revalidatePath("/");
  revalidatePath("/strength");
}

// ── Cardio ─────────────────────────────────────────────────────────────────

export async function getCardioEntries(): Promise<CardioEntry[]> {
  return readCsv<CardioEntry>("cardio.csv").sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export async function addCardioEntry(
  entry: CardioEntry,
  routeFeature?: RouteFeature
): Promise<void> {
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
}

export async function getRoute(routeId: string): Promise<RouteFeature | null> {
  return readRoute(routeId);
}

export async function deleteCardioEntry(
  date: string,
  activity_type: string
): Promise<void> {
  const rows = readCsv<CardioEntry>("cardio.csv").filter(
    (r) => !(r.date === date && r.activity_type === activity_type)
  );
  writeCsv("cardio.csv", rows);
  revalidatePath("/");
  revalidatePath("/cardio");
}

// ── Nutrition ──────────────────────────────────────────────────────────────

export async function getNutritionEntries(): Promise<NutritionEntry[]> {
  return readCsv<NutritionEntry>("nutrition.csv").sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export async function addNutritionEntry(entry: NutritionEntry): Promise<void> {
  const rows = readCsv<NutritionEntry>("nutrition.csv");
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("nutrition.csv", rows);
  revalidatePath("/");
  revalidatePath("/nutrition");
}

export async function deleteNutritionEntry(
  date: string,
  meal_type: string,
  food: string
): Promise<void> {
  const rows = readCsv<NutritionEntry>("nutrition.csv").filter(
    (r) => !(r.date === date && r.meal_type === meal_type && r.food === food)
  );
  writeCsv("nutrition.csv", rows);
  revalidatePath("/");
  revalidatePath("/nutrition");
}
