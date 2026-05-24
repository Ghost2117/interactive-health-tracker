import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const csv = readFileSync(join(process.cwd(), "data", "cardio.csv"), "utf-8");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="cardio.csv"',
    },
  });
}
