import areasData from '@/data/pune-areas.json'

export type Area = {
  id: string
  name: string
  lat: number
  lng: number
  zone: string
}

/**
 * Zones exist only so the picker can ask five questions instead of twenty.
 * Nothing downstream knows about them: no-go matching, commute lookup and
 * listing.area all still work on area id.
 */
export const ZONES: { id: string; name: string; hint: string }[] = [
  { id: 'west', name: 'West / IT belt', hint: 'Hinjewadi, Wakad, Baner, Aundh' },
  { id: 'pcmc', name: 'PCMC', hint: 'Pimple Saudagar, Pimpri-Chinchwad' },
  { id: 'central', name: 'Central', hint: 'Shivajinagar, Kothrud, Warje' },
  { id: 'east', name: 'East', hint: 'Koregaon Park, Viman Nagar, Kharadi' },
  { id: 'south', name: 'South-east', hint: 'Hadapsar, Wanowrie, Kondhwa' },
]

export function areasInZone(zoneId: string): Area[] {
  return AREAS.filter((a) => a.zone === zoneId)
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
