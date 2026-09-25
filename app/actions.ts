'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createSearch, hasSubmitted, searchExists, submitResponse } from '@/lib/db'
import { isPerson, validateResponse, type ResponseInput } from '@/lib/constraints'

export async function createSearchAction(): Promise<never> {
  const id = await createSearch()
  redirect(`/s/${id}`)
}

export type SubmitState = { errors: string[] }

/**
 * Server Actions are reachable by direct POST, not only through the form, so
 * everything the UI enforces is enforced again here -- the same
 * validateResponse() the form calls, plus the checks the UI cannot do.
 */
export async function submitResponseAction(
  _prevState: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const searchId = String(formData.get('searchId') ?? '')
  const person = String(formData.get('person') ?? '')
  const raw = String(formData.get('payload') ?? '')

  if (!isPerson(person)) return { errors: ['Unknown person.'] }
  if (!(await searchExists(searchId))) return { errors: ['That search does not exist.'] }
  if (await hasSubmitted(searchId, person)) {
    return { errors: ['That form has already been submitted.'] }
  }

  let input: ResponseInput
  try {
    input = JSON.parse(raw) as ResponseInput
  } catch {
    return { errors: ['Could not read the form.'] }
  }

  // Normalise before validating, so a hand-rolled POST cannot smuggle in
  // unexpected shapes and have them stored verbatim.
  const clean: ResponseInput = {
    rent_cap: Number(input?.rent_cap),
    preferred_areas: Array.isArray(input?.preferred_areas)
      ? input.preferred_areas.map(String)
      : [],
    dealbreakers: Array.isArray(input?.dealbreakers)
      ? input.dealbreakers.map((c) => ({
          type: String(c?.type ?? ''),
          value: c?.value === null || c?.value === undefined ? null : Number(c.value),
        }))
      : [],
    nice_to_haves: Array.isArray(input?.nice_to_haves)
      ? input.nice_to_haves.map((c) => ({
          type: String(c?.type ?? ''),
          value: c?.value === null || c?.value === undefined ? null : Number(c.value),
        }))
      : [],
  }

  const errors = validateResponse(clean)
  if (errors.length > 0) return { errors }

  try {
    await submitResponse(searchId, person, clean)
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : 'Something went wrong.'] }
  }

  // Drop any cached copy of the status page so the next request for it -- the
  // submitter's redirect, or another phone's poll -- is rendered fresh.
  revalidatePath(`/s/${searchId}`)
  revalidatePath(`/s/${searchId}/${person}`)

  redirect(`/s/${searchId}`)
}
