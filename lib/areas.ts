import areasData from '@/data/pune-areas.json'

export type Area = {
  id: string
  name: string
  lat: number
  lng: number
}

/**
 * The canonical area list. Everything -- no-go areas, must_be_near areas and
 * (in Phase 2) listing.area -- is matched on `id`, never on the display name.
 * That is what stops no-go matching and commute lookup from silently
 * disagreeing on spelling.
 */
export const AREAS: Area[] = areasData.areas

const AREA_IDS = new Set(AREAS.map((a) => a.id))

export function isKnownArea(id: string): boolean {
  return AREA_IDS.has(id)
}

export function areaName(id: string): string {
  return AREAS.find((a) => a.id === id)?.name ?? id
}
