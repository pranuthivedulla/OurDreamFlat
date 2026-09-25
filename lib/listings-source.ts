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

  const has_lift = amenityState(raw.amenities, LIFT_WORDS)
  if (has_lift === null) unknowns.push('lift not stated')

  const parking = amenityState(raw.amenities, PARKING_WORDS)
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
    // Furnishing rides along in extras so ranking can check it the same way
    // it checks any other amenity.
    extras: [...(raw.amenities ?? []), ...(raw.furnishing ? [raw.furnishing] : [])],
    unknowns,
  }
}

/** The 12 demo listings, in the actor's own output shape. Costs nothing. */
export function getDemoListings(): RawListing[] {
  return demoData.items as RawListing[]
}

export const APIFY_ACTOR = 'thirdwatch~nobroker-scraper'

/**
 * Start a real Apify run. THIS SPENDS CREDITS -- it is the only function here
 * that does. Nothing calls it yet: until submission day the app runs on
 * getDemoListings(). Kept in the same file, mapping through the same
 * mapListing(), so switching over is a change of source and nothing else.
 */
export async function startApifyRun(input: {
  city: string
  localities?: string[]
  maxResults?: number
}): Promise<{ runId: string }> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('Missing APIFY_TOKEN')

  const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchMode: 'rent',
      ownerOnly: true,
      maxResults: 20,
      ...input,
    }),
  })
  if (!res.ok) throw new Error(`Apify run failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return { runId: json.data.id }
}
