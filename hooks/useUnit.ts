"use client";

import { useEffect, useState } from "react";
import type { Unit } from "@/lib/units";

const STORAGE_KEY = "health-tracker-distance-unit";
const DEFAULT: Unit = "mi";

export function useUnit(): [Unit, (u: Unit) => void] {
  const [unit, setUnitState] = useState<Unit>(DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Unit | null;
    if (stored === "km" || stored === "mi") setUnitState(stored);
  }, []);

  function setUnit(u: Unit) {
    setUnitState(u);
    localStorage.setItem(STORAGE_KEY, u);
  }

  return [unit, setUnit];
}
