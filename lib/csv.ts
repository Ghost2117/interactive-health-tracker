import fs from "fs";
import path from "path";
import Papa from "papaparse";

export function readCsv<T>(filename: string): T[] {
  const filepath = path.join(process.cwd(), "data", filename);
  if (!fs.existsSync(filepath)) return [];
  const raw = fs.readFileSync(filepath, "utf-8");
  const { data } = Papa.parse<T>(raw, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return data;
}

export function writeCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[]
): void {
  const filepath = path.join(process.cwd(), "data", filename);
  const csv = Papa.unparse(rows);
  fs.writeFileSync(filepath, csv + "\n", "utf-8");
}
