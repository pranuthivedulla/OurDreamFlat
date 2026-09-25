import { isKnownArea } from './areas'

export const PEOPLE = ['riya', 'meera', 'kavita'] as const
export type Person = (typeof PEOPLE)[number]

export function isPerson(value: string): value is Person {
  return (PEOPLE as readonly string[]).includes(value)
}

export function personName(person: Person): string {
  return person.charAt(0).toUpperCase() + person.slice(1)
}

export const MAX_DEALBREAKERS = 3

/**
 * The fixed dealbreaker list from the brief. `needsNumber` entries carry a
 * value; the rest are yes/no. At most three of these may be chosen -- forcing
 * that choice is the point of the tool.
 */
export const DEALBREAKER_TYPES = [
  { id: 'lift', label: 'Lift required', needsNumber: false },
  { id: 'parking', label: 'Parking required', needsNumber: false },
  { id: 'bathrooms', label: 'Minimum bathrooms', needsNumber: true },
  { id: 'pet_friendly', label: 'Pet-friendly required', needsNumber: false },
  { id: 'max_floor', label: 'Maximum floor', needsNumber: true },
] as const

export type DealbreakerTypeId = (typeof DEALBREAKER_TYPES)[number]['id']

/**
 * Things that can only ever be a preference, never a dealbreaker -- the
 * dealbreaker list above is fixed and these are not on it. Every entry maps to
 * a field a listing actually carries; a parameter nothing can be checked
 * against would be decoration, since it could neither drop a flat nor rank one.
 */
export const EXTRA_TYPES = [
  { id: 'balcony', label: 'Balcony', needsNumber: false },
  { id: 'furnished', label: 'Furnished', needsNumber: false },
  { id: 'gym', label: 'Gym in building', needsNumber: false },
  { id: 'power_backup', label: 'Power backup', needsNumber: false },
  { id: 'security', label: '24x7 security', needsNumber: false },
] as const

/** The dealbreaker list plus extras. Any number of these may be chosen. */
export const NICE_TO_HAVE_TYPES = [...DEALBREAKER_TYPES, ...EXTRA_TYPES] as const

export type NiceToHaveTypeId = (typeof NICE_TO_HAVE_TYPES)[number]['id']

export type Constraint = {
  type: string
  value: number | null
}

export type ResponseInput = {
  rent_cap: number
  /** Areas she would like to live in. Ranks flats up; never drops one. */
  preferred_areas: string[]
  dealbreakers: Constraint[]
  nice_to_haves: Constraint[]
}

/** How many of the three dealbreaker slots are spent. */
export function dealbreakerCount(input: { dealbreakers: Constraint[] }): number {
  return input.dealbreakers.length
}

/**
 * The single validator. Called by the client form (so the UI can block a bad
 * submit) and again by the server action (so a direct POST cannot bypass it).
 * Returns [] when the input is good.
 */
export function validateResponse(input: ResponseInput): string[] {
  const errors: string[] = []

  if (!Number.isInteger(input.rent_cap) || input.rent_cap <= 0) {
    errors.push('Set the most rent you will pay.')
  }

  for (const id of input.preferred_areas) {
    if (!isKnownArea(id)) errors.push(`"${id}" is not an area on the list.`)
  }
  if (new Set(input.preferred_areas).size !== input.preferred_areas.length) {
    errors.push('The same preferred area was listed twice.')
  }



  const validDealbreakerIds = new Set<string>(DEALBREAKER_TYPES.map((d) => d.id))
  for (const constraint of input.dealbreakers) {
    if (!validDealbreakerIds.has(constraint.type)) {
      errors.push(`"${constraint.type}" is not a dealbreaker on the list.`)
      continue
    }
    const spec = DEALBREAKER_TYPES.find((d) => d.id === constraint.type)!
    if (spec.needsNumber && (!Number.isInteger(constraint.value) || constraint.value! <= 0)) {
      errors.push(`"${spec.label}" needs a number above zero.`)
    }
  }
  if (new Set(input.dealbreakers.map((d) => d.type)).size !== input.dealbreakers.length) {
    errors.push('The same dealbreaker was chosen twice.')
  }

  const spent = dealbreakerCount(input)
  if (spent > MAX_DEALBREAKERS) {
    errors.push(`At most ${MAX_DEALBREAKERS} dealbreakers. You have ${spent}.`)
  }

  const validNiceIds = new Set<string>(NICE_TO_HAVE_TYPES.map((n) => n.id))
  for (const constraint of input.nice_to_haves) {
    if (!validNiceIds.has(constraint.type)) {
      errors.push(`"${constraint.type}" is not a nice-to-have on the list.`)
      continue
    }
    const spec = NICE_TO_HAVE_TYPES.find((n) => n.id === constraint.type)!
    if (spec.needsNumber && (!Number.isInteger(constraint.value) || constraint.value! <= 0)) {
      errors.push(`"${spec.label}" needs a number above zero.`)
    }
  }
  if (new Set(input.nice_to_haves.map((n) => n.type)).size !== input.nice_to_haves.length) {
    errors.push('The same nice-to-have was chosen twice.')
  }

  return errors
}
