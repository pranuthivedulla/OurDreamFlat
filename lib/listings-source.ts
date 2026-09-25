import demoData from '@/data/demo-listings.json'

import { matchArea } from './geo'

/**
 * One listing as the NoBroker Apify actor returns it
 * (thirdwatch/nobroker-scraper). Every field is optional because the actor
 * omits fields it could not find -- that omission is the origin of every NULL
 * in our listings table, so it is modelled here rather than papered over.
 */
export type RawListing = {
  listing_id?: string
  /** MagicBricks only: a string like "1 Covered" or "2 Covered, 1 Open". */
  parking?: string | boolean | null
  /** MagicBricks only: a count, so a balcony is a number rather than a word match. */
  balconies?: number
  title?: string
  bhk?: number
  bathrooms?: number
  carpet_area_sqft?: number
  price_inr?: number
  furnishing?: string
  floor?: number
  total_floors?: number
  locality?: string
  city?: string
  latitude?: number
  longitude?: number
  listed_by?: string
  amenities?: string[]
  url?: string
  posted_at?: string
}

/** A row ready for the `listings` table, plus why anything came out unknown. */
export type MappedListing = {
  source: 'paste' | 'apify'
  url: string | null
  rent: number | null
  area: string | null
  floor: number | null
  has_lift: boolean | null
  parking: boolean | null
  bathrooms: number | null
  pet_friendly: boolean | null
  extras: string[]
  /** Human-readable notes about what could not be determined. Never a guess. */
  unknowns: string[]
}

const LIFT_WORDS = ['lift', 'elevator']
const PARKING_WORDS = ['parking', 'garage']

/**
 * MagicBricks returns parking as a free-text count, e.g. "2 Covered, 1 Open".
 * Recognised wording means yes; anything unrecognised means NOT STATED, never
 * no -- "None" is a truthy string and would otherwise read as parking.
 */
function parkingFromField(value: string | boolean | null | undefined): boolean | null {
  if (typeof value === 'boolean') return value ? true : null
  if (typeof value !== 'string') return null
  const text = value.toLowerCase()
  if (/(none|no parking|not available)/.test(text)) return false
  if (/(covered|open|garage|basement|reserved|\d)/.test(text)) return true
  return null
}

/**
 * An amenity list is evidence of what a flat HAS, never evidence of what it
 * lacks. A listing that does not mention a lift may still have one and simply
 * not say so, so absence maps to null -- "not stated" -- and the filter engine
 * keeps it and flags it. Mapping absence to false would invent a fact and let
 * the chain drop a flat on something nobody ever claimed.
 */
function amenityState(amenities: string[] | undefined, words: string[]): boolean | null {
  if (!amenities || amenities.length === 0) return null
  const found = amenities.some((a) => words.some((w) => a.toLowerCase().includes(w)))
  return found ? true : null
}

export function mapListing(raw: RawListing): MappedListing {
  const unknowns: string[] = []

  const match = matchArea(raw)
  if (match.areaId === null) unknowns.push(`area not identified: ${match.reason}`)

  // MagicBricks never reports a lift -- its amenities array is internal numeric
  // codes, not names -- so this is null for every MagicBricks listing by
  // construction, not by oversight.
  const has_lift = amenityState(raw.amenities, LIFT_WORDS)
  if (has_lift === null) unknowns.push('lift not stated')

  // A dedicated field beats guessing from an amenity list, so prefer it.
  const parking =
    raw.parking !== undefined ? parkingFromField(raw.parking) : amenityState(raw.amenities, PARKING_WORDS)
  if (parking === null) unknowns.push('parking not stated')

  const bathrooms = typeof raw.bathrooms === 'number' ? raw.bathrooms : null
  if (bathrooms === null) unknowns.push('bathrooms not stated')

  const floor = typeof raw.floor === 'number' ? raw.floor : null
  if (floor === null) unknowns.push('floor not stated')

  const rent = typeof raw.price_inr === 'number' ? raw.price_inr : null
  if (rent === null) unknowns.push('rent not stated')

  // The actor never returns anything about pets, so this is unknown for every
  // scraped listing by construction -- not an oversight in the mapping.
  unknowns.push('pet policy not stated')

  return {
    source: 'apify',
    url: raw.url ?? null,
    rent,
    area: match.areaId,
    floor,
    has_lift,
    parking,
    bathrooms,
    pet_friendly: null,
    // Extras are what ranking matches on, so only readable values go in.
    // MagicBricks' amenities array is numeric codes and is deliberately left
    // out: putting it in would match nothing and look like a working check.
    extras: [
      ...(raw.amenities ?? []).filter((a) => /[a-z]/i.test(a)),
      ...(raw.furnishing ? [raw.furnishing] : []),
      ...(typeof raw.balconies === 'number' && raw.balconies > 0 ? ['Balcony'] : []),
    ],
    unknowns,
  }
}

/** The 12 demo listings, in the actor's own output shape. Costs nothing. */
export function getDemoListings(): RawListing[] {
  return demoData.items as RawListing[]
}

/** The portals we can pull from. Both share the field names mapListing reads. */
export const ACTORS = {
  magicbricks: { id: 'thirdwatch~magicbricks-scraper', label: 'MagicBricks' },
  nobroker: { id: 'thirdwatch~nobroker-scraper', label: 'NoBroker (owner-direct)' },
} as const

export type ListingSource = keyof typeof ACTORS

export const APIFY_ACTOR = ACTORS.nobroker.id

/**
 * Start a real Apify run. THIS SPENDS CREDITS -- it is the only function here
 * that does. Nothing calls it yet: until submission day the app runs on
 * getDemoListings(). Kept in the same file, mapping through the same
 * mapListing(), so switching over is a change of source and nothing else.
 */
function token(): string {
  const value = process.env.APIFY_TOKEN
  if (!value) throw new Error('Missing APIFY_TOKEN')
  return value
}

/**
 * Start a real Apify run. THIS SPENDS CREDITS -- the only function here that
 * does. Roughly 4-5 US cents for 15 results: the headline $1.50/1,000 covers
 * results, and compute units are charged on top.
 */
export async function startApifyRun(
  source: ListingSource,
  input: { city: string; maxResults?: number }
): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTORS[source].id}/runs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchMode: 'rent', maxResults: 15, ...input }),
  })
  if (!res.ok) throw new Error(`Apify run failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return { runId: json.data.id, datasetId: json.data.defaultDatasetId }
}

/** Reading a run's state costs nothing. */
export async function getRunState(runId: string): Promise<string> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`Could not read run: ${res.status}`)
  return (await res.json()).data.status as string
}

/** Reading a finished dataset costs nothing. */
export async function fetchRunItems(datasetId: string): Promise<RawListing[]> {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(`Could not read dataset: ${res.status}`)
  return (await res.json()) as RawListing[]
}
