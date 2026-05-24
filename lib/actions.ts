"use server";

import { revalidatePath } from "next/cache";
import { deleteEntry, readEntries, writeEntry, type HealthEntry } from "./csv";

export async function getEntries(): Promise<HealthEntry[]> {
  return readEntries();
}

export async function upsertEntry(entry: HealthEntry): Promise<void> {
  writeEntry(entry);
  revalidatePath("/");
}

export async function removeEntry(date: string): Promise<void> {
  deleteEntry(date);
  revalidatePath("/");
}
