"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare const maplibregl: any;

interface Practitioner {
  id: number;
  name: string;
  profession: string;
  specialty: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distance: number;
}

const MOCK_PRACTITIONERS: Practitioner[] = [
  { id: 1, name: "Dr. Marie Lefèvre", profession: "Médecin", specialty: "Médecine Générale", address: "12 Rue de Rivoli, 75001 Paris", phone: "01 42 33 12 45", lat: 48.8606, lng: 2.3376, distance: 0.3 },
  { id: 2, name: "Dr. Thomas Mercier", profession: "Psychiatre", specialty: "Psychiatrie de l'adulte", address: "45 Boulevard Saint-Germain, 75005 Paris", phone: "01 43 26 78 90", lat: 48.8495, lng: 2.3477, distance: 0.8 },
  { id: 3, name: "Sophie Durand", profession: "Psychologue", specialty: "TCC, Anxiété", address: "8 Rue du Bac, 75007 Paris", phone: "01 45 44 32 10", lat: 48.8557, lng: 2.3254, distance: 1.1 },
  { id: 4, name: "Dr. Karim Benali", profession: "Médecin", specialty: "Cardiologie", address: "23 Avenue de l'Opéra, 75001 Paris", phone: "01 42 61 55 33", lat: 48.8690, lng: 2.3340, distance: 0.5 },
  { id: 5, name: "Claire Moreau", profession: "Kinésithérapeute", specialty: "Rééducation fonctionnelle", address: "67 Rue de Clichy, 75009 Paris", phone: "01 48 74 22 18", lat: 48.8812, lng: 2.3285, distance: 1.8 },
  { id: 6, name: "Dr. Jean-Pierre Roux", profession: "Dentiste", specialty: "Chirurgie dentaire", address: "15 Rue de la Paix, 75002 Paris", phone: "01 42 61 44 77", lat: 48.8693, lng: 2.3305, distance: 0.6 },
  { id: 7, name: "Lucie Martin", profession: "Infirmière", specialty: "Soins à domicile", address: "34 Rue Montmartre, 75002 Paris", phone: "01 42 33 98 01", lat: 48.8655, lng: 2.3427, distance: 0.4 },
  { id: 8, name: "Dr. Anne-Sophie Petit", profession: "Médecin", specialty: "Dermatologie", address: "9 Place Vendôme, 75001 Paris", phone: "01 42 60 11 23", lat: 48.8673, lng: 2.3291, distance: 0.7 },
  { id: 9, name: "Marc Girard", profession: "Orthophoniste", specialty: "Troubles du langage", address: "52 Rue de Turbigo, 75003 Paris", phone: "01 42 72 34 56", lat: 48.8650, lng: 2.3545, distance: 1.3 },
  { id: 10, name: "Dr. Isabelle Fontaine", profession: "Médecin", specialty: "Pédiatrie", address: "18 Rue de Sèvres, 75006 Paris", phone: "01 45 48 90 12", lat: 48.8510, lng: 2.3270, distance: 1.5 },
  { id: 11, name: "Philippe Dubois", profession: "Ostéopathe", specialty: "Ostéopathie structurelle", address: "28 Rue du Faubourg Saint-Honoré, 75008 Paris", phone: "01 42 65 88 44", lat: 48.8720, lng: 2.3150, distance: 1.0 },
  { id: 12, name: "Dr. Nathalie Laurent", profession: "Médecin", specialty: "Ophtalmologie", address: "3 Rue Scribe, 75009 Paris", phone: "01 47 42 33 55", lat: 48.8718, lng: 2.3320, distance: 0.9 },
  { id: 13, name: "Éric Blanc", profession: "Psychologue", specialty: "Psychologie clinique", address: "41 Rue de Babylone, 75007 Paris", phone: "01 45 51 22 67", lat: 48.8515, lng: 2.3165, distance: 1.6 },
  { id: 14, name: "Dr. François Nguyen", profession: "Médecin", specialty: "ORL", address: "6 Rue Auber, 75009 Paris", phone: "01 47 42 11 88", lat: 48.8735, lng: 2.3310, distance: 1.2 },
  { id: 15, name: "Camille Bernard", profession: "Sage-femme", specialty: "Suivi de grossesse", address: "19 Rue de Vaugirard, 75006 Paris", phone: "01 42 22 45 00", lat: 48.8492, lng: 2.3340, distance: 1.4 },
];

const PARIS_CENTER: [number, number] = [2.3422, 48.8606];

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
  const [practitioners, setPractitioners] = useState<Practitioner[]>(MOCK_PRACTITIONERS);
  const [activePractitioner, setActivePractitioner] = useState<Practitioner | null>(null);
  const [panelHidden, setPanelHidden] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [searchProfession, setSearchProfession] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (typeof maplibregl === "undefined") return;

    const map = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: PARIS_CENTER,
        zoom: 13,
        maxZoom: 20,
        attributionControl: false,
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
        map.addSource("practitioners", {
          type: "geojson",
          data: practitionersToGeoJSON(MOCK_PRACTITIONERS),
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
          const p = MOCK_PRACTITIONERS.find((pr) => pr.id === props.id);
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

    return () => {
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

  const handleSearch = useCallback(() => {
    const prof = searchProfession.toLowerCase().trim();
    const loc = searchLocation.toLowerCase().trim();

    let results = MOCK_PRACTITIONERS;
    if (prof) {
      results = results.filter(
        (p) => p.profession.toLowerCase().includes(prof) || p.specialty.toLowerCase().includes(prof)
      );
    }
    if (loc) {
      results = results.filter((p) => p.address.toLowerCase().includes(loc));
    }

    setPractitioners(results);
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
  }, [searchProfession, searchLocation]);

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
          <svg className="brand-mark" width="24" height="24" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="6" stroke="currentColor" strokeWidth="1" />
            <circle cx="14" cy="14" r="2" fill="currentColor" />
            <line x1="14" y1="0" x2="14" y2="5" stroke="currentColor" strokeWidth="1" />
            <line x1="14" y1="23" x2="14" y2="28" stroke="currentColor" strokeWidth="1" />
            <line x1="0" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="1" />
            <line x1="23" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="brand-name">
            piana<span className="brand-care">care</span>
          </span>
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
