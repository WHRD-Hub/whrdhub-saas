/**
 * Showing where a report came from without showing where the reporter is.
 *
 * The exact GPS point a reporter's device gave is stored with the report (it
 * helps a response team find the right county and place), but it must never be
 * drawn on a map or sent to a browser: a pin on a street is a pin on a person.
 * Everything that displays a location goes through here first and receives the
 * centre of a coarse grid cell instead, drawn as an area rather than a point.
 *
 * Server-side only by convention: call it before the data reaches a client
 * component, so the exact coordinates are never in the page payload.
 */

/** Cell size in degrees. 0.1 degree is roughly 11 km, so a cell covers around 120 km2. */
const CELL_DEG = 0.1;
/** Radius of the circle drawn for a cell, in metres: wide enough that the true point is not guessable from it. */
export const AREA_RADIUS_M = 7000;

export interface GeneralArea {
  lat: number;
  lng: number;
  radiusM: number;
}

const snap = (v: number) => Math.round((Math.floor(v / CELL_DEG) * CELL_DEG + CELL_DEG / 2) * 1000) / 1000;

export function generaliseArea(lat: number | null | undefined, lng: number | null | undefined): GeneralArea | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: snap(lat), lng: snap(lng), radiusM: AREA_RADIUS_M };
}
