import supabase from "./auth.js";
import { Heap } from "heap-js";


// ============================================================
// CONSTANTS
// ============================================================
const ICCT_POSITION     = [14.61768, 121.10261];
const MAX_DISTANCE      = 15000;
const ICCT_WALK_RADIUS  = 1000;
const TRANSFER_LIMIT    = 500;
const WALK_SPEED        = 1.4;
const JEEPNEY_SPEED     = 8;
const TRANSFER_PENALTY  = 600;
const DEBOUNCE_MS       = 8000;
const GEO_CACHE_LIMIT   = 1000;
const STOP_FETCH_LIMIT  = 2000;
const CANDIDATE_RADIUS  = 2000;
const END_STOP_RADIUS   = 1500;
const MOVE_THRESHOLD    = 50;    // meters — minimum movement to trigger recalculate
const PASSED_THRESHOLD  = 80;    // meters — how close to a stop before it's "passed"


// Graph cache: rebuild after 6 hours
const GRAPH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GRAPH_CACHE_KEY    = "jeepney_graph_v2";

const API_KEY = import.meta.env.VITE_GEOAPIFY_KEY;


// ============================================================
// STATE
// ============================================================
let stops                 = [];
let stopById              = {};
let graph                 = null;
let stopRoutes            = {};
let routeEndpoints        = {};
let routeNames            = {};
let userMarker            = null;
let jeepneyRouteLayers    = [];
let walkingRouteLayer     = null;
let endWalkingRouteLayer  = null;
let transferWalkingLayers = [];
let watchId               = null;
let locationMode          = "idle";
let lastUserPos           = null;
let lastRun               = 0;
let lastCoords            = null;
let selectedJeepneyType   = "traditional";
let globalActivePathData  = null;
let lastAnnouncedStop     = null;
let lastTransferAnnouncement = null;
let followUser            = false;
let arrivalAnnounced      = false;
let _lastRedrawLength     = -1;
const LOCKED_TRACKING_INTERVAL_MS = 3000;
let _lastLockedTick       = 0;
let _toastTimer           = null;

// Route lock state
let routeLocked           = false;
let lockedPathData        = null;
let remainingPath         = null;

const geoCache = new Map();


// ============================================================
// MAP SETUP
// ============================================================
const map = L.map("map", {
    attributionControl: false,
}).setView(ICCT_POSITION, 15);

map.on("dragstart", () => {
    if (routeLocked) {
        followUser = false;
    }
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
}).addTo(map);

L.marker(ICCT_POSITION)
    .addTo(map)
    .bindPopup("ICCT Cainta");

L.circle(ICCT_POSITION, {
    color:       "#17a",
    fillColor:   "blue",
    fillOpacity: 0.1,
    radius:      MAX_DISTANCE,
}).addTo(map);

// ============= MAP LEGEND ===============
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'map-legend');

    div.innerHTML = `
        <h4>Biyahero Legend</h4>
        <div class="legend-item">
            <span class="legend-line line-jeepney"></span>
            <span>Jeepney Route</span>
        </div>
        <div class="legend-item">
            <span class="legend-line line-walk-start"></span>
            <span>Walk to Ride</span>
        </div>
        <div class="legend-item">
            <span class="legend-line line-transfer"></span>
            <span>Transfer Point Walk</span>
        </div>
        <div class="legend-item">
            <span class="legend-line line-walk-end"></span>
            <span>Walk to Campus Gate</span>
        </div>
    `;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
};

legend.addTo(map);

window.toggleMapLegend = function () {
    const legendEl = document.querySelector(".map-legend");
    if (legendEl) {
        legendEl.classList.toggle("hidden");
    }
};

const legendToggle = L.control({ position: 'bottomright' });

legendToggle.onAdd = function (map) {
    const button = L.DomUtil.create('button', 'legend-toggle-btn');
    button.id = 'toggleLegendBtn';
    button.textContent = 'Legend';

    L.DomEvent.on(button, 'click', function (e) {
        L.DomEvent.stopPropagation(e);
        window.toggleMapLegend();
    });

    return button;
};

legendToggle.addTo(map);


// ============================================================
// MAP CLEANUP
// ============================================================
function clearMapRoutes() {
    jeepneyRouteLayers.forEach(layer => map.removeLayer(layer));
    jeepneyRouteLayers = [];

    if (walkingRouteLayer) {
        map.removeLayer(walkingRouteLayer);
        walkingRouteLayer = null;
    }

    if (endWalkingRouteLayer) {
        map.removeLayer(endWalkingRouteLayer);
        endWalkingRouteLayer = null;
    }

    transferWalkingLayers.forEach(layer => map.removeLayer(layer));
    transferWalkingLayers = [];
}


// ============================================================
// DATA LOADING
// ============================================================
async function loadRouteNames() {
    if (Object.keys(routeNames).length > 0) return routeNames;

    const { data, error } = await supabase
        .from("routes")
        .select("id, route_name");

    if (error) {
        console.error("Error loading routes:", error.message);
        return {};
    }

    routeNames = {};
    (data || []).forEach(r => {
        routeNames[String(r.id)] = r.route_name;
    });

    return routeNames;
}

async function loadStops() {
    const { data, error } = await supabase
        .from("stops")
        .select("*")
        .range(0, STOP_FETCH_LIMIT);

    if (error) return [];

    stops = (data || []).map(s => ({
        id:   String(s.id),
        name: s.stop_name,
        lat:  Number(s.lat),
        lng:  Number(s.lng),
    }));

    stopById = Object.fromEntries(stops.map(stop => [stop.id, stop]));
    return stops;
}


// ============================================================
// GRAPH BUILDER
// ============================================================
async function buildGraph() {
    if (graph) return graph;

    // ── Try loading from cache ──────────────────────────────
    try {
        const cached = localStorage.getItem(GRAPH_CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < GRAPH_CACHE_TTL_MS) {
                graph          = data.graph;
                stopRoutes     = data.stopRoutes;
                routeEndpoints = data.routeEndpoints;
                routeNames     = data.routeNames || {};

                for (const id in stopRoutes) stopRoutes[id] = new Set(stopRoutes[id]);

                if (!stops.length) await loadStops();
                if (Object.keys(routeNames).length === 0) await loadRouteNames();

                return graph;
            }
        }
    } catch {
        localStorage.removeItem(GRAPH_CACHE_KEY);
    }

    // ── Build fresh ─────────────────────────────────────────
    await loadStops();
    await loadRouteNames();

    const { data: routeStops, error } = await supabase
        .from("route_stops")
        .select("*")
        .order("route_id",   { ascending: true })
        .order("stop_order", { ascending: true });

    if (error) return {};

    const g = {};
    stopRoutes = {};

    for (const rs of routeStops) {
        const stopId = String(rs.stop_id);
        if (!stopRoutes[stopId]) stopRoutes[stopId] = new Set();
        stopRoutes[stopId].add(String(rs.route_id));
    }

    const grouped = {};
    for (const rs of routeStops) {
        const routeId = String(rs.route_id);
        if (!grouped[routeId]) grouped[routeId] = [];
        grouped[routeId].push(rs);
    }

    routeEndpoints = {};
    for (const routeId in grouped) {
        const sorted = grouped[routeId].sort((a, b) => a.stop_order - b.stop_order);
        const last = sorted[sorted.length - 1];
        if (last) routeEndpoints[routeId] = String(last.stop_id);
    }

    const addNode = id => { id = String(id); if (!g[id]) g[id] = []; };
    const addEdge = (from, to, weight, type, routeId = null) => {
        from = String(from); to = String(to);
        addNode(from); addNode(to);
        g[from].push({ to, weight, type, routeId });
    };

    for (const routeId in grouped) {
        const list = grouped[routeId].sort((a, b) => a.stop_order - b.stop_order);
        for (let i = 0; i < list.length - 1; i++) {
            const fromStop = stopById[String(list[i].stop_id)];
            const toStop   = stopById[String(list[i + 1].stop_id)];
            if (!fromStop || !toStop) continue;

            const distance   = map.distance([fromStop.lat, fromStop.lng], [toStop.lat, toStop.lng]);
            const travelTime = distance / JEEPNEY_SPEED;
            addEdge(list[i].stop_id,     list[i + 1].stop_id, travelTime, "jeepney", routeId);
            addEdge(list[i + 1].stop_id, list[i].stop_id,     travelTime, "jeepney", routeId);
        }
    }

    // ── FIX #3: O(n) grid-bucket transfer detection (was O(n²)) ──────────
    const BUCKET_SIZE = 0.005; // ~500 m in degrees
    const bucket      = val => Math.floor(val / BUCKET_SIZE);
    const bucketMap   = {};

    for (const stop of stops) {
        const key = `${bucket(stop.lat)},${bucket(stop.lng)}`;
        if (!bucketMap[key]) bucketMap[key] = [];
        bucketMap[key].push(stop);
    }

    const checked = new Set();

    for (const stop of stops) {
        const bLat = bucket(stop.lat);
        const bLng = bucket(stop.lng);

        // Compare only same + adjacent buckets (3×3 grid)
        for (let dLat = -1; dLat <= 1; dLat++) {
            for (let dLng = -1; dLng <= 1; dLng++) {
                const key       = `${bLat + dLat},${bLng + dLng}`;
                const neighbors = bucketMap[key] || [];

                for (const other of neighbors) {
                    if (other.id === stop.id) continue;

                    const pairKey = stop.id < other.id
                        ? `${stop.id}-${other.id}`
                        : `${other.id}-${stop.id}`;
                    if (checked.has(pairKey)) continue;
                    checked.add(pairKey);

                    const routesA = stopRoutes[String(stop.id)]  || new Set();
                    const routesB = stopRoutes[String(other.id)] || new Set();
                    if ([...routesA].some(r => routesB.has(r))) continue;

                    const distance = map.distance(
                        [stop.lat,  stop.lng],
                        [other.lat, other.lng]
                    );
                    if (distance <= TRANSFER_LIMIT) {
                        const w = TRANSFER_PENALTY + distance / WALK_SPEED;
                        addEdge(stop.id,  other.id, w, "transfer");
                        addEdge(other.id, stop.id,  w, "transfer");
                    }
                }
            }
        }
    }

    graph = g;

    // ── Persist to localStorage ─────────────────────────────
    try {
        const stopRoutesSerializable = {};
        for (const id in stopRoutes) stopRoutesSerializable[id] = [...stopRoutes[id]];

        localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: { graph, stopRoutes: stopRoutesSerializable, routeEndpoints, routeNames },
        }));
    } catch {
        // Storage quota exceeded — silently skip
    }

    return graph;
}


// ============================================================
// TRANSFER DETECTION
// ============================================================
function detectTransfers(path) {
    const transfers = [];

    for (let i = 0; i < path.length - 1; i++) {
        const currentRoutes = stopRoutes[path[i]]     || new Set();
        const nextRoutes    = stopRoutes[path[i + 1]] || new Set();
        const sameRoute     = [...currentRoutes].some(r => nextRoutes.has(r));

        if (!sameRoute) transfers.push({ from: path[i], to: path[i + 1] });
    }

    return transfers;
}


// ============================================================
// ROUTING API (with cache)
// ============================================================
async function getRoute(lat1, lng1, lat2, lng2) {
    const key = `${lat1.toFixed(4)},${lng1.toFixed(4)}-${lat2.toFixed(4)},${lng2.toFixed(4)}`;

    if (geoCache.has(key)) return geoCache.get(key);
    if (geoCache.size > GEO_CACHE_LIMIT) geoCache.clear();

    const url = `https://api.geoapify.com/v1/routing?waypoints=${lat1},${lng1}|${lat2},${lng2}&mode=walk&apiKey=${API_KEY}`;

    const promise = fetch(url)
        .then(res => res.json())
        .then(data => {
            geoCache.set(key, data);
            return data;
        })
        .catch(() => {
            geoCache.delete(key);
            return null;
        });

    geoCache.set(key, promise);
    return promise;
}


// ============================================================
// NEAREST STOP
// ============================================================
async function getNearestStop(lat, lng) {
    const candidates = stops.filter(stop =>
        map.distance([lat, lng], [stop.lat, stop.lng]) <= CANDIDATE_RADIUS
    );

    const results = await Promise.all(
        candidates.map(async stop => {
            const data = await getRoute(lat, lng, stop.lat, stop.lng);
            if (!data?.features?.length) return null;
            return { ...stop, walkTime: data.features[0].properties.time };
        })
    );

    return results.filter(Boolean).sort((a, b) => a.walkTime - b.walkTime)[0];
}


// ============================================================
// DIJKSTRA
// ============================================================
function dijkstra(graph, start) {
    start = String(start);

    const distances = {};
    const previous  = {};
    const visited   = new Set();

    const heuristic = (a) => {
        const stopA = stopById[a];
        if (!stopA) return 0;
        return map.distance([stopA.lat, stopA.lng], ICCT_POSITION) / JEEPNEY_SPEED;
    };

    const pq = new Heap((a, b) => a.priority - b.priority);

    for (const node in graph) distances[node] = Infinity;

    distances[start] = 0;
    pq.push({ node: start, dist: 0, priority: 0 });

    while (pq.size()) {
        const { node, dist } = pq.pop();

        if (visited.has(node)) continue;
        visited.add(node);

        for (const edge of graph[node] || []) {
            const newDist = dist + edge.weight;

            if (newDist < distances[edge.to]) {
                distances[edge.to] = newDist;
                previous[edge.to]  = node;

                pq.push({
                    node:     edge.to,
                    dist:     newDist,
                    priority: newDist + heuristic(edge.to),
                });
            }
        }
    }

    return { distances, previous };
}


// ============================================================
// PATH BUILDER
// ============================================================
function buildPath(previous, start, goal) {
    start = String(start);
    goal  = String(goal);

    const path = [];
    let current = goal;

    while (current && current !== start) {
        path.unshift(current);
        current = previous[current];
    }

    if (current === start) path.unshift(start);
    return path;
}


// ============================================================
// USER MARKER
// ============================================================
function updateUserMarker(lat, lng) {
    if (!userMarker) {
        userMarker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup("You are here");
    } else {
        userMarker.setLatLng([lat, lng]);
    }

    if (routeLocked && followUser) {
        const point = map.project([lat, lng], map.getZoom());
        point.y -= 150;
        map.panTo(map.unproject(point, map.getZoom()), { animate: true });
    }
}


// ============================================================
// TOAST + ANNOUNCE  (FIX #4)
// ============================================================
function showToast(message, durationMs = 4000) {
    const toast = document.getElementById("announcementToast");
    if (!toast) return;
    toast.textContent    = message;
    toast.style.display  = "block";
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { toast.style.display = "none"; }, durationMs);
}

function announce(text) {
    showToast(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}


// ============================================================
// DRAW ROUTES
// ============================================================
async function drawWalkingRoute(startLat, startLng, endLat, endLng, type = "start") {
    const data = await getRoute(startLat, startLng, endLat, endLng);
    if (!data?.features?.length) return;

    const latlngs = data.features[0].geometry.coordinates[0].map(c => [c[1], c[0]]);

    const layer = L.polyline(latlngs, {
        color:     type === "start" ? "green" : "orange",
        weight:    5,
        dashArray: "10,10",
    }).addTo(map);

    if (type === "start") {
        walkingRouteLayer = layer;
    } else {
        endWalkingRouteLayer = layer;
    }
}

async function drawTransferRoute(startLat, startLng, endLat, endLng) {
    const data = await getRoute(startLat, startLng, endLat, endLng);
    if (!data?.features?.length) return;

    const latlngs = data.features[0].geometry.coordinates[0].map(c => [c[1], c[0]]);

    const layer = L.polyline(latlngs, {
        color:     "yellow",
        weight:    4,
        dashArray: "5,10",
    }).addTo(map);

    transferWalkingLayers.push(layer);
}

function drawJeepneySegments(path, transfers) {
    const transferPairs = new Set(transfers.map(t => `${t.from}-${t.to}`));

    const segments = [];
    let currentSegment = [];

    for (let i = 0; i < path.length; i++) {
        const stopData = stopById[path[i]];
        if (!stopData) continue;

        currentSegment.push([stopData.lat, stopData.lng]);

        if (i < path.length - 1 && transferPairs.has(`${path[i]}-${path[i + 1]}`)) {
            segments.push(currentSegment);
            currentSegment = [];
        }
    }

    if (currentSegment.length > 0) segments.push(currentSegment);

    segments.forEach(seg => {
        if (seg.length < 2) return;
        const layer = L.polyline(seg, { color: "#0066ff", weight: 6 }).addTo(map);
        jeepneyRouteLayers.push(layer);
    });
}


// ============================================================
// FARE CALCULATORS
// ============================================================
function calculateTraditionalFare(distanceInMeters, isDiscounted = false) {
    const distanceKm     = distanceInMeters / 1000;
    const baseKm         = 4;
    const baseFare       = isDiscounted ? 11.20 : 14.00;
    const succeedingRate = isDiscounted ?  1.60 :  2.00;

    if (distanceKm <= baseKm) return baseFare;
    return Math.round((baseFare + Math.ceil(distanceKm - baseKm) * succeedingRate) * 100) / 100;
}

function calculateModernFare(distanceInMeters, isDiscounted = false) {
    const distanceKm     = distanceInMeters / 1000;
    const baseKm         = 4;
    const baseFare       = isDiscounted ? 13.60 : 17.00;
    const succeedingRate = isDiscounted ?  1.60 :  2.00; // ← fixed: was 2.40/1.96
    
    if (distanceKm <= baseKm) return baseFare;
    return Math.round((baseFare + Math.ceil(distanceKm - baseKm) * succeedingRate) * 100) / 100;
}


// ============================================================
// ETA CALCULATOR  (FIX #5)
// ============================================================
function calcETAMinutes(displayPath) {
    let totalSeconds = 0;
    for (let i = 0; i < displayPath.length - 1; i++) {
        const edge = (graph[displayPath[i]] || [])
            .find(e => String(e.to) === String(displayPath[i + 1]));
        if (edge) totalSeconds += edge.weight;
    }
    return Math.round(totalSeconds / 60);
}


// ============================================================
// ROUTE LOCK
// ============================================================
window.lockRoute = function () {
    if (!globalActivePathData) return;

    routeLocked      = true;
    followUser       = true;
    arrivalAnnounced = false;

    lockedPathData = { ...globalActivePathData };
    remainingPath  = [...lockedPathData.path];

    if (userMarker) {
        map.setView(userMarker.getLatLng(), 18, { animate: true });
    }

    updateLockUI(true);
    setStatusMessage("Route locked. Navigation started.", "success");
};

window.unlockRoute = function () {
    routeLocked      = false;
    lockedPathData   = null;
    remainingPath    = null;
    followUser       = false;
    arrivalAnnounced = false;
    lastAnnouncedStop        = null;
    lastTransferAnnouncement = null;

    lastRun     = 0;
    lastUserPos = null;
    lastCoords  = null;

    updateLockUI(false);
    setStatusMessage("Route unlocked. Will recalculate on next movement.", "info");
};

function updateLockUI(locked) {
    const lockBtn       = document.getElementById("lockRouteBtn");
    const unlockBtn     = document.getElementById("unlockRouteBtn");
    const badge         = document.getElementById("routeLockBadge");
    const locationInput = document.getElementById("locationInput");
    const useLocBtn     = document.getElementById("useLocationBtn"); // adjust to your button's actual ID

    if (lockBtn)   lockBtn.style.display   = locked ? "none"         : "inline-block";
    if (unlockBtn) unlockBtn.style.display = locked ? "inline-block" : "none";
    if (badge)     badge.style.display     = locked ? "inline-block" : "none";

    // Disable search input while locked
    if (locationInput) {
        locationInput.disabled    = locked;
        locationInput.placeholder = locked
            ? "Unlock route to change location"
            : "Search for a location...";
        locationInput.style.opacity = locked ? "0.5" : "1";
        locationInput.style.cursor  = locked ? "not-allowed" : "";
    }

    // Disable "Use Current Location" button while locked
    if (useLocBtn) {
        useLocBtn.disabled            = locked;
        useLocBtn.style.opacity       = locked ? "0.5" : "1";
        useLocBtn.style.cursor        = locked ? "not-allowed" : "";
        useLocBtn.style.pointerEvents = locked ? "none" : "";
    }
}


// ============================================================
// FIX #1 — redrawLockedRoute
// Redraws traveled portion in gray and remaining portion in blue.
// Guarded by _lastRedrawLength so it only runs when the path actually shrinks.
// ============================================================
function redrawLockedRoute() {
    const currentLength = remainingPath.length;
    if (currentLength === _lastRedrawLength) return; // nothing changed
    _lastRedrawLength = currentLength;

    // Clear all existing jeepney layers
    jeepneyRouteLayers.forEach(layer => map.removeLayer(layer));
    jeepneyRouteLayers = [];

    const fullPath     = lockedPathData.path;
    const passedCount  = fullPath.length - currentLength;
    // +1 so the gray line visually connects to the start of the remaining blue line
    const passedPath   = fullPath.slice(0, passedCount + 1);

    // Draw passed portion in gray
    if (passedPath.length >= 2) {
        const passedLatLngs = passedPath
            .map(id => stopById[id])
            .filter(Boolean)
            .map(s => [s.lat, s.lng]);

        const grayLayer = L.polyline(passedLatLngs, {
            color:   "#aaaaaa",
            weight:  5,
            opacity: 0.6,
        }).addTo(map);

        jeepneyRouteLayers.push(grayLayer);
    }

    // Draw remaining portion in blue (respects transfer splits)
    if (remainingPath.length >= 2) {
        const transfers = detectTransfers(remainingPath);
        drawJeepneySegments(remainingPath, transfers);
    }
}


// ============================================================
// LOCKED ROUTE PROGRESS TRACKER
// ============================================================
function updateLockedRouteProgress(lat, lng) {
    if (!routeLocked || !remainingPath || remainingPath.length < 2) return;

    const totalStops      = lockedPathData.path.length;
    const transfers       = detectTransfers(remainingPath);
    const transferFromIds = new Set(transfers.map(t => t.from));
    let   passedCount     = 0;

    for (let i = 0; i < remainingPath.length - 1; i++) {
        const stop     = stopById[remainingPath[i]];
        const nextStop = stopById[remainingPath[i + 1]];
        if (!stop) continue;

        const distToStop = map.distance([lat, lng], [stop.lat, stop.lng]);

        // ── Approaching current stop ──────────────────────────────────────
        if (distToStop <= 100 && lastAnnouncedStop !== stop.id) {
            lastAnnouncedStop = stop.id;
            announce(`Approaching ${stop.name}`);
        }

        // ── One stop before a TRANSFER ────────────────────────────────────
        if (
            nextStop &&
            transferFromIds.has(nextStop.id) &&
            distToStop <= 200 &&
            lastTransferAnnouncement !== `pre-transfer-${nextStop.id}`
        ) {
            lastTransferAnnouncement = `pre-transfer-${nextStop.id}`;
            announce(`Prepare to transfer at the next stop, ${nextStop.name}`);
        }

        // ── AT the transfer stop ──────────────────────────────────────────
        if (
            transferFromIds.has(stop.id) &&
            distToStop <= 150 &&
            lastTransferAnnouncement !== `transfer-${stop.id}`
        ) {
            lastTransferAnnouncement = `transfer-${stop.id}`;
            announce(`Transfer now at ${stop.name}`);
        }

        // ── One stop before FINAL endpoint ───────────────────────────────
        const isLastSegmentStop = i === remainingPath.length - 2;
        if (
            isLastSegmentStop &&
            distToStop <= 200 &&
            lastAnnouncedStop !== `pre-end-${stop.id}`
        ) {
            lastAnnouncedStop = `pre-end-${stop.id}`;
            announce(`Prepare to get off. Next stop is ${nextStop?.name ?? "your destination"}`);
        }

        // ── Passed stop check ─────────────────────────────────────────────
        if (distToStop <= PASSED_THRESHOLD) {
            passedCount = i + 1;
        } else {
            break;
        }
    }

    if (passedCount > 0) {
        remainingPath = remainingPath.slice(passedCount);
        redrawLockedRoute(); // _lastRedrawLength guard lives inside
        renderRouteDetails();
    }

    // ── Arrival at final jeepney stop ────────────────────────────────────
    const finalStop = stopById[remainingPath[remainingPath.length - 1]];
    if (finalStop) {
        const distToFinal     = map.distance([lat, lng], [finalStop.lat, finalStop.lng]);
        const distFinalToICCT = map.distance([finalStop.lat, finalStop.lng], ICCT_POSITION);

        if (distToFinal < PASSED_THRESHOLD && !arrivalAnnounced) {
            arrivalAnnounced = true;

            if (distFinalToICCT <= ICCT_WALK_RADIUS) {
                announce(
                    `You have arrived at ${finalStop.name}. ` +
                    `Walk to ICCT from here. It is about ` +
                    `${Math.round(distFinalToICCT)} meters away.`
                );
            } else {
                announce("You have arrived at your destination.");
            }
        }
    }

    // ── Status bar ───────────────────────────────────────────────────────
    const progress = ((totalStops - remainingPath.length) / totalStops) * 100;
    setStatusMessage(`Following route • ${progress.toFixed(0)}% completed`, "success");
}


// ============================================================
// STATUS BAR
// ============================================================
function setStatusMessage(message, type = "info") {
    const bar = document.getElementById("routeStatusBar");
    if (!bar) return;

    const colors = {
        info:        "#0066ff",
        success:     "#28a745",
        warning:     "#ffc107",
        recalculate: "#ff6600",
    };

    bar.textContent   = message;
    bar.style.color   = colors[type] || colors.info;
    bar.style.display = "block";
}


// ============================================================
// MAIN ROUTE PROCESSOR
// ============================================================
async function processUserLocation(lat, lng, force = false) {
    updateUserMarker(lat, lng);

    if (routeLocked) {
        updateLockedRouteProgress(lat, lng);
        return;
    }

    const posKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const now    = Date.now();

    if (!force) {
        if (now - lastRun < DEBOUNCE_MS) return;
        if (lastUserPos === posKey) return;
    }

    lastRun     = now;
    lastUserPos = posKey;

    if (!force && lastCoords && map.distance([lat, lng], lastCoords) < MOVE_THRESHOLD) return;

    lastCoords = [lat, lng];

    const loader = document.getElementById("mapLoader");
    if (loader) loader.style.display = "flex";
    setStatusMessage("Recalculating route...", "recalculate");

    try {
        if (map.distance([lat, lng], ICCT_POSITION) > MAX_DISTANCE) {
            showToast("You are more than 15km away from ICCT.");
            stopTracking();
            return;
        }

        await buildGraph();
        clearMapRoutes();

        const startStop = await getNearestStop(lat, lng);
        if (!startStop) {
            showToast("No nearby stop found.");
            return;
        }

        const { distances, previous } = dijkstra(graph, startStop.id);

        let bestEndStop = null;
        let bestScore   = Infinity;

        stops.forEach(stop => {
            const jeepneyTime = distances[stop.id];
            if (jeepneyTime === undefined || jeepneyTime === Infinity) return;

            const distToICCT = map.distance([stop.lat, stop.lng], ICCT_POSITION);
            if (distToICCT > END_STOP_RADIUS) return;

            const totalTime = jeepneyTime + distToICCT / WALK_SPEED;
            if (totalTime < bestScore) {
                bestScore   = totalTime;
                bestEndStop = stop;
            }
        });

        if (!bestEndStop) {
            showToast("No route found to ICCT.");
            return;
        }

        const path = buildPath(previous, startStop.id, bestEndStop.id);

        await drawWalkingRoute(lat, lng, startStop.lat, startStop.lng, "start");

        if (!path.length) {
            showToast("Unable to build route path.");
            return;
        }

        const transfers = detectTransfers(path);
        drawJeepneySegments(path, transfers);

        for (const t of transfers) {
            const fromStop = stopById[t.from];
            const toStop   = stopById[t.to];
            if (fromStop && toStop) {
                await drawTransferRoute(fromStop.lat, fromStop.lng, toStop.lat, toStop.lng);
            }
        }

        globalActivePathData = { path, transfers, startStop, bestEndStop };
        remainingPath        = [...path];

        renderRouteDetails();
        setStatusMessage("Route ready. Lock it to start navigating.", "success");

        const lastStop = stopById[path[path.length - 1]];
        if (lastStop) {
            const distToICCT = map.distance([lastStop.lat, lastStop.lng], ICCT_POSITION);
            if (distToICCT <= ICCT_WALK_RADIUS) {
                await drawWalkingRoute(lastStop.lat, lastStop.lng, ICCT_POSITION[0], ICCT_POSITION[1], "end");
            }
        }

    } catch {
        setStatusMessage("Error calculating route.", "warning");
    } finally {
        if (loader) loader.style.display = "none";
    }
}


// ============================================================
// JEEPNEY TYPE TOGGLE
// ============================================================
window.setJeepneyType = function (type) {
    selectedJeepneyType = type;
    renderRouteDetails();
};


// ============================================================
// ROUTE DETAILS PANEL
// ============================================================
function renderRouteDetails() {
    if (!globalActivePathData) return;

    const displayPath = (routeLocked && remainingPath?.length) ? remainingPath : globalActivePathData.path;
    const { transfers, startStop, bestEndStop } = globalActivePathData;

    let totalTripRegularFare    = 0;
    let totalTripDiscountedFare = 0;
    let totalTripDistanceMeters = 0;
    let currentRouteId          = null;
    let currentSegmentDistance  = 0;
    let jeepneyLegsHTML         = "";
    let legCount                = 1;

    const fareCalculator = selectedJeepneyType === "modern"
        ? calculateModernFare
        : calculateTraditionalFare;

    const flushSegment = () => {
        if (currentRouteId === null || currentSegmentDistance <= 0) return;

        const regFare  = fareCalculator(currentSegmentDistance, false);
        const discFare = fareCalculator(currentSegmentDistance, true);

        totalTripRegularFare    += regFare;
        totalTripDiscountedFare += discFare;

        const routeName = routeNames[String(currentRouteId)] || `Route ${currentRouteId}`;

        jeepneyLegsHTML += `
            <b>${routeName}:</b>
            ${(currentSegmentDistance / 1000).toFixed(2)} km<br>
            &nbsp;&nbsp;&nbsp;&nbsp;Regular: ₱${regFare.toFixed(2)} | Disc: ₱${discFare.toFixed(2)}<br><br>`;

        legCount++;
        currentRouteId         = null;
        currentSegmentDistance = 0;
    };

    for (let i = 0; i < displayPath.length - 1; i++) {
        const currentStopId = displayPath[i];
        const nextStopId    = displayPath[i + 1];
        const edge          = (graph[currentStopId] || []).find(e => String(e.to) === String(nextStopId));

        if (!edge) continue;

        const edgeDistance = map.distance(
            [stopById[currentStopId].lat, stopById[currentStopId].lng],
            [stopById[nextStopId].lat,    stopById[nextStopId].lng]
        );

        if (edge.type === "jeepney") {
            totalTripDistanceMeters += edgeDistance;

            if (currentRouteId === null) {
                currentRouteId         = edge.routeId;
                currentSegmentDistance = edgeDistance;
            } else if (edge.routeId === currentRouteId) {
                currentSegmentDistance += edgeDistance;
            } else {
                flushSegment();
                currentRouteId         = edge.routeId;
                currentSegmentDistance = edgeDistance;
            }
        } else if (edge.type === "transfer") {
            flushSegment();
        }
    }

    flushSegment();

    const transferHTML = transfers
        .map((t, i) => {
            const from = stopById[t.from];
            const to   = stopById[t.to];
            if (!from || !to) return "";
            return `<b>Transfer ${i + 1}:</b> Walk from <i>${from.name}</i> to <i>${to.name}</i><br>`;
        })
        .join("");

    const isModern       = selectedJeepneyType === "modern";
    const btnBase        = "flex:1;padding:8px;cursor:pointer;font-weight:bold;border-radius:4px;border:1px solid #0066ff;";
    const btnOn          = `${btnBase}background-color:#0066ff;color:#fff;`;
    const btnOff         = `${btnBase}background-color:#fff;color:#0066ff;`;

    // FIX #5 — ETA in panel header
    const etaMin = calcETAMinutes(displayPath);

    const lockBtnHTML = routeLocked
        ? `<button id="unlockRouteBtn" onclick="window.unlockRoute()"
               style="width:100%;padding:8px;margin-bottom:10px;cursor:pointer;font-weight:bold;
                      border-radius:4px;border:1px solid #d9534f;background:#d9534f;color:#fff;">
                Unlock Route (Allow Recalculation)
           </button>`
        : `<button id="lockRouteBtn" onclick="window.lockRoute()"
               style="width:100%;padding:8px;margin-bottom:10px;cursor:pointer;font-weight:bold;
                      border-radius:4px;border:1px solid #28a745;background:#28a745;color:#fff;">
                Lock This Route
           </button>`;

    const lockedBadge = routeLocked
        ? `<span id="routeLockBadge" style="display:inline-block;background:#28a745;color:#fff;
               font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px;">LOCKED</span>`
        : `<span id="routeLockBadge" style="display:none;"></span>`;

    const panel     = document.getElementById("routeInfo");
    const toggleBtn = document.getElementById("toggleRouteBtn");

    if (!panel) return;

    if (!globalActivePathData) {
        panel.style.display = "none";
        if (toggleBtn) toggleBtn.style.display = "none";
        return;
    }

    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    if (toggleBtn) {
        toggleBtn.style.display = "block";
        L.DomEvent.disableClickPropagation(toggleBtn);
    }

    if (panel.style.display === "" || panel.style.display === "block") {
        panel.style.display = "block";
    }

    panel.style.maxHeight = "calc(100% - 150px)";
    panel.style.overflowY = "auto";

    panel.innerHTML = `
        <div style="font-family:sans-serif;line-height:1.4;">
            <h3 style="margin:0 0 8px 0;color:#0066ff;">
                Active Route Directions ${lockedBadge}
                <span style="font-size:13px;font-weight:normal;color:#555;">~${etaMin} min ride</span>
            </h3>

            ${lockBtnHTML}

            <div style="display:flex;gap:10px;margin-bottom:15px;">
                <button onclick="window.setJeepneyType('traditional')" style="${!isModern ? btnOn : btnOff}">
                    Traditional PUJ
                </button>
                <button onclick="window.setJeepneyType('modern')" style="${isModern ? btnOn : btnOff}">
                    Modern Jeepney
                </button>
            </div>

            <b>Origin:</b> ${startStop.name}<br><br>
            <b>Destination:</b> ${bestEndStop.name}<br><br>
            <b>Total Ride:</b> ${(totalTripDistanceMeters / 1000).toFixed(2)} km

            <hr style="border:0;border-top:1px solid #ccc;margin:10px 0;">

            <h4 style="margin:0 0 5px 0;color:#333;">
                Fare &amp; Ride Breakdown (${selectedJeepneyType.toUpperCase()})
            </h4>
            ${jeepneyLegsHTML}
            ${transferHTML
                ? `<div style="margin-top:5px;font-size:0.9em;color:#555;">${transferHTML}</div>`
                : ""}

            <hr style="border:0;border-top:1px solid #ccc;margin:10px 0;">

            <h4 style="margin:0 0 5px 0;color:#d9534f;">Total Estimated Trip Cost</h4>
            <div style="font-size:1.1em;background:#f9f9f9;padding:8px;border-radius:4px;border-left:4px solid #d9534f;">
                <b>Regular Total:</b>
                <span style="font-weight:bold;color:#333;">₱${totalTripRegularFare.toFixed(2)}</span><br>
                <b>Discounted Total:</b>
                <span style="font-weight:bold;color:#5cb85c;">₱${totalTripDiscountedFare.toFixed(2)}</span>
            </div>
        </div>
    `;
}


// ============================================================
// DEBOUNCE
// ============================================================
function debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}


// ============================================================
// LOCATION SEARCH
// ============================================================
const input = document.getElementById("locationInput");
const box   = document.getElementById("suggestions");

input.addEventListener("input", debounce(async () => {
    const q = input.value.trim();
    if (q.length < 3) { box.innerHTML = ""; return; }

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&filter=circle:${ICCT_POSITION[1]},${ICCT_POSITION[0]},15000&apiKey=${API_KEY}`;

    try {
        const res  = await fetch(url);
        const data = await res.json();
        renderSuggestions(data.features || []);
    } catch {
        // Silently fail
    }
}));

function renderSuggestions(features) {
    box.innerHTML = "";

    features.forEach(place => {
        const div       = document.createElement("div");
        div.className   = "suggestion-item";
        div.textContent = place.properties.formatted;

        div.onclick = async () => {
    if (routeLocked) {
        showToast("Unlock the route first before changing location.");
        return;
    }
    stopTracking();
    locationMode = "search";

            const lat = place.properties.lat;
            const lng = place.properties.lon;

            map.flyToBounds(
                [[lat, lng], ICCT_POSITION],
                { padding: [60, 60], animate: true, duration: 1 }
            );

            await processUserLocation(lat, lng, true);
            input.value   = place.properties.formatted;
            box.innerHTML = "";
        };

        box.appendChild(div);
    });
}


// ============================================================
// GPS TRACKING
// ============================================================
function startTracking() {
    stopTracking();

    let running   = false;
    let firstTick = true;

    watchId = navigator.geolocation.watchPosition(
        async position => {
            if (running) return;

            if (routeLocked) {
                const now = Date.now();
                if (now - _lastLockedTick < LOCKED_TRACKING_INTERVAL_MS) return;
                _lastLockedTick = now;
            }

            running = true;
            try {
                const { latitude, longitude, accuracy } = position.coords;
                if (accuracy > 50) return;
                await processUserLocation(latitude, longitude, firstTick);
                firstTick = false;
            } catch { /* silent */ }
            finally { running = false; }
        },
        error => {
            const messages = {
                [error.PERMISSION_DENIED]:    "Location permission denied.",
                [error.POSITION_UNAVAILABLE]: "Location unavailable.",
                [error.TIMEOUT]:              "GPS timeout. Retrying...",
            };
            showToast(messages[error.code] || "Unknown GPS error.");
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 }
    );
}

function stopTracking() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    watchId = null;
}


// ============================================================
// FULLSCREEN CONTROL
// ============================================================
const FullscreenControl = L.Control.extend({
    options: { position: "topright" },

    onAdd() {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const link      = L.DomUtil.create("a", "", container);

        link.href      = "#";
        link.innerHTML = "⛶";
        link.title     = "Toggle Fullscreen";

        L.DomEvent.disableClickPropagation(container);

        link.onclick = e => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.getElementById("map").requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        };

        document.addEventListener("fullscreenchange", () => {
            link.innerHTML = document.fullscreenElement ? "✕" : "⛶";
            setTimeout(() => map.invalidateSize(), 300);
        });

        return container;
    }
});

map.addControl(new FullscreenControl());


// ============================================================
// RECENTER CONTROL
// ============================================================
const RecenterControl = L.Control.extend({
    options: { position: "bottomright" },

    onAdd() {
        const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const btn       = L.DomUtil.create("a", "", container);

        btn.href          = "#";
        btn.innerHTML     = "📍";
        btn.title         = "Center on me";
        btn.style.fontSize   = "20px";
        btn.style.textAlign  = "center";

        L.DomEvent.disableClickPropagation(container);

        btn.onclick = e => {
            e.preventDefault();
            followUser = true;
            if (userMarker) {
                map.flyTo(userMarker.getLatLng(), 18, { animate: true, duration: 1 });
            }
        };

        return container;
    }
});

map.addControl(new RecenterControl());


// ============================================================
// FARE PANEL TOGGLE
// ============================================================
window.toggleRoutePanel = function () {
    const panel = document.getElementById("routeInfo");
    const btn   = document.getElementById("toggleRouteBtn");

    if (!panel || !btn) return;

    if (panel.style.display === "none") {
        panel.style.display = "block";
        btn.innerHTML       = "◀";
        btn.title           = "Hide Details";
        btn.style.background = "#ffffff";
        btn.style.color      = "#333";
    } else {
        panel.style.display  = "none";
        btn.innerHTML        = "▶";
        btn.title            = "Show Details";
        btn.style.background = "#6D94C5";
        btn.style.color      = "#ffffff";
    }
};

const toggleBtn = document.getElementById("toggleRouteBtn");
if (toggleBtn) {
    toggleBtn.addEventListener("click",      e => e.stopPropagation());
    toggleBtn.addEventListener("mousedown",  e => e.stopPropagation());
    toggleBtn.addEventListener("touchstart", e => e.stopPropagation());
}


// ============================================================
// PUBLIC API
// ============================================================
window.startTracking = startTracking;
window.stopTracking  = stopTracking;



window.useCurrentLocation = () => {
    if (routeLocked) {
        showToast("Unlock the route first before changing location.");
        return;
    }
    if (!navigator.geolocation) {
        showToast("GPS not supported in this browser.");
        return;
    }
    locationMode = "gps";
    stopTracking();
    startTracking();
};