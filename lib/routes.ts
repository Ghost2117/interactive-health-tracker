import fs from "fs";
import path from "path";

export type RouteFeature = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: Record<string, unknown>;
};

const ROUTES_PATH = path.join(process.cwd(), "data", "routes.json");

export function readRoutes(): Record<string, RouteFeature> {
  if (!fs.existsSync(ROUTES_PATH)) return {};
  const raw = fs.readFileSync(ROUTES_PATH, "utf-8");
  return JSON.parse(raw) as Record<string, RouteFeature>;
}

export function writeRoute(id: string, feature: RouteFeature): void {
  const routes = readRoutes();
  routes[id] = feature;
  fs.writeFileSync(ROUTES_PATH, JSON.stringify(routes, null, 2) + "\n", "utf-8");
}

export function readRoute(id: string): RouteFeature | null {
  const routes = readRoutes();
  return routes[id] ?? null;
}
