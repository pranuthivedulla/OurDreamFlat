'use client'

import { useActionState, useMemo, useState } from 'react'

import { submitResponseAction, type SubmitState } from '@/app/actions'
import { AREAS } from '@/lib/areas'
import {
  DEALBREAKER_TYPES,
  EXTRA_TYPES,
  MAX_DEALBREAKERS,
  MAX_PLACES,
  NICE_TO_HAVE_TYPES,
  personName,
  validateResponse,
  type Person,
  type ResponseInput,
} from '@/lib/constraints'

/** What a person said about one parameter. Nothing is stored for 'none'. */
type Stance = 'dealbreaker' | 'prefer' | 'none'

// Bounds for the rent slider. A per-person share, not the whole flat's rent.
const RENT_MIN = 5000
const RENT_MAX = 40000
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
  // One stance per parameter, rather than two separate tick-lists that both
  // contained the same rows.
  const [stances, setStances] = useState<Record<string, Stance>>({})
  const [values, setValues] = useState<Record<string, string>>({})
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
      dealbreakers: withStance('dealbreaker'),
      nice_to_haves: withStance('prefer'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rentCap, noGo, places, stances, values]
  )

  function withStance(stance: Stance) {
    return Object.entries(stances)
      .filter(([, s]) => s === stance)
      .map(([id]) => ({
        type: id,
        value: NICE_TO_HAVE_TYPES.find((t) => t.id === id)?.needsNumber
          ? parseInt(values[id] ?? '', 10)
          : null,
      }))
  }

  // The same validator the server action runs. Enforced here so the UI can stop
  // a bad submit, and again on the server so a direct POST cannot get past it.
  const clientErrors = validateResponse(input)
  const slotsSpent =
    Object.values(stances).filter((s) => s === 'dealbreaker').length +
    places.filter((p) => p.priority === 'dealbreaker').length
  const slotsFull = slotsSpent >= MAX_DEALBREAKERS
  const errors = showErrors && clientErrors.length > 0 ? clientErrors : state.errors

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function setStance(id: string, stance: Stance) {
    setStances({ ...stances, [id]: stance })
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
          <h2 className="text-lg font-medium">What the flat needs</h2>
          <p className="text-sm text-gray-500">
            For each one: a dealbreaker drops any flat that fails it, preferred just
            ranks the flats that survive, and don&rsquo;t care is ignored entirely.
          </p>
          <p className="text-sm font-medium">
            Dealbreakers used: {slotsSpent} of {MAX_DEALBREAKERS}
            {slotsFull && (
              <span className="ml-2 font-normal text-gray-500">
                &mdash; all spent. Drop one to mark another.
              </span>
            )}
          </p>

          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {DEALBREAKER_TYPES.map((spec) => (
              <ParamRow
                key={spec.id}
                label={spec.label}
                stance={stances[spec.id] ?? 'none'}
                onStance={(s) => setStance(spec.id, s)}
                dealbreakerAllowed
                dealbreakerDisabled={slotsFull && stances[spec.id] !== 'dealbreaker'}
                numberValue={spec.needsNumber ? (values[spec.id] ?? '') : null}
                onNumber={(v) => setValues({ ...values, [spec.id]: v })}
              />
            ))}
            {EXTRA_TYPES.map((spec) => (
              <ParamRow
                key={spec.id}
                label={spec.label}
                stance={stances[spec.id] ?? 'none'}
                onStance={(s) => setStance(spec.id, s)}
                dealbreakerAllowed={false}
                dealbreakerDisabled
                numberValue={null}
                onNumber={() => {}}
              />
            ))}
          </div>

          <p className="text-xs text-gray-500">
            The five above the line are the only ones that can be dealbreakers. The
            rest rank flats, they never drop one.
          </p>
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

/**
 * One parameter, one decision. Extras render two buttons rather than three,
 * because the brief fixes the dealbreaker list at five and they are not on it.
 */
function ParamRow({
  label,
  stance,
  onStance,
  dealbreakerAllowed,
  dealbreakerDisabled,
  numberValue,
  onNumber,
}: {
  label: string
  stance: Stance
  onStance: (s: Stance) => void
  dealbreakerAllowed: boolean
  dealbreakerDisabled: boolean
  numberValue: string | null
  onNumber: (v: string) => void
}) {
  const options: { id: Stance; text: string }[] = [
    ...(dealbreakerAllowed ? [{ id: 'dealbreaker' as Stance, text: 'Dealbreaker' }] : []),
    { id: 'prefer', text: 'Preferred' },
    { id: 'none', text: "Don't care" },
  ]

  const tone: Record<Stance, string> = {
    dealbreaker: 'bg-red-600 text-white border-red-600',
    prefer: 'bg-emerald-600 text-white border-emerald-600',
    none: 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white',
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <span className="text-sm">
        {label}
        {numberValue !== null && stance !== 'none' && (
          <input
            type="number"
            min={1}
            step={1}
            value={numberValue}
            onChange={(e) => onNumber(e.target.value)}
            aria-label={`${label} — how many`}
            className="ml-2 w-16 rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-transparent"
          />
        )}
      </span>

      <div className="flex gap-1" role="group" aria-label={label}>
        {options.map((option) => {
          const active = stance === option.id
          const disabled = option.id === 'dealbreaker' && dealbreakerDisabled
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onStance(option.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                active
                  ? tone[option.id]
                  : 'border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {option.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
