import Anthropic from "@anthropic-ai/sdk";
import { readCsv, writeCsv } from "./csv";
import { revalidatePath } from "next/cache";
import type { DailyEntry, StrengthEntry, CardioEntry, NutritionEntry } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const SYSTEM_PROMPT = `You are a personal health assistant integrated with a health tracker app. The user messages you through iMessage.

You can query their health data and log new entries. Today is ${new Date().toISOString().slice(0,10)}.

Guidelines:
- Keep replies concise and mobile-friendly (this is iMessage, not email)
- When logging data, confirm exactly what was saved
- When showing stats, use plain text — no markdown headers or bullet symbols that look odd in SMS
- If something is ambiguous, ask a brief clarifying question
- Dates default to today unless specified`;

const tools: Anthropic.Tool[] = [
  {
    name: "query_health_data",
    description:
      "Query the user's health data. Returns recent records from daily metrics, strength workouts, cardio sessions, and nutrition logs.",
    input_schema: {
      type: "object" as const,
      properties: {
        data_type: {
          type: "string",
          enum: ["daily", "strength", "cardio", "nutrition", "all"],
          description: "Which type of health data to query",
        },
        date_from: {
          type: "string",
          description: "Filter start date YYYY-MM-DD (optional)",
        },
        date_to: {
          type: "string",
          description: "Filter end date YYYY-MM-DD (optional, defaults to today)",
        },
        limit: {
          type: "number",
          description: "Max recent records to return (default 7)",
        },
      },
      required: ["data_type"],
    },
  },
  {
    name: "log_daily",
    description: "Log or update daily health metrics: weight, steps, sleep, water intake.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
        weight_kg: { type: "number", description: "Body weight in kg" },
        steps: { type: "number", description: "Step count" },
        sleep_hours: { type: "number", description: "Sleep in hours" },
        water_ml: { type: "number", description: "Water intake in ml" },
        notes: { type: "string", description: "Optional notes" },
      },
    },
  },
  {
    name: "log_strength",
    description: "Log a strength training exercise with sets, reps, and weight.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
        exercise: { type: "string", description: "Exercise name, e.g. Bench Press" },
        muscle_group: { type: "string", description: "Muscle group, e.g. Chest" },
        sets: { type: "number", description: "Number of sets" },
        reps: { type: "number", description: "Reps per set" },
        weight_kg: {
          type: "number",
          description: "Weight in kg (use 0 for bodyweight)",
        },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["exercise", "sets", "reps"],
    },
  },
  {
    name: "log_cardio",
    description: "Log a cardio session: running, cycling, swimming, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
        activity_type: { type: "string", description: "Activity, e.g. Running" },
        duration_min: { type: "number", description: "Duration in minutes" },
        distance_km: {
          type: "number",
          description: "Distance in km (0 if not applicable)",
        },
        avg_heart_rate: {
          type: "number",
          description: "Avg heart rate in bpm (0 if unknown)",
        },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["activity_type", "duration_min"],
    },
  },
  {
    name: "log_nutrition",
    description: "Log a meal or food item with calorie and macro info.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
        meal_type: {
          type: "string",
          enum: ["breakfast", "lunch", "dinner", "snack"],
          description: "Meal type",
        },
        food: { type: "string", description: "Food name or description" },
        calories: { type: "number", description: "Calories (0 if unknown)" },
        protein_g: { type: "number", description: "Protein in grams (0 if unknown)" },
        carbs_g: {
          type: "number",
          description: "Carbohydrates in grams (0 if unknown)",
        },
        fat_g: { type: "number", description: "Fat in grams (0 if unknown)" },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["meal_type", "food"],
    },
  },
];

type ToolInput = Record<string, unknown>;

function filterByDate<T extends { date: string }>(
  rows: T[],
  dateFrom?: string,
  dateTo?: string,
  limit = 7
): T[] {
  return rows
    .filter(
      (r) => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= (dateTo ?? today()))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

function handleQueryHealthData(input: ToolInput): string {
  const { data_type, date_from, date_to, limit = 7 } = input as {
    data_type: "daily" | "strength" | "cardio" | "nutrition" | "all";
    date_from?: string;
    date_to?: string;
    limit?: number;
  };

  const result: Record<string, unknown> = {};

  if (data_type === "daily" || data_type === "all") {
    const rows = filterByDate(readCsv<DailyEntry>("daily.csv"), date_from, date_to, limit);
    result.daily = rows;
    if (data_type === "all" && rows.length === 0) delete result.daily;
  }
  if (data_type === "strength" || data_type === "all") {
    const rows = filterByDate(readCsv<StrengthEntry>("strength.csv"), date_from, date_to, limit);
    result.strength = rows;
    if (data_type === "all" && rows.length === 0) delete result.strength;
  }
  if (data_type === "cardio" || data_type === "all") {
    const rows = filterByDate(readCsv<CardioEntry>("cardio.csv"), date_from, date_to, limit);
    result.cardio = rows;
    if (data_type === "all" && rows.length === 0) delete result.cardio;
  }
  if (data_type === "nutrition" || data_type === "all") {
    const rows = filterByDate(
      readCsv<NutritionEntry>("nutrition.csv"),
      date_from,
      date_to,
      limit
    );
    result.nutrition = rows;
    if (data_type === "all" && rows.length === 0) delete result.nutrition;
  }

  if (Object.keys(result).length === 0) return "No data found for the specified range.";
  return JSON.stringify(result);
}

function handleLogDaily(input: ToolInput): string {
  const { date = today(), weight_kg = 0, steps = 0, sleep_hours = 0, water_ml = 0, notes = "" } =
    input as Partial<DailyEntry>;

  const entry: DailyEntry = {
    date,
    weight_kg: Number(weight_kg),
    steps: Number(steps),
    sleep_hours: Number(sleep_hours),
    water_ml: Number(water_ml),
    notes: String(notes),
  };

  const rows = readCsv<DailyEntry>("daily.csv").filter((r) => r.date !== entry.date);
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("daily.csv", rows);
  revalidatePath("/");
  revalidatePath("/daily");

  return JSON.stringify({ logged: entry });
}

function handleLogStrength(input: ToolInput): string {
  const {
    date = today(),
    exercise,
    muscle_group = "",
    sets,
    reps,
    weight_kg = 0,
    notes = "",
  } = input as Partial<StrengthEntry>;

  const entry: StrengthEntry = {
    date: date || today(),
    exercise: String(exercise),
    muscle_group: String(muscle_group),
    sets: Number(sets),
    reps: Number(reps),
    weight_kg: Number(weight_kg),
    notes: String(notes),
  };

  const rows = readCsv<StrengthEntry>("strength.csv");
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("strength.csv", rows);
  revalidatePath("/");
  revalidatePath("/strength");

  return JSON.stringify({ logged: entry });
}

function handleLogCardio(input: ToolInput): string {
  const {
    date = today(),
    activity_type,
    duration_min,
    distance_km = 0,
    avg_heart_rate = 0,
    notes = "",
  } = input as Partial<CardioEntry>;

  const entry: CardioEntry = {
    date: date || today(),
    activity_type: String(activity_type),
    duration_min: Number(duration_min),
    distance_km: Number(distance_km),
    avg_heart_rate: Number(avg_heart_rate),
    notes: String(notes),
  };

  const rows = readCsv<CardioEntry>("cardio.csv");
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("cardio.csv", rows);
  revalidatePath("/");
  revalidatePath("/cardio");

  return JSON.stringify({ logged: entry });
}

function handleLogNutrition(input: ToolInput): string {
  const {
    date = today(),
    meal_type,
    food,
    calories = 0,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    notes = "",
  } = input as Partial<NutritionEntry>;

  const entry: NutritionEntry = {
    date: date || today(),
    meal_type: (meal_type as NutritionEntry["meal_type"]) || "snack",
    food: String(food),
    calories: Number(calories),
    protein_g: Number(protein_g),
    carbs_g: Number(carbs_g),
    fat_g: Number(fat_g),
    notes: String(notes),
  };

  const rows = readCsv<NutritionEntry>("nutrition.csv");
  rows.push(entry);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  writeCsv("nutrition.csv", rows);
  revalidatePath("/");
  revalidatePath("/nutrition");

  return JSON.stringify({ logged: entry });
}

function executeTool(name: string, input: ToolInput): string {
  try {
    switch (name) {
      case "query_health_data":
        return handleQueryHealthData(input);
      case "log_daily":
        return handleLogDaily(input);
      case "log_strength":
        return handleLogStrength(input);
      case "log_cardio":
        return handleLogCardio(input);
      case "log_nutrition":
        return handleLogNutrition(input);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}

export async function runChatAgent(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  });

  // Agentic loop: keep executing tools until Claude is done
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      content: executeTool(b.name, b.input as ToolInput),
    }));

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "Done.";
}
