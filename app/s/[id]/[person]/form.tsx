'use client'

import { useActionState, useMemo, useState } from 'react'

import { submitResponseAction, type SubmitState } from '@/app/actions'
import { AREAS } from '@/lib/areas'
import {
  DEALBREAKER_TYPES,
  MAX_DEALBREAKERS,
  MAX_PLACES,
  NICE_TO_HAVE_TYPES,
  personName,
  validateResponse,
  type Person,
  type ResponseInput,
} from '@/lib/constraints'

// Bounds for the rent slider. A per-person share, not the whole flat's rent.
const RENT_MIN = 5000
const RENT_MAX = 60000
const RENT_STEP = 1000
const RENT_DEFAULT = 20000

type PlaceDraft = {
  label: string
  area: string
  maxMins: string
  priority: 'dealbreaker' | 'nice_to_have'
}

export function ResponseForm({ searchId, person }: { searchId: string; person: Person }) {
  const [rentCap, setRentCap] = useState('')
  const [noGo, setNoGo] = useState<string[]>([])
  const [places, setPlaces] = useState<PlaceDraft[]>([])
  const [dbChosen, setDbChosen] = useState<string[]>([])
  const [dbValues, setDbValues] = useState<Record<string, string>>({})
  const [niceChosen, setNiceChosen] = useState<string[]>([])
  const [niceValues, setNiceValues] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitResponseAction,
    { errors: [] }
  )

  const input: ResponseInput = useMemo(
    () => ({
      rent_cap: parseInt(rentCap, 10),
      no_go_areas: noGo,
      must_be_near: places.map((p) => ({
        label: p.label.trim(),
        area: p.area,
        max_mins: parseInt(p.maxMins, 10),
        priority: p.priority,
      })),
      dealbreakers: dbChosen.map((id) => ({
        type: id,
        value: DEALBREAKER_TYPES.find((d) => d.id === id)?.needsNumber
          ? parseInt(dbValues[id] ?? '', 10)
          : null,
      })),
      nice_to_haves: niceChosen.map((id) => ({
        type: id,
        value: NICE_TO_HAVE_TYPES.find((n) => n.id === id)?.needsNumber
          ? parseInt(niceValues[id] ?? '', 10)
          : null,
      })),
    }),
    [rentCap, noGo, places, dbChosen, dbValues, niceChosen, niceValues]
  )

  // The same validator the server action runs. Enforced here so the UI can stop
  // a bad submit, and again on the server so a direct POST cannot get past it.
  const clientErrors = validateResponse(input)
  const slotsSpent = dbChosen.length + places.filter((p) => p.priority === 'dealbreaker').length
  const slotsFull = slotsSpent >= MAX_DEALBREAKERS
  const errors = showErrors && clientErrors.length > 0 ? clientErrors : state.errors

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function updatePlace(index: number, patch: Partial<PlaceDraft>) {
    setPlaces(places.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{personName(person)}&rsquo;s form</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Only you see this. The other two never see your answers &mdash; just that you
        have submitted.
      </p>

      <form
        action={formAction}
        onSubmit={(event) => {
          setShowErrors(true)
          if (clientErrors.length > 0) event.preventDefault()
        }}
        className="mt-10 space-y-10"
      >
        <input type="hidden" name="searchId" value={searchId} />
        <input type="hidden" name="person" value={person} />
        <input type="hidden" name="payload" value={JSON.stringify(input)} />

        <section className="space-y-3">
          <h2 className="text-lg font-medium">The most rent you will pay</h2>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            {rentCap === '' ? (
              <p className="text-2xl font-semibold text-gray-400">Not set yet</p>
            ) : (
              <p className="text-2xl font-semibold">
                &#8377;{Number(rentCap).toLocaleString('en-IN')}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  a month, your share
                </span>
              </p>
            )}

            <input
              type="range"
              min={RENT_MIN}
              max={RENT_MAX}
              step={RENT_STEP}
              // Sits mid-range until she moves it, but rentCap stays empty so an
              // untouched slider cannot be submitted as if it were a real answer.
              value={rentCap === '' ? RENT_DEFAULT : rentCap}
              onChange={(e) => setRentCap(e.target.value)}
              aria-label="The most rent you will pay per month"
              className="mt-3 w-full accent-gray-900 dark:accent-white"
            />

            <div className="flex justify-between text-xs text-gray-500">
              <span>&#8377;{RENT_MIN.toLocaleString('en-IN')}</span>
              <span>
                {rentCap === '' ? 'Drag to choose your cap' : 'Your share, not the whole flat'}
              </span>
              <span>&#8377;{RENT_MAX.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Areas you will not consider</h2>
          <p className="text-sm text-gray-500">
            Pick from the list. A flat in any of these is dropped for everyone.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {AREAS.map((area) => (
              <label key={area.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={noGo.includes(area.id)}
                  onChange={() => toggle(noGo, setNoGo, area.id)}
                  className="h-4 w-4"
                />
                {area.name}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Places you need to be near</h2>
          <p className="text-sm text-gray-500">
            Up to {MAX_PLACES}. Travel times are estimates from an area-to-area table,
            not a live route.
          </p>

          {places.map((place, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={place.label}
                  onChange={(e) => updatePlace(index, { label: e.target.value })}
                  placeholder="office"
                  maxLength={60}
                  className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
                />
                <span className="text-sm text-gray-500">in</span>
                <select
                  value={place.area}
                  onChange={(e) => updatePlace(index, { area: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
                >
                  <option value="">Pick an area</option>
                  {AREAS.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-500">within</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={place.maxMins}
                  onChange={(e) => updatePlace(index, { maxMins: e.target.value })}
                  placeholder="45"
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
                />
                <span className="text-sm text-gray-500">mins</span>
                <button
                  type="button"
                  onClick={() => setPlaces(places.filter((_, i) => i !== index))}
                  className="ml-auto text-sm text-gray-500 underline underline-offset-4"
                >
                  Remove
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`priority-${index}`}
                    checked={place.priority === 'dealbreaker'}
                    disabled={place.priority !== 'dealbreaker' && slotsFull}
                    onChange={() => updatePlace(index, { priority: 'dealbreaker' })}
                    className="h-4 w-4"
                  />
                  Dealbreaker (spends a slot)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`priority-${index}`}
                    checked={place.priority === 'nice_to_have'}
                    onChange={() => updatePlace(index, { priority: 'nice_to_have' })}
                    className="h-4 w-4"
                  />
                  Nice to have
                </label>
              </div>
            </div>
          ))}

          {places.length < MAX_PLACES && (
            <button
              type="button"
              onClick={() =>
                setPlaces([
                  ...places,
                  {
                    label: '',
                    area: '',
                    maxMins: '',
                    priority: slotsFull ? 'nice_to_have' : 'dealbreaker',
                  },
                ])
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-700"
            >
              Add a place
            </button>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Your dealbreakers</h2>
          <p className="text-sm text-gray-500">
            {MAX_DEALBREAKERS} at most, including any place above marked a dealbreaker.
            You have used {slotsSpent} of {MAX_DEALBREAKERS}. Choosing is the point
            &mdash; a flat that breaks any of these is dropped.
          </p>
          <div className="space-y-2">
            {DEALBREAKER_TYPES.map((spec) => {
              const chosen = dbChosen.includes(spec.id)
              return (
                <label key={spec.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chosen}
                    disabled={!chosen && slotsFull}
                    onChange={() => toggle(dbChosen, setDbChosen, spec.id)}
                    className="h-4 w-4"
                  />
                  <span className={!chosen && slotsFull ? 'text-gray-400' : ''}>{spec.label}</span>
                  {spec.needsNumber && chosen && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={dbValues[spec.id] ?? ''}
                      onChange={(e) => setDbValues({ ...dbValues, [spec.id]: e.target.value })}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-transparent"
                    />
                  )}
                </label>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Nice to have</h2>
          <p className="text-sm text-gray-500">
            As many as you like. These rank the flats that survive; they never drop one.
          </p>
          <div className="space-y-2">
            {NICE_TO_HAVE_TYPES.map((spec) => {
              const chosen = niceChosen.includes(spec.id)
              return (
                <label key={spec.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chosen}
                    onChange={() => toggle(niceChosen, setNiceChosen, spec.id)}
                    className="h-4 w-4"
                  />
                  {spec.label}
                  {spec.needsNumber && chosen && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={niceValues[spec.id] ?? ''}
                      onChange={(e) => setNiceValues({ ...niceValues, [spec.id]: e.target.value })}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-transparent"
                    />
                  )}
                </label>
              )
            })}
          </div>
        </section>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white transition hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {pending ? 'Submitting…' : 'Submit my form'}
        </button>
        <p className="text-xs text-gray-500">
          Once you submit, this form locks. We never ask why you need any of this.
        </p>
      </form>
    </main>
  )
}
