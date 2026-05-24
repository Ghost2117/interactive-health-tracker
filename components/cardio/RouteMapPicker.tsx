"use client";

import { useCallback, useRef, useState } from "react";
import Map, { useControl, type MapRef } from "react-map-gl/mapbox";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import length from "@turf/length";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Trash2 } from "lucide-react";
import type { RouteFeature } from "@/lib/routes";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ── DrawControl ──────────────────────────────────────────────────────────────

type DrawControlProps = {
  onCreate: (e: { features: RouteFeature[] }) => void;
  onUpdate: (e: { features: RouteFeature[] }) => void;
  onDelete: () => void;
};

function DrawControl({ onCreate, onUpdate, onDelete }: DrawControlProps) {
  useControl<MapboxDraw>(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, trash: true },
        defaultMode: "draw_line_string",
      }),
    ({ map }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("draw.create", onCreate as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("draw.update", onUpdate as any);
      map.on("draw.delete", onDelete);
    },
    ({ map }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off("draw.create", onCreate as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off("draw.update", onUpdate as any);
      map.off("draw.delete", onDelete);
    }
  );
  return null;
}

// ── Geocoding ────────────────────────────────────────────────────────────────

type Suggestion = { place_name: string; center: [number, number] };

async function geocode(query: string): Promise<Suggestion[]> {
  if (!query.trim()) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []) as Suggestion[];
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  onConfirm: (result: {
    distance_km: number;
    duration_min: number;
    routeFeature: RouteFeature;
  }) => void;
  onCancel: () => void;
};

export function RouteMapPicker({ onConfirm, onCancel }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: -0.1276,
    latitude: 51.5074,
    zoom: 12,
  });

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const [routeFeature, setRouteFeature] = useState<RouteFeature | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState<number | "">("");

  // ── Search ────────────────────────────────────────────────────────────────

  async function handleSearch() {
    setSearching(true);
    const results = await geocode(query);
    setSuggestions(results);
    setSearching(false);
  }

  function selectSuggestion(s: Suggestion) {
    setSuggestions([]);
    setQuery(s.place_name);
    mapRef.current?.flyTo({ center: s.center, zoom: 14 });
  }

  // ── Draw events ───────────────────────────────────────────────────────────

  const handleDrawChange = useCallback((features: RouteFeature[]) => {
    if (!features.length) return;
    const feature = features[0];
    setRouteFeature(feature);
    const km = length(feature as Parameters<typeof length>[0], { units: "kilometers" });
    setDistanceKm(Math.round(km * 100) / 100);
  }, []);

  const onCreate = useCallback(
    (e: { features: RouteFeature[] }) => handleDrawChange(e.features),
    [handleDrawChange]
  );
  const onUpdate = useCallback(
    (e: { features: RouteFeature[] }) => handleDrawChange(e.features),
    [handleDrawChange]
  );
  const onDelete = useCallback(() => {
    setRouteFeature(null);
    setDistanceKm(0);
  }, []);

  // ── Confirm ───────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!routeFeature || !durationMin) return;
    onConfirm({
      distance_km: distanceKm,
      duration_min: Number(durationMin),
      routeFeature,
    });
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search for a location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
            <Search size={14} />
          </Button>
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md text-sm max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <li
                key={s.place_name}
                className="px-3 py-2 cursor-pointer hover:bg-muted truncate"
                onClick={() => selectSuggestion(s)}
              >
                {s.place_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-md overflow-hidden border min-h-[380px]">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(e) => setViewState(e.viewState)}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={TOKEN}
          style={{ width: "100%", height: "100%" }}
        >
          <DrawControl onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />
        </Map>
      </div>

      {/* Draw hint */}
      {!routeFeature && (
        <p className="text-xs text-muted-foreground text-center">
          Click the line tool in the map controls, then click to place points along your route. Double-click to finish.
        </p>
      )}

      {/* Stats + duration */}
      <div className="flex items-end gap-4">
        <div className="flex-1 rounded-md border bg-muted/40 px-4 py-2 text-center">
          <p className="text-xs text-muted-foreground">Distance</p>
          <p className="text-xl font-bold">{distanceKm > 0 ? `${distanceKm} km` : "—"}</p>
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            placeholder="30"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRouteFeature(null);
            setDistanceKm(0);
          }}
          disabled={!routeFeature}
        >
          <Trash2 size={13} className="mr-1" /> Clear route
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!routeFeature || !durationMin}
          >
            Confirm route →
          </Button>
        </div>
      </div>
    </div>
  );
}
