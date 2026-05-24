import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type HealthEntry = {
  date: string;
  weight_kg: number;
  steps: number;
  sleep_hours: number;
  water_ml: number;
  notes: string;
};

const CSV_PATH = path.join(process.cwd(), "data", "health.csv");

export function readEntries(): HealthEntry[] {
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const { data } = Papa.parse<HealthEntry>(raw, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return data.sort((a, b) => a.date.localeCompare(b.date));
}

export function writeEntry(entry: HealthEntry): void {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  const csv = Papa.unparse(entries);
  fs.writeFileSync(CSV_PATH, csv + "\n", "utf-8");
}

export function deleteEntry(date: string): void {
  const entries = readEntries().filter((e) => e.date !== date);
  const csv = Papa.unparse(entries);
  fs.writeFileSync(CSV_PATH, csv + "\n", "utf-8");
}
