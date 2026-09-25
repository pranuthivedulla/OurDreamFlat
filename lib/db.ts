import 'server-only'

import { randomInt } from 'crypto'

import { getSupabase } from './supabase'
import { PEOPLE, type Person, type ResponseInput } from './constraints'
import type { Listing, Response as FilterResponse } from './filter'
import {
  fetchRunItems,
  getDemoListings,
  getRunState,
  mapListing,
  startApifyRun,
  type ListingSource,
} from './listings-source'

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
    preferred_areas: input.preferred_areas,
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

/** Every response for a search, as the filter engine wants them. */
export async function getResponses(searchId: string): Promise<FilterResponse[]> {
  const { data, error } = await getSupabase()
    .from('responses')
    .select('person, rent_cap, preferred_areas, dealbreakers, nice_to_haves')
    .eq('search_id', searchId)
    .order('person')
  if (error) throw new Error(`Could not load responses: ${error.message}`)
  return (data ?? []) as FilterResponse[]
}

export async function getListings(searchId: string): Promise<Listing[]> {
  const { data, error } = await getSupabase()
    .from('listings')
    .select('id, url, rent, area, floor, has_lift, parking, bathrooms, pet_friendly, extras')
    .eq('search_id', searchId)
    .order('id')
  if (error) throw new Error(`Could not load listings: ${error.message}`)
  return (data ?? []) as Listing[]
}

/**
 * Put the demo flats into a search. Clears first, so pressing the button twice
 * gives twelve listings rather than twenty-four.
 */
export async function loadDemoListings(searchId: string): Promise<number> {
  const sb = getSupabase()
  const { error: clearError } = await sb.from('listings').delete().eq('search_id', searchId)
  if (clearError) throw new Error(`Could not clear listings: ${clearError.message}`)

  const rows = getDemoListings().map((raw) => {
    const mapped = mapListing(raw)
    return {
      search_id: searchId,
      source: mapped.source,
      url: mapped.url,
      rent: mapped.rent,
      area: mapped.area,
      floor: mapped.floor,
      has_lift: mapped.has_lift,
      parking: mapped.parking,
      bathrooms: mapped.bathrooms,
      pet_friendly: mapped.pet_friendly,
      extras: mapped.extras,
    }
  })

  const { error } = await sb.from('listings').insert(rows)
  if (error) throw new Error(`Could not add listings: ${error.message}`)
  return rows.length
}

/** Kick off a live fetch and remember the run against this search. */
export async function startLiveFetch(searchId: string, source: ListingSource): Promise<void> {
  const { runId, datasetId } = await startApifyRun(source, { city: 'Pune', maxResults: 15 })
  const { error } = await getSupabase()
    .from('searches')
    .update({ apify_run_id: runId, apify_dataset_id: datasetId, listings_source: source })
    .eq('id', searchId)
  if (error) throw new Error(`Could not save the run: ${error.message}`)
}

export type LiveFetch = { state: 'idle' } | { state: 'running' } | { state: 'failed'; why: string }

/**
 * Called on every status-page render while a run is outstanding. Checks the
 * run, and once it has finished, ingests the dataset and clears the run so it
 * is never ingested twice. Reading a run and its dataset costs nothing; only
 * starting one spends credits.
 */
export async function pollLiveFetch(searchId: string): Promise<LiveFetch> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('searches')
    .select('apify_run_id, apify_dataset_id, listings_source')
    .eq('id', searchId)
    .maybeSingle()
  if (error) throw new Error(`Could not read the run: ${error.message}`)
  if (!data?.apify_run_id) return { state: 'idle' }

  const state = await getRunState(data.apify_run_id)
  if (state === 'RUNNING' || state === 'READY') return { state: 'running' }

  // Clear the run first, so a failure cannot leave the page polling for ever.
  await sb
    .from('searches')
    .update({ apify_run_id: null, apify_dataset_id: null })
    .eq('id', searchId)

  if (state !== 'SUCCEEDED') return { state: 'failed', why: `the scraper run ${state.toLowerCase()}` }

  const items = await fetchRunItems(data.apify_dataset_id as string)
  if (items.length === 0) return { state: 'failed', why: 'the scraper returned no listings' }

  await sb.from('listings').delete().eq('search_id', searchId)
  const rows = items.map((raw) => {
    const mapped = mapListing(raw)
    return {
      search_id: searchId,
      source: 'apify' as const,
      url: mapped.url,
      rent: mapped.rent,
      area: mapped.area,
      floor: mapped.floor,
      has_lift: mapped.has_lift,
      parking: mapped.parking,
      bathrooms: mapped.bathrooms,
      pet_friendly: mapped.pet_friendly,
      extras: mapped.extras,
    }
  })
  const { error: insertError } = await sb.from('listings').insert(rows)
  if (insertError) throw new Error(`Could not save listings: ${insertError.message}`)
  return { state: 'idle' }
}
