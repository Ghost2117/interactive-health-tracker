export type DailyEntry = {
  date: string;
  weight_kg: number;
  steps: number;
  sleep_hours: number;
  water_ml: number;
  notes: string;
};

export type StrengthEntry = {
  date: string;
  exercise: string;
  muscle_group: string;
  sets: number;
  reps: number;
  weight_kg: number;
  notes: string;
};

export type CardioEntry = {
  date: string;
  activity_type: string;
  duration_min: number;
  distance_km: number;
  avg_heart_rate: number;
  notes: string;
};

export type NutritionEntry = {
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string;
};
