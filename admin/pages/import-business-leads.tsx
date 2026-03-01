/** @jsxRuntime classic */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { jsx } from "@keystone-ui/core";
import { PageContainer } from "@keystone-6/core/admin-ui/components";
import { Heading } from "@keystone-ui/core";
import { GOOGLE_PLACE_CATEGORIES } from "../../utils/constants/googlePlaceCategories";

declare const L: any;

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 }; // CDMX
const DEFAULT_ZOOM = 12;
const DEFAULT_RADIUS_KM = 5;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;

function loadExternalResource(
  tag: "link" | "script",
  attrs: Record<string, string>,
) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `${tag}[${tag === "link" ? "href" : "src"}="${tag === "link" ? attrs.href : attrs.src}"]`,
    );
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${tag}`));
    document.head.appendChild(el);
  });
}

export default function ImportBusinessLeadsPage() {
  const [category, setCategory] = useState<string>(
    GOOGLE_PLACE_CATEGORIES[0].value,
  );
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    created: number;
    alreadyInDb: number;
    skippedLowRating: number;
  } | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadExternalResource("link", {
          rel: "stylesheet",
          href: LEAFLET_CSS,
        });
        await loadExternalResource("script", { src: LEAFLET_JS });
        if (!cancelled) setLeafletReady(true);
      } catch (e) {
        console.error("Leaflet load error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateMapOverlays = useCallback(
    (lat: number, lng: number, rKm: number) => {
      const map = mapRef.current;
      if (!map) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }

      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]).setRadius(rKm * 1000);
      } else {
        circleRef.current = L.circle([lat, lng], {
          radius: rKm * 1000,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map);
      }

      map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    },
    [],
  );

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(
      [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      DEFAULT_ZOOM,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;

    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      setPin({ lat, lng });
    });
  }, [leafletReady]);

  useEffect(() => {
    if (pin) updateMapOverlays(pin.lat, pin.lng, radiusKm);
  }, [pin, radiusKm, updateMapOverlays]);

  const runSync = async () => {
    if (!pin) {
      setMessage({
        type: "error",
        text: "Haz clic en el mapa para colocar el punto de búsqueda",
      });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    setStats(null);

    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation SyncBusinessLeadsFromGoogle($input: SyncBusinessLeadsFromGoogleInput!) {
              syncBusinessLeadsFromGoogle(input: $input) {
                success
                message
                created
                alreadyInDb
                skippedLowRating
              }
            }
          `,
          variables: {
            input: {
              lat: pin.lat,
              lng: pin.lng,
              radius: radiusKm,
              category,
              maxResults: 60,
            },
          },
        }),
        credentials: "include",
      });

      const data = await res.json();
      const result = data.data?.syncBusinessLeadsFromGoogle;

      if (!result) {
        setMessage({
          type: "error",
          text: data.errors?.[0]?.message || "Error de conexión",
        });
        return;
      }
      if (result.success) {
        setMessage({ type: "ok", text: result.message });
        setStats({
          created: result.created,
          alreadyInDb: result.alreadyInDb,
          skippedLowRating: result.skippedLowRating,
        });
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Error de red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      header={<Heading type="h3">Importar leads desde Google Maps</Heading>}
    >
      <div style={{ maxWidth: "100%", margin: "0 auto", padding: "20px" }}>
        {/* ── Formulario ── */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            border: "1px solid #e1e5e9",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 8,
              color: "#1a202c",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            Sincronizar negocios por zona
          </h2>
          <p style={{ marginBottom: 16, color: "#4a5568", lineHeight: 1.5 }}>
            <strong>1.</strong> Haz clic en el mapa para colocar el punto de
            búsqueda. <strong>2.</strong> Ajusta el radio (km).{" "}
            <strong>3.</strong> Elige el tipo de negocio y pulsa{" "}
            <em>Sincronizar</em>. Solo se importan negocios con{" "}
            <strong>rating ≥ 4</strong> y <strong>≥ 20 reseñas</strong>.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 500,
                  color: "#2d3748",
                }}
              >
                Tipo de negocio
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: "border-box",
                  backgroundColor: "white",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
                disabled={isLoading}
              >
                {GOOGLE_PLACE_CATEGORIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 500,
                  color: "#2d3748",
                }}
              >
                Radio: {radiusKm} km
              </label>
              <input
                type="range"
                min={MIN_RADIUS_KM}
                max={MAX_RADIUS_KM}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                disabled={isLoading}
                style={{ width: "100%" }}
              />
            </div>

            <button
              onClick={runSync}
              disabled={isLoading || !pin}
              style={{
                backgroundColor: isLoading ? "#6b7280" : "#3b82f6",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: 6,
                cursor: isLoading || !pin ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {isLoading ? "Sincronizando…" : "Sincronizar"}
            </button>
          </div>

          {pin && (
            <p style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
              Punto seleccionado: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} —
              Radio: {radiusKm} km
            </p>
          )}
        </div>

        {/* ── Mensajes y stats ── */}
        {message && (
          <div
            style={{
              padding: 16,
              borderRadius: 6,
              marginBottom: 16,
              backgroundColor: message.type === "error" ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${message.type === "error" ? "#fecaca" : "#bbf7d0"}`,
              color: message.type === "error" ? "#dc2626" : "#166534",
            }}
          >
            {message.text}
          </div>
        )}

        {stats && message?.type === "ok" && (
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600, color: "#166534" }}>
              Creados: {stats.created}
            </span>
            <span style={{ color: "#4a5568" }}>
              Ya en BD: {stats.alreadyInDb}
            </span>
            <span style={{ color: "#6b7280" }}>
              Descartados (rating &lt; 4 o reseñas &lt; 20):{" "}
              {stats.skippedLowRating}
            </span>
          </div>
        )}

        {/* ── Mapa ── */}
        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: 500,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            backgroundColor: "#f3f4f6",
          }}
        />
        {!leafletReady && (
          <p style={{ textAlign: "center", color: "#6b7280", marginTop: 8 }}>
            Cargando mapa…
          </p>
        )}
      </div>
    </PageContainer>
  );
}
