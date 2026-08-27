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
  const [logoCompact, setLogoCompact] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    setLogoCompact(mql.matches);
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
          <svg className={`brand-logo ${logoCompact ? "brand-logo--compact" : ""}`} viewBox="0 0 4087 1024" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Piana Care">
            <g id="logo-left">
              <path d="M0 868.451V766.607H107.413V868.451C107.413 881.218 112.484 893.461 121.512 902.488C130.539 911.516 142.782 916.587 155.549 916.587H257.393V1024H155.549C114.295 1024 74.7305 1007.61 45.5594 978.441C16.3884 949.27 9.64574e-05 909.705 0 868.451ZM512 281.418C544.98 262.675 582.757 253.231 621.237 254.577C674.595 256.443 725.156 278.906 762.308 317.251C799.459 355.595 820.312 406.842 820.491 460.232C820.669 513.586 800.186 564.936 763.338 603.52L763.339 603.521L587.812 787.858C578.043 798.122 566.289 806.294 553.266 811.88C540.235 817.469 526.204 820.351 512.026 820.351C497.847 820.351 483.817 817.469 470.786 811.88C457.764 806.295 446.012 798.125 436.244 787.862L260.667 603.527V603.526C223.816 564.941 203.331 513.589 203.509 460.232C203.688 406.842 224.541 355.595 261.692 317.251C298.844 278.906 349.405 256.443 402.763 254.577C441.243 253.231 479.02 262.675 512 281.418ZM617.484 361.924C591.884 361.029 566.933 370.086 547.867 387.192L512 419.374L476.133 387.192C457.067 370.086 432.116 361.029 406.516 361.924C380.917 362.82 356.66 373.597 338.836 391.993C321.012 410.39 311.006 434.976 310.921 460.591C310.836 485.806 320.371 510.087 337.552 528.501L338.376 529.374L338.41 529.409L338.444 529.445L512.026 711.684L685.55 529.451L685.587 529.413L685.624 529.374C703.324 510.859 713.165 486.206 713.079 460.591C712.994 434.976 702.989 410.39 685.164 391.993C667.34 373.597 643.083 362.82 617.484 361.924ZM0 155.549C0.000103697 114.295 16.3884 74.7305 45.5594 45.5594C74.7305 16.3884 114.295 0.000103692 155.549 0H257.393V107.413H155.549C142.782 107.413 130.539 112.484 121.512 121.512C112.484 130.539 107.413 142.782 107.413 155.549V257.393H0V155.549Z" fill="#3C7B5F"/>
            </g>
            <g id="logo-right">
              <path d="M3979.59 868.451V766.607H4087V868.451C4087 909.705 4070.61 949.27 4041.44 978.441C4012.27 1007.61 3972.71 1024 3931.45 1024H3829.61V916.587H3931.45C3944.22 916.587 3956.46 911.516 3965.49 902.488C3974.52 893.461 3979.59 881.218 3979.59 868.451ZM3979.59 155.549C3979.59 142.782 3974.52 130.539 3965.49 121.512C3956.46 112.484 3944.22 107.413 3931.45 107.413H3829.61V0H3931.45C3972.71 9.64625e-05 4012.27 16.3884 4041.44 45.5594C4070.61 74.7305 4087 114.295 4087 155.549V257.393H3979.59V155.549Z" fill="#3C7B5F"/>
            </g>
            <g clip-path="url(#logo-text-clip)">
              <path id="logo-text" transform="translate(938 62)" d="M346.8 370.8C346.8 393.2 341.4 414.2 330.6 433.8C320.2 453.4 303.6 469.2 280.8 481.2C258.4 493.2 230 499.2 195.6 499.2H125.4V660H41.4V241.2H195.6C228 241.2 255.6 246.8 278.4 258C301.2 269.2 318.2 284.6 329.4 304.2C341 323.8 346.8 346 346.8 370.8ZM192 431.4C215.2 431.4 232.4 426.2 243.6 415.8C254.8 405 260.4 390 260.4 370.8C260.4 330 237.6 309.6 192 309.6H125.4V431.4H192ZM401.039 288C386.239 288 373.839 283.4 363.839 274.2C354.239 264.6 349.439 252.8 349.439 238.8C349.439 224.8 354.239 213.2 363.839 204C373.839 194.4 386.239 189.6 401.039 189.6C415.839 189.6 428.039 194.4 437.639 204C447.639 213.2 452.639 224.8 452.639 238.8C452.639 252.8 447.639 264.6 437.639 274.2C428.039 283.4 415.839 288 401.039 288ZM442.439 327.6V660H358.439V327.6H442.439ZM455.831 492.6C455.831 459 462.431 429.2 475.631 403.2C489.231 377.2 507.431 357.2 530.231 343.2C553.431 329.2 579.231 322.2 607.631 322.2C632.431 322.2 654.031 327.2 672.431 337.2C691.231 347.2 706.231 359.8 717.431 375V327.6H802.031V660H717.431V611.4C706.631 627 691.631 640 672.431 650.4C653.631 660.4 631.831 665.4 607.031 665.4C579.031 665.4 553.431 658.2 530.231 643.8C507.431 629.4 489.231 609.2 475.631 583.2C462.431 556.8 455.831 526.6 455.831 492.6ZM717.431 493.8C717.431 473.4 713.431 456 705.431 441.6C697.431 426.8 686.631 415.6 673.031 408C659.431 400 644.831 396 629.231 396C613.631 396 599.231 399.8 586.031 407.4C572.831 415 562.031 426.2 553.631 441C545.631 455.4 541.631 472.6 541.631 492.6C541.631 512.6 545.631 530.2 553.631 545.4C562.031 560.2 572.831 571.6 586.031 579.6C599.631 587.6 614.031 591.6 629.231 591.6C644.831 591.6 659.431 587.8 673.031 580.2C686.631 572.2 697.431 561 705.431 546.6C713.431 531.8 717.431 514.2 717.431 493.8ZM1020.27 322.8C1059.87 322.8 1091.87 335.4 1116.27 360.6C1140.67 385.4 1152.87 420.2 1152.87 465V660H1068.87V476.4C1068.87 450 1062.27 429.8 1049.07 415.8C1035.87 401.4 1017.87 394.2 995.072 394.2C971.872 394.2 953.472 401.4 939.872 415.8C926.672 429.8 920.072 450 920.072 476.4V660H836.072V327.6H920.072V369C931.272 354.6 945.472 343.4 962.672 335.4C980.272 327 999.472 322.8 1020.27 322.8ZM1163.15 492.6C1163.15 459 1169.75 429.2 1182.95 403.2C1196.55 377.2 1214.75 357.2 1237.55 343.2C1260.75 329.2 1286.55 322.2 1314.95 322.2C1339.75 322.2 1361.35 327.2 1379.75 337.2C1398.55 347.2 1413.55 359.8 1424.75 375V327.6H1509.35V660H1424.75V611.4C1413.95 627 1398.95 640 1379.75 650.4C1360.95 660.4 1339.15 665.4 1314.35 665.4C1286.35 665.4 1260.75 658.2 1237.55 643.8C1214.75 629.4 1196.55 609.2 1182.95 583.2C1169.75 556.8 1163.15 526.6 1163.15 492.6ZM1424.75 493.8C1424.75 473.4 1420.75 456 1412.75 441.6C1404.75 426.8 1393.95 415.6 1380.35 408C1366.75 400 1352.15 396 1336.55 396C1320.95 396 1306.55 399.8 1293.35 407.4C1280.15 415 1269.35 426.2 1260.95 441C1252.95 455.4 1248.95 472.6 1248.95 492.6C1248.95 512.6 1252.95 530.2 1260.95 545.4C1269.35 560.2 1280.15 571.6 1293.35 579.6C1306.95 587.6 1321.35 591.6 1336.55 591.6C1352.15 591.6 1366.75 587.8 1380.35 580.2C1393.95 572.2 1404.75 561 1412.75 546.6C1420.75 531.8 1424.75 514.2 1424.75 493.8ZM1617.96 450C1617.96 408.8 1627.16 372 1645.56 339.6C1664.36 306.8 1689.76 281.4 1721.76 263.4C1754.16 245 1790.36 235.8 1830.36 235.8C1877.16 235.8 1918.16 247.8 1953.36 271.8C1988.56 295.8 2013.16 329 2027.16 371.4H1930.56C1920.96 351.4 1907.36 336.4 1889.76 326.4C1872.56 316.4 1852.56 311.4 1829.76 311.4C1805.36 311.4 1783.56 317.2 1764.36 328.8C1745.56 340 1730.76 356 1719.96 376.8C1709.56 397.6 1704.36 422 1704.36 450C1704.36 477.6 1709.56 502 1719.96 523.2C1730.76 544 1745.56 560.2 1764.36 571.8C1783.56 583 1805.36 588.6 1829.76 588.6C1852.56 588.6 1872.56 583.6 1889.76 573.6C1907.36 563.2 1920.96 548 1930.56 528H2027.16C2013.16 570.8 1988.56 604.2 1953.36 628.2C1918.56 651.8 1877.56 663.6 1830.36 663.6C1790.36 663.6 1754.16 654.6 1721.76 636.6C1689.76 618.2 1664.36 592.8 1645.56 560.4C1627.16 528 1617.96 491.2 1617.96 450ZM2029.31 492.6C2029.31 459 2035.91 429.2 2049.11 403.2C2062.71 377.2 2080.91 357.2 2103.71 343.2C2126.91 329.2 2152.71 322.2 2181.11 322.2C2205.91 322.2 2227.51 327.2 2245.91 337.2C2264.71 347.2 2279.71 359.8 2290.91 375V327.6H2375.51V660H2290.91V611.4C2280.11 627 2265.11 640 2245.91 650.4C2227.11 660.4 2205.31 665.4 2180.51 665.4C2152.51 665.4 2126.91 658.2 2103.71 643.8C2080.91 629.4 2062.71 609.2 2049.11 583.2C2035.91 556.8 2029.31 526.6 2029.31 492.6ZM2290.91 493.8C2290.91 473.4 2286.91 456 2278.91 441.6C2270.91 426.8 2260.11 415.6 2246.51 408C2232.91 400 2218.31 396 2202.71 396C2187.11 396 2172.71 399.8 2159.51 407.4C2146.31 415 2135.51 426.2 2127.11 441C2119.11 455.4 2115.11 472.6 2115.11 492.6C2115.11 512.6 2119.11 530.2 2127.11 545.4C2135.51 560.2 2146.31 571.6 2159.51 579.6C2173.11 587.6 2187.51 591.6 2202.71 591.6C2218.31 591.6 2232.91 587.8 2246.51 580.2C2260.11 572.2 2270.91 561 2278.91 546.6C2286.91 531.8 2290.91 514.2 2290.91 493.8ZM2493.55 379.2C2504.35 361.6 2518.35 347.8 2535.55 337.8C2553.15 327.8 2573.15 322.8 2595.55 322.8V411H2573.35C2546.95 411 2526.95 417.2 2513.35 429.6C2500.15 442 2493.55 463.6 2493.55 494.4V660H2409.55V327.6H2493.55V379.2ZM2913.13 486.6C2913.13 498.6 2912.33 509.4 2910.73 519H2667.73C2669.73 543 2678.13 561.8 2692.93 575.4C2707.73 589 2725.93 595.8 2747.53 595.8C2778.73 595.8 2800.93 582.4 2814.13 555.6H2904.73C2895.13 587.6 2876.73 614 2849.53 634.8C2822.33 655.2 2788.93 665.4 2749.33 665.4C2717.33 665.4 2688.53 658.4 2662.93 644.4C2637.73 630 2617.93 609.8 2603.53 583.8C2589.53 557.8 2582.53 527.8 2582.53 493.8C2582.53 459.4 2589.53 429.2 2603.53 403.2C2617.53 377.2 2637.13 357.2 2662.33 343.2C2687.53 329.2 2716.53 322.2 2749.33 322.2C2780.93 322.2 2809.13 329 2833.93 342.6C2859.13 356.2 2878.53 375.6 2892.13 400.8C2906.13 425.6 2913.13 454.2 2913.13 486.6ZM2826.13 462.6C2825.73 441 2817.93 423.8 2802.73 411C2787.53 397.8 2768.93 391.2 2746.93 391.2C2726.13 391.2 2708.53 397.6 2694.13 410.4C2680.13 422.8 2671.53 440.2 2668.33 462.6H2826.13Z" fill="#3C7B5F"/>
            </g>
            <defs>
              <clipPath id="logo-text-clip">
                <rect x="938" y="62" width="2934" height="900" fill="white"/>
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
