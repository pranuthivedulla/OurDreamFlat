import 'server-only'

import { randomInt } from 'crypto'

import { getSupabase } from './supabase'
import { PEOPLE, type Person, type ResponseInput } from './constraints'

// No 0/O/1/I/l -- these get read aloud and retyped from WhatsApp.
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const TOKEN_LENGTH = 6

function newToken(): string {
  let token = ''
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]
  }
  return token
}

export async function createSearch(): Promise<string> {
  // Retry on the (vanishingly unlikely) primary-key collision rather than
  // handing the user an error.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newToken()
    const { error } = await getSupabase().from('searches').insert({ id })
    if (!error) return id
    if (error.code !== '23505') throw new Error(`Could not create search: ${error.message}`)
  }
  throw new Error('Could not create search: token collisions')
}

export async function searchExists(searchId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('searches')
    .select('id')
    .eq('id', searchId)
    .maybeSingle()
  if (error) throw new Error(`Could not load search: ${error.message}`)
  return data !== null
}

export type SearchStatus = {
  id: string
  status: 'collecting' | 'ready'
  submitted: Person[]
  waitingFor: Person[]
}

/**
 * Names and nothing else. This function selects the `person` column only --
 * no answer ever leaves the database for the status view, so the status page
 * cannot leak one even by accident.
 */
export async function getStatus(searchId: string): Promise<SearchStatus | null> {
  const { data: search, error: searchError } = await getSupabase()
    .from('searches')
    .select('id, status')
    .eq('id', searchId)
    .maybeSingle()
  if (searchError) throw new Error(`Could not load search: ${searchError.message}`)
  if (!search) return null

  const { data: rows, error: rowsError } = await getSupabase()
    .from('responses')
    .select('person')
    .eq('search_id', searchId)
  if (rowsError) throw new Error(`Could not load status: ${rowsError.message}`)

  const submitted = (rows ?? []).map((r) => r.person as Person)
  return {
    id: search.id,
    status: search.status as 'collecting' | 'ready',
    submitted,
    waitingFor: PEOPLE.filter((p) => !submitted.includes(p)),
  }
}

export async function hasSubmitted(searchId: string, person: Person): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('responses')
    .select('person')
    .eq('search_id', searchId)
    .eq('person', person)
    .maybeSingle()
  if (error) throw new Error(`Could not check submission: ${error.message}`)
  return data !== null
}

export async function submitResponse(
  searchId: string,
  person: Person,
  input: ResponseInput
): Promise<void> {
  const { error } = await getSupabase().from('responses').insert({
    search_id: searchId,
    person,
    rent_cap: input.rent_cap,
    no_go_areas: input.no_go_areas,
    must_be_near: input.must_be_near,
    dealbreakers: input.dealbreakers,
    nice_to_haves: input.nice_to_haves,
  })

  if (error) {
    // The unique (search_id, person) constraint is what locks a form after
    // submission, even against a replayed POST.
    if (error.code === '23505') throw new Error('That form has already been submitted.')
    throw new Error(`Could not save your answers: ${error.message}`)
  }

  const status = await getStatus(searchId)
  if (status && status.submitted.length === PEOPLE.length && status.status !== 'ready') {
    const { error: statusError } = await getSupabase()
      .from('searches')
      .update({ status: 'ready' })
      .eq('id', searchId)
    if (statusError) throw new Error(`Could not update status: ${statusError.message}`)
  }
}
