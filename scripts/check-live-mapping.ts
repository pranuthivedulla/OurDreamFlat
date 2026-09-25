/**
 * Maps the captured live MagicBricks sample through mapListing(). Reads a
 * local file: no network, no credits.
 */
import { readFileSync } from 'fs'

import { areaName } from '../lib/areas'
import { mapListing, type RawListing } from '../lib/listings-source'

const items = JSON.parse(readFileSync('.live-sample.json', 'utf8')) as RawListing[]

let unmatchedArea = 0
let invented = 0

for (const raw of items) {
  const m = mapListing(raw)
  console.log(`\n${raw.locality} -> ${m.area ? areaName(m.area) : 'NULL'}   ₹${m.rent?.toLocaleString('en-IN')}`)
  console.log(`  lift ${String(m.has_lift)}  parking ${String(m.parking)} (raw ${JSON.stringify(raw.parking)})  baths ${m.bathrooms}  floor ${m.floor}`)
  console.log(`  extras: ${m.extras.join(', ') || '—'}`)
  if (m.area === null) unmatchedArea++
  if (m.has_lift === false || m.pet_friendly === false) invented++
}

console.log('\n' + '='.repeat(60))
console.log(`listings          : ${items.length}`)
console.log(`area unresolved   : ${unmatchedArea}`)
console.log(`invented 'false'  : ${invented}  (must be 0 for anything not actually stated)`)
