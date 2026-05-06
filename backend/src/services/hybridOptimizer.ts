/**
 * OTIMIZADOR HÍBRIDO PARA ROTAS GRANDES (50-150 pontos)
 *
 * Pipeline:
 *   1) Distance Matrix em chunks 10x10 (com tráfego)
 *   2) Nearest Neighbor (origem → ... → destino)
 *   3) 2-opt para refinar
 *   4) Or-opt (mover sequências de 1-3) para refinar
 *   5) Directions API em chunks de 25 → polyline final
 *
 * Respeita pontos fixos (origin, destination, manutencao).
 */

interface Pt {
  id: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  operationType?: string;
}

interface MatrixCell { distance: number; duration: number; }

const API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
const DM_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const matrixCache = new Map<string, MatrixCell>();
const cacheKey = (a: Pt, b: Pt) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

async function fetchMatrixChunk(origins: Pt[], destinations: Pt[]): Promise<MatrixCell[][]> {
  const o = origins.map(p => `${p.lat},${p.lng}`).join('|');
  const d = destinations.map(p => `${p.lat},${p.lng}`).join('|');
  const url = `${DM_URL}?origins=${encodeURIComponent(o)}&destinations=${encodeURIComponent(d)}&mode=driving&departure_time=now&traffic_model=best_guess&key=${API_KEY}`;
  const r = await fetch(url);
  const data: any = await r.json();
  if (data.status !== 'OK') throw new Error(`DistanceMatrix: ${data.status}`);
  return data.rows.map((row: any) =>
    row.elements.map((el: any) =>
      el.status === 'OK'
        ? { distance: el.distance.value, duration: (el.duration_in_traffic || el.duration).value }
        : { distance: Infinity, duration: Infinity }
    )
  );
}

async function buildMatrix(points: Pt[]): Promise<number[][]> {
  const n = points.length;
  const M: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const CHUNK = 10;
  for (let i = 0; i < n; i += CHUNK) {
    for (let j = 0; j < n; j += CHUNK) {
      const oSlice = points.slice(i, i + CHUNK);
      const dSlice = points.slice(j, j + CHUNK);
      // Verificar cache
      const allCached = oSlice.every(o => dSlice.every(d => matrixCache.has(cacheKey(o, d))));
      let cells: MatrixCell[][];
      if (allCached) {
        cells = oSlice.map(o => dSlice.map(d => matrixCache.get(cacheKey(o, d))!));
      } else {
        cells = await fetchMatrixChunk(oSlice, dSlice);
        oSlice.forEach((o, oi) => dSlice.forEach((d, di) => matrixCache.set(cacheKey(o, d), cells[oi][di])));
      }
      cells.forEach((row, oi) => row.forEach((cell, di) => {
        M[i + oi][j + di] = cell.duration; // otimizar por TEMPO (com tráfego)
      }));
    }
  }
  return M;
}

function nearestNeighbor(M: number[][], originIdx: number, destIdx: number, fixedIdx: Set<number>): number[] {
  const n = M.length;
  const visited = new Set<number>([originIdx]);
  const route = [originIdx];
  let cur = originIdx;
  while (visited.size < n - 1) {
    let best = -1;
    let bestVal = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited.has(j) || j === destIdx) continue;
      if (M[cur][j] < bestVal) { bestVal = M[cur][j]; best = j; }
    }
    if (best === -1) break;
    route.push(best);
    visited.add(best);
    cur = best;
  }
  route.push(destIdx);
  return route;
}

function routeCost(M: number[][], r: number[]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += M[r[i]][r[i + 1]];
  return s;
}

function twoOpt(M: number[][], route: number[], fixedSet: Set<number>): number[] {
  const n = route.length;
  let improved = true;
  let best = route.slice();
  let bestCost = routeCost(M, best);
  let iter = 0;
  const MAX_ITER = 30;
  while (improved && iter < MAX_ITER) {
    improved = false;
    iter++;
    for (let i = 1; i < n - 2; i++) {
      if (fixedSet.has(best[i])) continue;
      for (let k = i + 1; k < n - 1; k++) {
        if (fixedSet.has(best[k])) continue;
        const newRoute = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        const c = routeCost(M, newRoute);
        if (c + 0.01 < bestCost) { best = newRoute; bestCost = c; improved = true; }
      }
    }
  }
  return best;
}

function orOpt(M: number[][], route: number[], fixedSet: Set<number>): number[] {
  let best = route.slice();
  let bestCost = routeCost(M, best);
  for (const segLen of [1, 2, 3]) {
    let improved = true;
    let iter = 0;
    while (improved && iter < 10) {
      improved = false; iter++;
      for (let i = 1; i < best.length - segLen - 1; i++) {
        const seg = best.slice(i, i + segLen);
        if (seg.some(x => fixedSet.has(x))) continue;
        const without = best.slice(0, i).concat(best.slice(i + segLen));
        for (let j = 1; j < without.length - 1; j++) {
          if (j === i) continue;
          const candidate = without.slice(0, j).concat(seg, without.slice(j));
          const c = routeCost(M, candidate);
          if (c + 0.01 < bestCost) { best = candidate; bestCost = c; improved = true; break; }
        }
        if (improved) break;
      }
    }
  }
  return best;
}

async function getPolylineSegments(orderedPts: Pt[]): Promise<{ polyline: string; distance: number; duration: number }> {
  // Quebrar em chunks de 25 pontos
  const CHUNK = 25;
  let combinedPolyline = '';
  let totalDist = 0;
  let totalDur = 0;
  for (let i = 0; i < orderedPts.length - 1; i += CHUNK - 1) {
    const slice = orderedPts.slice(i, i + CHUNK);
    if (slice.length < 2) break;
    const origin = slice[0];
    const destination = slice[slice.length - 1];
    const intermediates = slice.slice(1, -1);
    const body = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      intermediates: intermediates.map(p => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      optimizeWaypointOrder: false,
      languageCode: 'pt-BR',
      units: 'METRIC',
    };
    const r = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });
    const data: any = await r.json();
    if (data.routes?.length) {
      const rt = data.routes[0];
      totalDist += rt.distanceMeters || 0;
      totalDur += parseInt((rt.duration || '0s').replace('s', ''));
      combinedPolyline += rt.polyline?.encodedPolyline || '';
    }
  }
  return { polyline: combinedPolyline, distance: totalDist / 1000, duration: totalDur };
}

export async function optimizeLargeRoute(points: Pt[]): Promise<{
  optimizedPoints: Pt[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  optimizedOrder: string[];
}> {
  console.log(`🧬 [HYBRID] otimizando ${points.length} pontos`);
  if (points.length < 2) throw new Error('Min 2 pontos');

  // Identificar fixos
  const originIdx = points.findIndex(p => p.type === 'origin');
  const destIdx = points.findIndex(p => p.type === 'destination');
  const oIdx = originIdx >= 0 ? originIdx : 0;
  const dIdx = destIdx >= 0 ? destIdx : points.length - 1;
  const fixedSet = new Set<number>([oIdx, dIdx]);
  // manutencao = fixo na rota
  points.forEach((p, i) => { if (p.operationType === 'manutencao') fixedSet.add(i); });

  // 1) Matrix
  const M = await buildMatrix(points);

  // 2) Nearest neighbor
  let route = nearestNeighbor(M, oIdx, dIdx, fixedSet);

  // 3) 2-opt
  route = twoOpt(M, route, fixedSet);

  // 4) Or-opt
  route = orOpt(M, route, fixedSet);

  const orderedPts = route.map(i => points[i]);

  // 5) Polyline final
  const { polyline, distance, duration } = await getPolylineSegments(orderedPts);

  return {
    optimizedPoints: orderedPts,
    totalDistance: distance,
    totalDuration: duration,
    polyline,
    optimizedOrder: orderedPts.map(p => p.id),
  };
}

setInterval(() => matrixCache.clear(), 60 * 60 * 1000); // limpar cache a cada hora
