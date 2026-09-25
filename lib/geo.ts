import { AREAS, type Area } from './areas'

/** Great-circle distance in km. A plain geometric primitive, nothing to do with travel time. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * How far a listing may sit from an area centroid and still be called that area.
 * Our 20 centroids are 2-5 km apart, so 6 km comfortably covers a listing on the
 * edge of a real neighbourhood while still refusing somewhere genuinely outside
 * the map -- Talegaon is ~18 km from its nearest centroid.
 */
export const AREA_SNAP_LIMIT_KM = 6

export type AreaMatch =
  | { areaId: string; how: 'coordinates'; distanceKm: number }
  | { areaId: string; how: 'name' }
  | { areaId: null; how: 'unmatched'; reason: string }

/**
 * Work out which canonical area a listing sits in.
 *
 * Coordinates first, because they cannot be misspelt. The locality string is
 * only a fallback for listings that carry no coordinates. If neither resolves,
 * the answer is null and the caller must flag it -- guessing here would put a
 * listing in the wrong area silently, which breaks both no-go matching and
 * commute lookup at once.
 */
export function matchArea(input: {
  latitude?: number | null
  longitude?: number | null
  locality?: string | null
}): AreaMatch {
  const { latitude, longitude, locality } = input

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    let best: { area: Area; km: number } | null = null
    for (const area of AREAS) {
      const km = haversineKm({ lat: latitude, lng: longitude }, area)
      if (!best || km < best.km) best = { area, km }
    }
    if (best && best.km <= AREA_SNAP_LIMIT_KM) {
      return { areaId: best.area.id, how: 'coordinates', distanceKm: Math.round(best.km * 10) / 10 }
    }
    return {
      areaId: null,
      how: 'unmatched',
      reason: best
        ? `nearest area ${best.area.name} is ${Math.round(best.km)} km away`
        : 'no areas configured',
    }
  }

  if (locality) {
    const wanted = locality.trim().toLowerCase()
    const hit = AREAS.find(
      (a) => a.name.toLowerCase() === wanted || a.id === wanted.replace(/\s+/g, '-')
    )
    if (hit) return { areaId: hit.id, how: 'name' }
    return { areaId: null, how: 'unmatched', reason: `locality "${locality}" is not on the list` }
  }

  return { areaId: null, how: 'unmatched', reason: 'no coordinates and no locality' }
}
