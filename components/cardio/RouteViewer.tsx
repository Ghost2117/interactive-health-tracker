"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/mapbox";
import { getRoute } from "@/lib/actions";
import type { RouteFeature } from "@/lib/routes";
import { toDisplay, type Unit } from "@/lib/units";
import length from "@turf/length";

import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = { routeId: string; unit: Unit };

export function RouteViewer({ routeId, unit }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [route, setRoute] = useState<RouteFeature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoute(routeId).then((r) => {
      setRoute(r);
      setLoading(false);
    });
  }, [routeId]);

  function handleMapLoad() {
    if (!route || !mapRef.current) return;
    const coords = route.geometry.coordinates as [number, number][];
    if (coords.length < 2) return;
    const bounds = coords.reduce(
      (b, c) => ({
        minLng: Math.min(b.minLng, c[0]), maxLng: Math.max(b.maxLng, c[0]),
        minLat: Math.min(b.minLat, c[1]), maxLat: Math.max(b.maxLat, c[1]),
      }),
      { minLng: coords[0][0], maxLng: coords[0][0], minLat: coords[0][1], maxLat: coords[0][1] }
    );
    mapRef.current.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
      { padding: 60, duration: 0 }
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading route…</div>;
  }
  if (!route) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Route not found.</div>;
  }

  const distanceKm = length(route as Parameters<typeof length>[0], { units: "kilometers" });
  const displayDist = toDisplay(distanceKm, unit);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 relative rounded-md overflow-hidden border min-h-0">
        <Map
          ref={mapRef}
          initialViewState={{ longitude: 0, latitude: 0, zoom: 2 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={TOKEN}
          onLoad={handleMapLoad}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <Source id="route" type="geojson" data={route}>
            <Layer
              id="route-line"
              type="line"
              paint={{ "line-color": "hsl(221, 83%, 53%)", "line-width": 4, "line-opacity": 0.9 }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        </Map>
      </div>
      <div className="rounded-md border bg-muted/40 px-4 py-2 text-center shrink-0">
        <p className="text-xs text-muted-foreground">Distance</p>
        <p className="text-xl font-bold">{displayDist} {unit}</p>
      </div>
    </div>
  );
}
