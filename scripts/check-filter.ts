/**
 * Runs the filter engine over the demo listings with three worked-example
 * forms. No network, no database, no credits. Also asserts the engine is
 * deterministic by running it twice over a reshuffled listing order.
 *
 * Run: npx tsx scripts/check-filter.ts
 */
import { areaName } from '../lib/areas'
import { personName } from '../lib/constraints'
import { buildShortlist, type Listing, type Response } from '../lib/filter'
import { getDemoListings, mapListing } from '../lib/listings-source'

// The three forms actually submitted in testing.
const responses: Response[] = [
  {
    person: 'riya',
    rent_cap: 26000,
    preferred_areas: ['hinjewadi', 'wakad', 'balewadi', 'baner', 'aundh', 'bavdhan'],
    dealbreakers: [{ type: 'lift', value: null }],
    nice_to_haves: [{ type: 'gym', value: null }],
  },
  {
    person: 'meera',
    rent_cap: 22000,
    preferred_areas: [
      'hinjewadi', 'wakad', 'balewadi', 'baner', 'aundh', 'bavdhan',
      'kothrud', 'karve-nagar', 'warje', 'sinhagad-road', 'shivajinagar',
    ],
    dealbreakers: [{ type: 'bathrooms', value: 2 }],
    nice_to_haves: [{ type: 'balcony', value: null }],
  },
  {
    person: 'kavita',
    rent_cap: 19000,
    preferred_areas: ['kothrud', 'karve-nagar', 'warje', 'sinhagad-road', 'shivajinagar'],
    dealbreakers: [{ type: 'parking', value: null }],
    nice_to_haves: [{ type: 'security', value: null }],
  },
]

const listings: Listing[] = getDemoListings().map((raw, i) => ({
  id: raw.listing_id ?? `demo-${i}`,
  ...mapListing(raw),
}))

const result = buildShortlist(responses, listings)

console.log(`max rent = 3 x ₹19,000 = ₹${result.maxRent.toLocaleString('en-IN')}`)
console.log(`${listings.length} listings in, ${result.shortlist.length} shortlisted, ${result.dropped.length} dropped\n`)

console.log('='.repeat(64))
console.log('SHORTLIST')
console.log('='.repeat(64))
for (const v of result.shortlist) {
  console.log(`\n${v.listing.id}  ${v.listing.area ? areaName(v.listing.area) : 'area unknown'}  ₹${v.listing.rent?.toLocaleString('en-IN')}`)
  console.log(`  lowest per-person score ${v.lowestScore}, total ${v.totalScore}`)
  for (const p of v.perPerson) {
    console.log(`  ${personName(p.person).padEnd(7)} score ${p.score}`)
    console.log(`     gets     : ${p.gets.join('; ') || '—'}`)
    console.log(`     gives up : ${p.givesUp.join('; ') || '—'}`)
  }
  if (v.flags.length) console.log(`  ⚠️  ${v.flags.join(' · ')}`)
}

console.log('\n' + '='.repeat(64))
console.log('DROPPED')
console.log('='.repeat(64))
for (const v of result.dropped) {
  const reasons = [...new Set(v.blockedBy.map((b) => b.reason))]
  console.log(`${v.listing.id.padEnd(10)} ${reasons.join(' | ')}`)
}

if (result.shortfall) {
  console.log(`\nSHORTFALL: "${result.shortfall.reason}" blocked ${result.shortfall.blocked}; relaxing it alone would qualify ${result.shortfall.wouldQualify} more.`)
}

// Determinism: same inputs, listings shuffled, must give the same order.
const shuffled = [...listings].reverse()
const again = buildShortlist(responses, shuffled)
const sameOrder =
  JSON.stringify(result.shortlist.map((v) => v.listing.id)) ===
  JSON.stringify(again.shortlist.map((v) => v.listing.id))

console.log('\n' + '='.repeat(64))
console.log(`deterministic across input order: ${sameOrder ? 'YES' : 'NO — ordering depends on row order'}`)
console.log(`shortlist: ${result.shortlist.map((v) => v.listing.id).join(', ')}`)

// ---------------------------------------------------------------------------
// Rule 6: fewer than three pass. Three tight caps put the ceiling below every
// flat, so nothing survives and the page must still explain itself.
// ---------------------------------------------------------------------------
const broke: Response[] = responses.map((r) => ({ ...r, rent_cap: 7000 }))
const lean = buildShortlist(broke, listings)

console.log('\n' + '='.repeat(64))
console.log('RULE 6 — everyone capped at ₹7,000')
console.log('='.repeat(64))
console.log(`ceiling ₹${lean.maxRent.toLocaleString('en-IN')}, ${lean.passedCount} passed of ${lean.considered}`)
console.log(
  lean.shortfall
    ? `explains itself: "${lean.shortfall.reason}" blocked ${lean.shortfall.blocked}, relaxing it brings back ${lean.shortfall.wouldQualify}`
    : 'NO EXPLANATION — rule 6 broken'
)
