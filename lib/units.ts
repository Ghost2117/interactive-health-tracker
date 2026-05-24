export type Unit = "km" | "mi";

const KM_TO_MI = 0.621371;

export function toDisplay(km: number, unit: Unit): number {
  const val = unit === "mi" ? km * KM_TO_MI : km;
  return Math.round(val * 100) / 100;
}

export function toKm(display: number, unit: Unit): number {
  const val = unit === "mi" ? display / KM_TO_MI : display;
  return Math.round(val * 100) / 100;
}

export function unitLabel(unit: Unit): string {
  return unit === "mi" ? "mi" : "km";
}
