/**
 * Prints how every demo listing maps into the listings table. No network, no
 * database, no credits. Run: npx tsx scripts/check-mapping.ts
 */
import demoData from '../data/demo-listings.json'
import { areaName } from '../lib/areas'
import { mapListing, type RawListing } from '../lib/listings-source'

const items = demoData.items as (RawListing & { _demoNote?: string })[]

let unmatched = 0
let fabricatedFalse = 0

for (const raw of items) {
  const m = mapListing(raw)
  const area = m.area ? areaName(m.area) : 'NULL'
  console.log(`\n${raw.listing_id}  ${raw.title}`)
  console.log(`  area     : ${area}${m.area ? '' : '  <- flagged, not guessed'}`)
  console.log(
    `  rent     : ${m.rent ?? 'NULL'}   floor: ${m.floor ?? 'NULL'}   baths: ${m.bathrooms ?? 'NULL'}`
  )
  console.log(
    `  lift     : ${m.has_lift === null ? 'NULL (not stated)' : m.has_lift}   parking: ${
      m.parking === null ? 'NULL (not stated)' : m.parking
    }   pets: ${m.pet_friendly === null ? 'NULL' : m.pet_friendly}`
  )
  console.log(`  flags    : ${m.unknowns.join('; ')}`)

  if (m.area === null) unmatched++
  if (m.has_lift === false || m.parking === false || m.pet_friendly === false) fabricatedFalse++
}

console.log('\n' + '='.repeat(60))
console.log(`listings mapped      : ${items.length}`)
console.log(`area unresolved      : ${unmatched}  (expected 1: Talegaon, off the map)`)
console.log(`any field set to false: ${fabricatedFalse}  (must be 0 -- false would be invented)`)
