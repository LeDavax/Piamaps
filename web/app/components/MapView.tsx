"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare const maplibregl: any;

interface Practitioner {
  id: string;
  first_name: string;
  last_name: string;
  gender_code: string;
  profession_code: string;
  profession_label: string;
  address: string;
  postal_code: string;
  city: string;
  department_code: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  diplomas: string | null;
  distance: number | null;
}

const KNOWN_PLATFORMS: { domain: string; label: string; logo: string }[] = [
  { domain: "doctolib.fr", label: "Doctolib", logo: "/doctolib-logo.png" },
  { domain: "docorga.com", label: "Docorga", logo: "/docorga-logo.png" },
  { domain: "lemedecin.fr", label: "LeMedecin.fr", logo: "/lemedecin-logo.png" },
  { domain: "keldoc.com", label: "Keldoc", logo: "/keldoc-logo.png" },
  { domain: "maiia.com", label: "Maiia", logo: "/maiia-logo.png" },
];

function getPlatformInfo(url: string) {
  try {
    const hostname = new URL(url).hostname;
    const match = KNOWN_PLATFORMS.find((p) => hostname === p.domain || hostname.endsWith("." + p.domain));
    if (match) return match;
  } catch {}
  return { domain: "", label: new URL(url).hostname.replace(/^www\./, ""), logo: "/website-logo.svg" };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://piamaps-api.onrender.com";

const FRANCE_CENTER: [number, number] = [2.2137, 46.6034];

function practitionersToGeoJSON(practitioners: Practitioner[]) {
  return {
    type: "FeatureCollection" as const,
    features: practitioners
      .filter((p) => p.latitude && p.longitude)
      .map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.longitude!, p.latitude!] },
        properties: { id: p.id },
      })),
  };
}

function getLinks(p: Practitioner): string[] {
  if (!p.website) return [];
  try {
    return JSON.parse(p.website);
  } catch {
    return [];
  }
}

function getDiplomas(p: Practitioner): string[] {
  if (!p.diplomas) return [];
  try {
    return JSON.parse(p.diplomas);
  } catch {
    return [];
  }
}

function displayName(p: Practitioner): string {
  const prefix = p.profession_code === '1' ? 'Dr. ' : '';
  return `${prefix}${p.first_name} ${p.last_name}`;
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
  const [logoCompact, setLogoCompact] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    setLogoCompact(mql.matches);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLogoReady(true));
    });
    const handler = (e: MediaQueryListEvent) => setLogoCompact(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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
            map.flyTo({ center: [p.longitude!, p.latitude!], zoom: 15, duration: 600 });
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
    let snapshot: HTMLImageElement | null = null;

    const handleResize = () => {
      clearTimeout(resizeTimer);

      if (!snapshot && mapContainer.current) {
        const canvas = map.getCanvas();
        const img = document.createElement("img");
        img.src = canvas.toDataURL();
        img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:none;object-position:center;z-index:1;pointer-events:none;";
        mapContainer.current.appendChild(img);
        snapshot = img;
      }

      resizeTimer = setTimeout(() => {
        map.resize();
        if (snapshot) {
          snapshot.remove();
          snapshot = null;
        }
      }, 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
      if (snapshot) snapshot.remove();
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
      results.forEach((p) => { if (p.longitude && p.latitude) bounds.extend([p.longitude, p.latitude]); });
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
    mapRef.current?.flyTo({ center: [p.longitude!, p.latitude!], zoom: 15, duration: 600 });
  };

  const diplomas = activePractitioner ? getDiplomas(activePractitioner) : [];
  const links = activePractitioner ? getLinks(activePractitioner) : [];

  return (
    <>
      <div id="map" ref={mapContainer} />

      <header className="topbar">
        <div className={`topbar-brand ${logoCompact ? "topbar-brand--compact" : ""} ${logoReady ? "" : "no-transition"}`}>
          <svg className={`brand-logo ${logoCompact ? "brand-logo--compact" : ""} ${logoReady ? "" : "no-transition"}`} viewBox="0 0 3665 1024" preserveAspectRatio="xMinYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Piamaps">
            <path id="logo-left" d="M0 868.451V766.607H107.413V868.451C107.413 881.218 112.484 893.461 121.512 902.488C130.539 911.516 142.782 916.587 155.549 916.587H257.393V1024H155.549C114.295 1024 74.7305 1007.61 45.5594 978.441C16.3884 949.27 9.64574e-05 909.705 0 868.451ZM512 281.418C544.98 262.675 582.757 253.231 621.237 254.577C674.595 256.443 725.156 278.906 762.308 317.251C799.459 355.595 820.312 406.842 820.491 460.232C820.669 513.586 800.186 564.936 763.338 603.52L763.339 603.521L587.812 787.858C578.043 798.122 566.289 806.294 553.266 811.88C540.235 817.469 526.204 820.351 512.026 820.351C497.847 820.351 483.817 817.469 470.786 811.88C457.764 806.295 446.012 798.125 436.244 787.862L260.667 603.527V603.526C223.816 564.941 203.331 513.589 203.509 460.232C203.688 406.842 224.541 355.595 261.692 317.251C298.844 278.906 349.405 256.443 402.763 254.577C441.243 253.231 479.02 262.675 512 281.418ZM617.484 361.924C591.884 361.029 566.933 370.086 547.867 387.192L512 419.374L476.133 387.192C457.067 370.086 432.116 361.029 406.516 361.924C380.917 362.82 356.66 373.597 338.836 391.993C321.012 410.39 311.006 434.976 310.921 460.591C310.836 485.806 320.371 510.087 337.552 528.501L338.376 529.374L338.41 529.409L338.444 529.445L512.026 711.684L685.55 529.451L685.587 529.413L685.624 529.374C703.324 510.859 713.165 486.206 713.079 460.591C712.994 434.976 702.989 410.39 685.164 391.993C667.34 373.597 643.083 362.82 617.484 361.924ZM0 155.549C0.000103697 114.295 16.3884 74.7305 45.5594 45.5594C74.7305 16.3884 114.295 0.000103692 155.549 0H257.393V107.413H155.549C142.782 107.413 130.539 112.484 121.512 121.512C112.484 130.539 107.413 142.782 107.413 155.549V257.393H0V155.549Z" fill="#3C7B5F"/>
            <path id="logo-right" d="M149.98 868.451V766.607H257.393V868.451C257.393 909.705 241.004 949.27 211.833 978.441C182.662 1007.61 143.098 1024 101.844 1024H0V916.587H101.844C114.61 916.587 126.854 911.516 135.881 902.488C144.908 893.461 149.98 881.218 149.98 868.451ZM149.98 155.549C149.98 142.782 144.908 130.539 135.881 121.512C126.854 112.484 114.611 107.413 101.844 107.413H0V0H101.844C143.098 9.64625e-05 182.662 16.3884 211.833 45.5594C241.004 74.7305 257.393 114.295 257.393 155.549V257.393H149.98V155.549Z" fill="#3C7B5F"/>
            <g id="logo-text" clipPath="url(#logo-text-clip)">
              <path d="M375.7 401.7C375.7 425.967 369.85 448.717 358.15 469.95C346.883 491.183 328.9 508.3 304.2 521.3C279.933 534.3 249.167 540.8 211.9 540.8H135.85V715H44.85V261.3H211.9C247 261.3 276.9 267.367 301.6 279.5C326.3 291.633 344.717 308.317 356.85 329.55C369.417 350.783 375.7 374.833 375.7 401.7ZM208 467.35C233.133 467.35 251.767 461.717 263.9 450.45C276.033 438.75 282.1 422.5 282.1 401.7C282.1 357.5 257.4 335.4 208 335.4H135.85V467.35H208ZM434.459 312C418.426 312 404.992 307.017 394.159 297.05C383.759 286.65 378.559 273.867 378.559 258.7C378.559 243.533 383.759 230.967 394.159 221C404.992 210.6 418.426 205.4 434.459 205.4C450.492 205.4 463.709 210.6 474.109 221C484.942 230.967 490.359 243.533 490.359 258.7C490.359 273.867 484.942 286.65 474.109 297.05C463.709 307.017 450.492 312 434.459 312ZM479.309 354.9V715H388.309V354.9H479.309ZM493.817 533.65C493.817 497.25 500.967 464.967 515.267 436.8C530.001 408.633 549.717 386.967 574.417 371.8C599.551 356.633 627.501 349.05 658.267 349.05C685.134 349.05 708.534 354.467 728.467 365.3C748.834 376.133 765.084 389.783 777.217 406.25V354.9H868.867V715H777.217V662.35C765.517 679.25 749.267 693.333 728.467 704.6C708.101 715.433 684.484 720.85 657.617 720.85C627.284 720.85 599.551 713.05 574.417 697.45C549.717 681.85 530.001 659.967 515.267 631.8C500.967 603.2 493.817 570.483 493.817 533.65ZM777.217 534.95C777.217 512.85 772.884 494 764.217 478.4C755.551 462.367 743.851 450.233 729.117 442C714.384 433.333 698.567 429 681.667 429C664.767 429 649.167 433.117 634.867 441.35C620.567 449.583 608.867 461.717 599.767 477.75C591.101 493.35 586.767 511.983 586.767 533.65C586.767 555.317 591.101 574.383 599.767 590.85C608.867 606.883 620.567 619.233 634.867 627.9C649.601 636.567 665.201 640.9 681.667 640.9C698.567 640.9 714.384 636.783 729.117 628.55C743.851 619.883 755.551 607.75 764.217 592.15C772.884 576.117 777.217 557.05 777.217 534.95ZM1352.94 349.7C1397.14 349.7 1432.68 363.35 1459.54 390.65C1486.84 417.517 1500.49 455.217 1500.49 503.75V715H1409.49V516.1C1409.49 487.933 1402.34 466.483 1388.04 451.75C1373.74 436.583 1354.24 429 1329.54 429C1304.84 429 1285.13 436.583 1270.39 451.75C1256.09 466.483 1248.94 487.933 1248.94 516.1V715H1157.94V516.1C1157.94 487.933 1150.79 466.483 1136.49 451.75C1122.19 436.583 1102.69 429 1077.99 429C1052.86 429 1032.93 436.583 1018.19 451.75C1003.89 466.483 996.745 487.933 996.745 516.1V715H905.745V354.9H996.745V398.45C1008.44 383.283 1023.39 371.367 1041.59 362.7C1060.23 354.033 1080.59 349.7 1102.69 349.7C1130.86 349.7 1155.99 355.767 1178.09 367.9C1200.19 379.6 1217.31 396.5 1229.44 418.6C1241.14 397.8 1258.04 381.117 1280.14 368.55C1302.68 355.983 1326.94 349.7 1352.94 349.7ZM1511.45 533.65C1511.45 497.25 1518.6 464.967 1532.9 436.8C1547.63 408.633 1567.35 386.967 1592.05 371.8C1617.18 356.633 1645.13 349.05 1675.9 349.05C1702.76 349.05 1726.16 354.467 1746.1 365.3C1766.46 376.133 1782.71 389.783 1794.85 406.25V354.9H1886.5V715H1794.85V662.35C1783.15 679.25 1766.9 693.333 1746.1 704.6C1725.73 715.433 1702.11 720.85 1675.25 720.85C1644.91 720.85 1617.18 713.05 1592.05 697.45C1567.35 681.85 1547.63 659.967 1532.9 631.8C1518.6 603.2 1511.45 570.483 1511.45 533.65ZM1794.85 534.95C1794.85 512.85 1790.51 494 1781.85 478.4C1773.18 462.367 1761.48 450.233 1746.75 442C1732.01 433.333 1716.2 429 1699.3 429C1682.4 429 1666.8 433.117 1652.5 441.35C1638.2 449.583 1626.5 461.717 1617.4 477.75C1608.73 493.35 1604.4 511.983 1604.4 533.65C1604.4 555.317 1608.73 574.383 1617.4 590.85C1626.5 606.883 1638.2 619.233 1652.5 627.9C1667.23 636.567 1682.83 640.9 1699.3 640.9C1716.2 640.9 1732.01 636.783 1746.75 628.55C1761.48 619.883 1773.18 607.75 1781.85 592.15C1790.51 576.117 1794.85 557.05 1794.85 534.95ZM2014.38 406.9C2026.08 390.433 2042.11 376.783 2062.48 365.95C2083.28 354.683 2106.89 349.05 2133.33 349.05C2164.09 349.05 2191.83 356.633 2216.53 371.8C2241.66 386.967 2261.38 408.633 2275.68 436.8C2290.41 464.533 2297.78 496.817 2297.78 533.65C2297.78 570.483 2290.41 603.2 2275.68 631.8C2261.38 659.967 2241.66 681.85 2216.53 697.45C2191.83 713.05 2164.09 720.85 2133.33 720.85C2106.89 720.85 2083.49 715.433 2063.13 704.6C2043.19 693.767 2026.94 680.117 2014.38 663.65V886.6H1923.38V354.9H2014.38V406.9ZM2204.83 533.65C2204.83 511.983 2200.28 493.35 2191.18 477.75C2182.51 461.717 2170.81 449.583 2156.08 441.35C2141.78 433.117 2126.18 429 2109.28 429C2092.81 429 2077.21 433.333 2062.48 442C2048.18 450.233 2036.48 462.367 2027.38 478.4C2018.71 494.433 2014.38 513.283 2014.38 534.95C2014.38 556.617 2018.71 575.467 2027.38 591.5C2036.48 607.533 2048.18 619.883 2062.48 628.55C2077.21 636.783 2092.81 640.9 2109.28 640.9C2126.18 640.9 2141.78 636.567 2156.08 627.9C2170.81 619.233 2182.51 606.883 2191.18 590.85C2200.28 574.817 2204.83 555.75 2204.83 533.65ZM2449.7 720.85C2420.24 720.85 2393.8 715.65 2370.4 705.25C2347 694.417 2328.37 679.9 2314.5 661.7C2301.07 643.5 2293.7 623.35 2292.4 601.25H2384.05C2385.79 615.117 2392.5 626.6 2404.2 635.7C2416.34 644.8 2431.29 649.35 2449.05 649.35C2466.39 649.35 2479.82 645.883 2489.35 638.95C2499.32 632.017 2504.3 623.133 2504.3 612.3C2504.3 600.6 2498.24 591.933 2486.1 586.3C2474.4 580.233 2455.55 573.733 2429.55 566.8C2402.69 560.3 2380.59 553.583 2363.25 546.65C2346.35 539.717 2331.62 529.1 2319.05 514.8C2306.92 500.5 2300.85 481.217 2300.85 456.95C2300.85 437.017 2306.49 418.817 2317.75 402.35C2329.45 385.883 2345.92 372.883 2367.15 363.35C2388.82 353.817 2414.17 349.05 2443.2 349.05C2486.1 349.05 2520.34 359.883 2545.9 381.55C2571.47 402.783 2585.55 431.6 2588.15 468H2501.05C2499.75 453.7 2493.69 442.433 2482.85 434.2C2472.45 425.533 2458.37 421.2 2440.6 421.2C2424.14 421.2 2411.35 424.233 2402.25 430.3C2393.59 436.367 2389.25 444.817 2389.25 455.65C2389.25 467.783 2395.32 477.1 2407.45 483.6C2419.59 489.667 2438.44 495.95 2464 502.45C2490 508.95 2511.45 515.667 2528.35 522.6C2545.25 529.533 2559.77 540.367 2571.9 555.1C2584.47 569.4 2590.97 588.467 2591.4 612.3C2591.4 633.1 2585.55 651.733 2573.85 668.2C2562.59 684.667 2546.12 697.667 2524.45 707.2C2503.22 716.3 2478.3 720.85 2449.7 720.85Z" fill="#3C7B5F"/>
            </g>
            <defs>
              <clipPath id="logo-text-clip">
                <rect width="2622" height="975" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </div>

        <div className="search-group">
          <div className="search-field search-field--profession">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={logoCompact ? "Profession" : "Profession ou spécialité"}
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
              placeholder={logoCompact ? "Ville" : "Ville ou code postal"}
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

      <aside className={`results-panel ${panelHidden ? "hidden" : ""} ${logoReady ? "" : "no-transition"}`}>
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
              <div className="result-item__name">{displayName(p)}</div>
              <div className="result-item__profession">{p.profession_label}</div>
              <div className="result-item__address">{p.city}</div>
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
            <div className="drawer-profession">{activePractitioner.profession_label}</div>
            <h2 className="drawer-name">{displayName(activePractitioner)}</h2>

            {diplomas.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Diplômes</div>
                <div className="drawer-specialties">
                  {diplomas.map((d: string) => (
                    <span key={d} className="drawer-tag">{d}</span>
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

            {links.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-profiles">
                  {links.map((link: string) => {
                    const platform = getPlatformInfo(link);
                    return (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="drawer-profile-btn"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={platform.logo}
                          alt={platform.label}
                          className="drawer-profile-logo"
                        />
                        <span className="drawer-profile-label">Profil {platform.label}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="drawer-profile-icon">
                          <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </a>
                    );
                  })}
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
              <div className="result-item__name">{displayName(p)}</div>
              <div className="result-item__profession">{p.profession_label}</div>
              <div className="result-item__address">{p.city}</div>
              {p.distance != null && <div className="result-item__distance">{p.distance.toFixed(1)} km</div>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
