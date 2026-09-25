import { NICE_TO_HAVE_TYPES, personName, type Constraint, type Person } from './constraints'

/**
 * The filter engine. Plain code, no AI, and deterministic: the same three
 * forms and the same listings always produce the same shortlist, including
 * the order. Every tie is broken on a stable listing key so nothing depends
 * on row order coming back from the database.
 */

/** How many flats the shortlist keeps. One place to change it. */
export const SHORTLIST_SIZE = 5

export type Listing = {
  id: string
  url: string | null
  rent: number | null
  area: string | null
  floor: number | null
  has_lift: boolean | null
  parking: boolean | null
  bathrooms: number | null
  pet_friendly: boolean | null
  extras: string[]
}

export type Response = {
  person: Person
  rent_cap: number
  preferred_areas: string[]
  dealbreakers: Constraint[]
  nice_to_haves: Constraint[]
}

/** How one listing fares for one person. */
export type PersonView = {
  person: Person
  /** Preferences met, and the area match. Higher is better. */
  score: number
  gets: string[]
  givesUp: string[]
  /** Things that could not be checked. Never counted as met or failed. */
  unknowns: string[]
  areaPreferred: boolean
}

export type Verdict = {
  listing: Listing
  passed: boolean
  /**
   * Why it was dropped, in the person's words. Empty when it passed.
   * `key` is the category -- what gets counted when working out which single
   * constraint cost the most. The reason text names this listing's own
   * numbers, so it is unique per listing and must never be counted.
   */
  blockedBy: { person: Person; key: string; reason: string }[]
  perPerson: PersonView[]
  lowestScore: number
  totalScore: number
  /** Flags that apply to the flat itself, shown to everyone. */
  flags: string[]
}

export type Shortlist = {
  maxRent: number
  /** Every listing the engine looked at. */
  considered: number
  /** How many cleared every rule, before the top three were taken. */
  passedCount: number
  shortlist: Verdict[]
  dropped: Verdict[]
  /** Set when fewer than three passed: what blocked the most, and what relaxing it would buy. */
  shortfall: { reason: string; blocked: number; wouldQualify: number } | null
}

const label = (type: string) => NICE_TO_HAVE_TYPES.find((t) => t.id === type)?.label ?? type

/**
 * How a constraint reads inside "one of you gets ..." / "one of you gives up
 * ...". The catalogue labels are form labels ("Lift required") and read badly
 * in a sentence.
 */
function phrase(type: string, value: number | null): string {
  switch (type) {
    case 'lift':
      return 'a lift'
    case 'parking':
      return 'parking'
    case 'bathrooms':
      return value ? `${value} bathrooms or more` : 'enough bathrooms'
    case 'pet_friendly':
      return 'a pet-friendly flat'
    case 'max_floor':
      return value ? `a floor no higher than ${value}` : 'a low enough floor'
    case 'balcony':
      return 'a balcony'
    case 'furnished':
      return 'a furnished place'
    case 'gym':
      return 'a gym in the building'
    case 'power_backup':
      return 'power backup'
    case 'security':
      return '24x7 security'
    default:
      return label(type).toLowerCase()
  }
}

/**
 * Does this listing satisfy one constraint?
 *
 * Three answers, not two. `null` means the listing does not say, which is
 * never treated as a pass and never treated as a failure -- it is kept and
 * flagged, so nobody visits a flat believing something nobody ever claimed.
 */
function meets(listing: Listing, constraint: Constraint): boolean | null {
  const has = (word: string) =>
    listing.extras.some((e) => e.toLowerCase().includes(word)) ? true : false

  switch (constraint.type) {
    case 'lift':
      return listing.has_lift
    case 'parking':
      return listing.parking
    case 'pet_friendly':
      return listing.pet_friendly
    case 'bathrooms':
      if (listing.bathrooms === null) return null
      return listing.bathrooms >= (constraint.value ?? 0)
    case 'max_floor':
      if (listing.floor === null) return null
      return listing.floor <= (constraint.value ?? Infinity)
    // Extras are ranking-only and can never be dealbreakers, so an amenity that
    // is simply not listed counts as not met rather than unknown.
    case 'balcony':
      return has('balcony')
    case 'furnished':
      return listing.extras.some((e) => e.toLowerCase() === 'furnished')
    case 'gym':
      return has('gym')
    case 'power_backup':
      return has('power backup')
    case 'security':
      return has('security')
    default:
      return null
  }
}

export function buildShortlist(responses: Response[], listings: Listing[]): Shortlist {
  // Rule 1: the whole flat's rent, from the person who can afford least.
  const maxRent = 3 * Math.min(...responses.map((r) => r.rent_cap))

  const verdicts: Verdict[] = listings.map((listing) => {
    const blockedBy: { person: Person; key: string; reason: string }[] = []
    const flags: string[] = []

    if (listing.rent === null) {
      flags.push('Rent not stated')
    } else if (listing.rent > maxRent) {
      // Rent is everyone's rule, so it is nobody's in particular.
      blockedBy.push({
        person: responses[0].person,
        key: 'rent',
        reason: `the shared rent ceiling of ₹${maxRent.toLocaleString('en-IN')}`,
      })
    }

    if (listing.area === null) flags.push('Area not identified')

    const perPerson: PersonView[] = responses.map((response) => {
      const gets: string[] = []
      const givesUp: string[] = []
      const unknowns: string[] = []

      for (const constraint of response.dealbreakers) {
        const result = meets(listing, constraint)
        if (result === null) {
          unknowns.push(`${label(constraint.type)} not stated`)
        } else if (result === false) {
          blockedBy.push({
            person: response.person,
            key: `${response.person}:${constraint.type}`,
            reason: `${personName(response.person)}'s dealbreaker: ${label(constraint.type)}${constraint.value ? ` (${constraint.value})` : ''}`,
          })
        } else {
          gets.push(phrase(constraint.type, constraint.value))
        }
      }

      for (const constraint of response.nice_to_haves) {
        const result = meets(listing, constraint)
        if (result === null) unknowns.push(`${label(constraint.type)} not stated`)
        else if (result) gets.push(phrase(constraint.type, constraint.value))
        else givesUp.push(phrase(constraint.type, constraint.value))
      }

      // Neutral wording, because these are aggregated across the three of them
      // on screen and must not read as belonging to anyone in particular.
      const areaPreferred = listing.area !== null && response.preferred_areas.includes(listing.area)
      if (areaPreferred) gets.push('an area they picked')
      else if (listing.area !== null && response.preferred_areas.length > 0) {
        givesUp.push('living in one of the areas they picked')
      }

      // Score counts only what was positively confirmed. An unknown never
      // scores, in either direction.
      const score =
        response.nice_to_haves.filter((c) => meets(listing, c) === true).length +
        (areaPreferred ? 1 : 0)

      return { person: response.person, score, gets, givesUp, unknowns, areaPreferred }
    })

    for (const unknown of new Set(perPerson.flatMap((p) => p.unknowns))) {
      flags.push(unknown)
    }

    return {
      listing,
      passed: blockedBy.length === 0,
      blockedBy,
      perPerson,
      lowestScore: Math.min(...perPerson.map((p) => p.score)),
      totalScore: perPerson.reduce((sum, p) => sum + p.score, 0),
      flags: [...new Set(flags)],
    }
  })

  const passed = verdicts.filter((v) => v.passed)
  const dropped = verdicts.filter((v) => !v.passed)

  // Rule 4: the worst-off person first, so no one person always loses; then the
  // total. Genuine ties are broken by cheaper rent, then by id -- id alone was
  // not good enough, because it is a demo string in tests and a database uuid
  // in the app, so the same data ranked differently in the two places.
  passed.sort(
    (a, b) =>
      b.lowestScore - a.lowestScore ||
      b.totalScore - a.totalScore ||
      (a.listing.rent ?? Infinity) - (b.listing.rent ?? Infinity) ||
      a.listing.id.localeCompare(b.listing.id)
  )

  return {
    maxRent,
    considered: listings.length,
    passedCount: passed.length,
    shortlist: passed.slice(0, SHORTLIST_SIZE),
    dropped,
    shortfall:
      passed.length < SHORTLIST_SIZE ? explainShortfall(dropped, listings.length) : null,
  }
}

/**
 * Rule 6: when fewer than three pass, say which single constraint cost the
 * most and what dropping it would buy. Never show an empty screen with no
 * explanation.
 */
function explainShortfall(
  dropped: Verdict[],
  total: number
): { reason: string; blocked: number; wouldQualify: number } | null {
  if (dropped.length === 0) return null

  const counts = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const verdict of dropped) {
    for (const block of verdict.blockedBy) {
      if (counts.get(block.key) === undefined) labels.set(block.key, block.reason)
      counts.set(block.key, (counts.get(block.key) ?? 0) + 1)
    }
  }

  const [key, blocked] = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0]

  // How many would come back if this one constraint were relaxed and nothing
  // else changed -- so only listings blocked by this and nothing else.
  const wouldQualify = dropped.filter((v) => v.blockedBy.every((b) => b.key === key)).length

  void total
  return { reason: labels.get(key)!, blocked, wouldQualify }
}

/**
 * Collapse the per-person views into counts, so a card can say "one of you
 * gives up a balcony" without saying which one.
 *
 * This is deliberately lossy. The brief asks for a per-person breakdown, and
 * this gives that up on purpose: naming who compromised turns a shared
 * decision into a account of who owes whom.
 */
export type Tally = { text: string; count: number; total: number }

export function tally(verdict: Verdict): { gets: Tally[]; givesUp: Tally[] } {
  const total = verdict.perPerson.length
  const count = (pick: (v: PersonView) => string[]) => {
    const counts = new Map<string, number>()
    for (const view of verdict.perPerson) {
      for (const item of new Set(pick(view))) {
        counts.set(item, (counts.get(item) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([text, n]) => ({ text, count: n, total }))
      // Most widely shared first, then alphabetical so the order never wobbles.
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
  }

  return { gets: count((v) => v.gets), givesUp: count((v) => v.givesUp) }
}
