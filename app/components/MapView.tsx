"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare const maplibregl: any;

interface PractitionerProfile {
  platform: "doctolib" | "docorga" | "lemedecin";
  url: string;
}

interface Practitioner {
  id: number;
  name: string;
  profession: string;
  specialty: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distance: number | null;
  profiles?: PractitionerProfile[];
}

const PLATFORM_LABEL: Record<string, string> = {
  doctolib: "Doctolib",
  docorga: "Docorga",
  lemedecin: "LeMedecin.fr",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://piana-care.onrender.com";

const FRANCE_CENTER: [number, number] = [2.2137, 46.6034];

function practitionersToGeoJSON(practitioners: Practitioner[]) {
  return {
    type: "FeatureCollection" as const,
    features: practitioners.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: { id: p.id, name: p.name, profession: p.profession, specialty: p.specialty, address: p.address, phone: p.phone, distance: p.distance },
    })),
  };
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const practitionersRef = useRef<Practitioner[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [activePractitioner, setActivePractitioner] = useState<Practitioner | null>(null);
  const [panelHidden, setPanelHidden] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [searchProfession, setSearchProfession] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  const fetchPractitioners = useCallback(async (profession: string, location: string) => {
    const params = new URLSearchParams();
    if (profession.trim()) params.set("profession", profession.trim());
    if (location.trim()) params.set("location", location.trim());
    const res = await fetch(`${API_URL}/api/practitioners?${params}`);
    const json = await res.json();
    return json.data as Practitioner[];
  }, []);

  useEffect(() => {
    fetchPractitioners("", "").then((data) => {
      setPractitioners(data);
      practitionersRef.current = data;
    });
  }, [fetchPractitioners]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (typeof maplibregl === "undefined") return;

    const map = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: FRANCE_CENTER,
        zoom: 5.5,
        maxZoom: 20,
        attributionControl: false,
        preserveDrawingBuffer: true,
        trackResize: false,
      });

    map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
      }),
      "bottom-right"
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      map.on("load", () => {
        map.getStyle().layers.forEach((layer: any) => {
          if (layer.type === "fill-extrusion") {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        });

        map.addSource("practitioners", {
          type: "geojson",
          data: practitionersToGeoJSON(practitionersRef.current),
        });

        map.addLayer({
          id: "practitioner-points-shadow",
          type: "circle",
          source: "practitioners",
          paint: {
            "circle-color": "#D4654A",
            "circle-radius": 12,
            "circle-blur": 0.8,
            "circle-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "practitioner-points",
          type: "circle",
          source: "practitioners",
          paint: {
            "circle-color": "#D4654A",
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("click", "practitioner-points", (e: any) => {
          if (!e.features?.[0]) return;
          const props = e.features[0].properties;
          const p = practitionersRef.current.find((pr) => pr.id === props.id);
          if (p) {
            setActivePractitioner(p);
            map.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 600 });
          }
        });

        map.on("mouseenter", "practitioner-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "practitioner-points", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["practitioner-points"] });
          if (features.length === 0) {
            setActivePractitioner(null);
          }
        });
      });

    mapRef.current = map;

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      document.body.classList.add("map-resizing");
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.resize();
        document.body.classList.remove("map-resizing");
      }, 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("practitioners");
    if (source && "setData" in source) {
      (source as { setData: (data: unknown) => void }).setData(practitionersToGeoJSON(practitioners));
    }
  }, [practitioners]);

  const handleSearch = useCallback(async () => {
    const results = await fetchPractitioners(searchProfession, searchLocation);
    setPractitioners(results);
    practitionersRef.current = results;
    setActivePractitioner(null);

    if (results.length > 0 && mapRef.current) {
      const bounds = new maplibregl.LngLatBounds();
      results.forEach((p) => bounds.extend([p.lng, p.lat]));
      mapRef.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 60, left: 380, right: 60 },
        maxZoom: 15,
        duration: 800,
      });
    }
  }, [searchProfession, searchLocation, fetchPractitioners]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const selectPractitioner = (p: Practitioner) => {
    setActivePractitioner(p);
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 600 });
  };

  const specialties = activePractitioner?.specialty
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

  return (
    <>
      <div id="map" ref={mapContainer} />

      <header className="topbar">
        <div className="topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.svg" alt="Piana Care" className="brand-logo brand-logo--full" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Piana Care" className="brand-logo brand-logo--icon" />
        </div>

        <div className="search-group">
          <div className="search-field search-field--profession">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Profession ou spécialité"
              autoComplete="off"
              value={searchProfession}
              onChange={(e) => setSearchProfession(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="search-divider" />
          <div className="search-field search-field--location">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9.5 8 14.5 8 14.5S12.5 9.5 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <input
              type="text"
              placeholder="Ville ou code postal"
              autoComplete="off"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button className="search-submit" onClick={handleSearch} aria-label="Rechercher">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11.5" y1="11.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <aside className={`results-panel ${panelHidden ? "hidden" : ""}`}>
        <div className="results-header">
          <div className="results-count">
            <span className="count-number">{practitioners.length}</span> professionnels
          </div>
          <button className="results-toggle" onClick={() => setPanelHidden(!panelHidden)} aria-label="Fermer le panneau">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <ul className="results-list">
          {practitioners.map((p) => (
            <li
              key={p.id}
              className={`result-item ${activePractitioner?.id === p.id ? "active" : ""}`}
              onClick={() => selectPractitioner(p)}
            >
              <div className="result-item__name">{p.name}</div>
              <div className="result-item__profession">{p.specialty || p.profession}</div>
              <div className="result-item__address">{p.address}</div>
              {p.distance != null && <div className="result-item__distance">{p.distance.toFixed(1)} km</div>}
            </li>
          ))}
        </ul>
      </aside>

      <div className={`practitioner-drawer ${activePractitioner ? "open" : ""}`}>
        <button className="drawer-close" onClick={() => setActivePractitioner(null)} aria-label="Fermer">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {activePractitioner && (
          <div className="drawer-content">
            <div className="drawer-profession">{activePractitioner.profession}</div>
            <h2 className="drawer-name">{activePractitioner.name}</h2>

            {specialties.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Spécialités</div>
                <div className="drawer-specialties">
                  {specialties.map((s) => (
                    <span key={s} className="drawer-tag">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="drawer-section">
              <div className="drawer-section-title">Coordonnées</div>
              <div className="drawer-info-row">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9.5 8 14.5 8 14.5S12.5 9.5 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span className="drawer-info-text">{activePractitioner.address}</span>
              </div>
              {activePractitioner.phone && (
                <div className="drawer-info-row">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6.5 3.5L5.5 1.5H3.5C2.5 1.5 1.5 2.5 1.5 3.5C1.5 9 7 14.5 12.5 14.5C13.5 14.5 14.5 13.5 14.5 12.5V10.5L12.5 9.5L11 11C11 11 9 10 7.5 8.5C6 7 5 5 5 5L6.5 3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span className="drawer-info-text">
                    <a href={`tel:${activePractitioner.phone.replace(/\s/g, "")}`}>{activePractitioner.phone}</a>
                  </span>
                </div>
              )}
            </div>

            {activePractitioner.distance != null && (
              <div className="drawer-section">
                <div className="drawer-section-title">Distance</div>
                <div className="drawer-info-row">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="4" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="12" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 10.5L10 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" />
                  </svg>
                  <span className="drawer-info-text">{activePractitioner.distance.toFixed(1)} km de votre position</span>
                </div>
              </div>
            )}

            {activePractitioner.profiles && activePractitioner.profiles.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-profiles">
                  {activePractitioner.profiles.map((profile) => (
                    <a
                      key={profile.platform}
                      href={profile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="drawer-profile-btn"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/${profile.platform}-logo.png`}
                        alt={PLATFORM_LABEL[profile.platform]}
                        className="drawer-profile-logo"
                      />
                      <span className="drawer-profile-label">Profil {PLATFORM_LABEL[profile.platform]}</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="drawer-profile-icon">
                        <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`mobile-sheet ${mobileExpanded ? "expanded" : ""}`}>
        <div className="sheet-handle" onClick={() => setMobileExpanded(!mobileExpanded)} />
        <div className="sheet-header">
          <span className="sheet-count">
            {practitioners.length} résultat{practitioners.length > 1 ? "s" : ""}
          </span>
        </div>
        <ul className="sheet-list">
          {practitioners.map((p) => (
            <li
              key={p.id}
              className={`result-item ${activePractitioner?.id === p.id ? "active" : ""}`}
              onClick={() => selectPractitioner(p)}
            >
              <div className="result-item__name">{p.name}</div>
              <div className="result-item__profession">{p.specialty || p.profession}</div>
              <div className="result-item__address">{p.address}</div>
              {p.distance != null && <div className="result-item__distance">{p.distance.toFixed(1)} km</div>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
