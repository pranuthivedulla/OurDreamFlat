'use client'

import { useActionState, useMemo, useState } from 'react'

import { submitResponseAction, type SubmitState } from '@/app/actions'
import { Stepper } from '@/app/components/stepper'
import { ZONES, areaName, areasInZone } from '@/lib/areas'
import {
  DEALBREAKER_TYPES,
  EXTRA_TYPES,
  MAX_DEALBREAKERS,
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

const STEPS = [
  { title: 'Your budget', blurb: 'The most you will put in each month, for your share of the rent.' },
  { title: 'Where you want to live', blurb: 'Pick the side of town that suits you — near your office, or wherever you want to be.' },
  { title: 'What the flat needs', blurb: 'Three of these can be dealbreakers. Everything else is a preference.' },
  { title: 'Check and send', blurb: 'Have a look before it locks. The other two never see any of this.' },
]

export function ResponseForm({ searchId, person }: { searchId: string; person: Person }) {
  const [step, setStep] = useState(1)
  const [rentCap, setRentCap] = useState('')
  const [preferred, setPreferred] = useState<string[]>([])
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
      preferred_areas: preferred,
      dealbreakers: withStance('dealbreaker'),
      nice_to_haves: withStance('prefer'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rentCap, preferred, stances, values]
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
  const slotsSpent = Object.values(stances).filter((s) => s === 'dealbreaker').length
  const slotsFull = slotsSpent >= MAX_DEALBREAKERS
  const errors = showErrors && clientErrors.length > 0 ? clientErrors : state.errors

  // Step 1 is the only one that can hold you up: everything after it is optional.
  const canLeaveStep1 = rentCap !== ''

  function toggleArea(id: string) {
    setPreferred(preferred.includes(id) ? preferred.filter((x) => x !== id) : [...preferred, id])
  }

  function setStance(id: string, stance: Stance) {
    setStances({ ...stances, [id]: stance })
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <div className="card p-6 sm:p-10">
        <Stepper current={step} total={STEPS.length} />

        <header className="mt-8">
          <p className="field-label">{personName(person)}&rsquo;s form</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {STEPS[step - 1].title}
          </h1>
          <p className="mt-2 text-lg leading-relaxed text-ink-soft">{STEPS[step - 1].blurb}</p>
        </header>

        <form
          action={formAction}
          onSubmit={(event) => {
            setShowErrors(true)
            if (clientErrors.length > 0) event.preventDefault()
          }}
          className="mt-8"
        >
          <input type="hidden" name="searchId" value={searchId} />
          <input type="hidden" name="person" value={person} />
          <input type="hidden" name="payload" value={JSON.stringify(input)} />

          {step === 1 && (
            <section>
              <p className="field-label">Most rent per month</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight">
                {rentCap === '' ? (
                  <span className="text-ink-faint">Not set yet</span>
                ) : (
                  `₹${Number(rentCap).toLocaleString('en-IN')}`
                )}
              </p>

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
                className="mt-5 w-full"
              />

              <div className="mt-1 flex justify-between text-xs font-medium text-ink-faint">
                <span>₹{RENT_MIN.toLocaleString('en-IN')}</span>
                <span>
                  {rentCap === '' ? 'Drag to choose' : 'Your share, not the whole flat'}
                </span>
                <span>₹{RENT_MAX.toLocaleString('en-IN')}</span>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <p className="field-label">Preferred zones</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ZONES.map((zone) => {
                  const ids = areasInZone(zone.id).map((a) => a.id)
                  const all = ids.every((id) => preferred.includes(id))
                  const some = !all && ids.some((id) => preferred.includes(id))
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() =>
                        setPreferred(
                          all
                            ? preferred.filter((id) => !ids.includes(id))
                            : [...new Set([...preferred, ...ids])]
                        )
                      }
                      aria-pressed={all}
                      title={zone.hint}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        all
                          ? 'border-accent bg-accent text-white shadow-[0_8px_18px_-8px_rgba(79,86,229,0.8)]'
                          : some
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-field text-ink-soft hover:border-ink-faint'
                      }`}
                    >
                      {zone.name}
                      {some && <span className="ml-1 text-xs font-medium">some</span>}
                    </button>
                  )
                })}
              </div>

              <p className="mt-4 text-sm text-ink-soft">
                These rank flats higher. They never drop one, so picking none is fine.
              </p>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-accent">
                  Pick single areas instead
                </summary>
                <div className="mt-4 space-y-4">
                  {ZONES.map((zone) => (
                    <div key={zone.id}>
                      <p className="field-label">{zone.name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                        {areasInZone(zone.id).map((area) => (
                          <label
                            key={area.id}
                            className="flex items-center gap-2 text-sm text-ink-soft"
                          >
                            <input
                              type="checkbox"
                              checked={preferred.includes(area.id)}
                              onChange={() => toggleArea(area.id)}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                            {area.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="flex items-center justify-between">
                <p className="field-label">Dealbreakers used</p>
                <p className="text-sm font-bold">
                  <span className={slotsFull ? 'text-negative' : 'text-accent'}>{slotsSpent}</span>
                  <span className="text-ink-faint"> / {MAX_DEALBREAKERS}</span>
                </p>
              </div>

              <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {DEALBREAKER_TYPES.map((spec) => (
                  <ParamRow
                    key={spec.id}
                    label={spec.label}
                    stance={stances[spec.id] ?? 'none'}
                    answered={stances[spec.id] !== undefined}
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
                    answered={stances[spec.id] !== undefined}
                    onStance={(s) => setStance(spec.id, s)}
                    dealbreakerAllowed={false}
                    dealbreakerDisabled
                    numberValue={null}
                    onNumber={() => {}}
                  />
                ))}
              </div>

              <p className="mt-3 text-sm text-ink-soft">
                The five above the line are the only ones that can be dealbreakers. The
                rest rank flats, they never drop one.
              </p>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5">
              <Summary label="Most rent per month">
                {rentCap === '' ? 'Not set' : `₹${Number(rentCap).toLocaleString('en-IN')}`}
              </Summary>
              <Summary label="Areas you picked">
                {preferred.length === 0
                  ? 'None — anywhere is fine'
                  : preferred.map(areaName).join(', ')}
              </Summary>
              <Summary label={`Dealbreakers (${input.dealbreakers.length})`}>
                {input.dealbreakers.length === 0
                  ? 'None'
                  : input.dealbreakers
                      .map(
                        (d) =>
                          `${NICE_TO_HAVE_TYPES.find((t) => t.id === d.type)?.label ?? d.type}${d.value ? ` (${d.value})` : ''}`
                      )
                      .join(', ')}
              </Summary>
              <Summary label={`Preferences (${input.nice_to_haves.length})`}>
                {input.nice_to_haves.length === 0
                  ? 'None'
                  : input.nice_to_haves
                      .map((n) => NICE_TO_HAVE_TYPES.find((t) => t.id === n.type)?.label ?? n.type)
                      .join(', ')}
              </Summary>
              <p className="text-sm text-ink-soft">
                Once you send this it locks. We never ask why you need any of it.
              </p>
            </section>
          )}

          {errors.length > 0 && (
            <ul className="mt-6 space-y-1 rounded-2xl border border-[color:var(--negative)]/30 bg-[color:var(--negative)]/5 p-4 text-sm font-medium text-negative">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex items-center justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-quiet">
                Back
              </button>
            ) : (
              <span />
            )}

            {step < STEPS.length ? (
              <button
                type="button"
                disabled={step === 1 && !canLeaveStep1}
                onClick={() => setStep(step + 1)}
                className="btn-primary"
              >
                Continue
              </button>
            ) : (
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? 'Sending…' : 'Send my answers'}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <p className="mt-1 font-semibold">{children}</p>
    </div>
  )
}

/**
 * One parameter, one decision. Extras render two buttons rather than three,
 * because the brief fixes the dealbreaker list at five and they are not on it.
 */
function ParamRow({
  label,
  stance,
  answered,
  onStance,
  dealbreakerAllowed,
  dealbreakerDisabled,
  numberValue,
  onNumber,
}: {
  label: string
  stance: Stance
  /** False until she picks something, so an untouched row looks untouched. */
  answered: boolean
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
    dealbreaker: 'bg-[color:var(--negative)] text-white border-transparent',
    prefer: 'bg-[color:var(--positive)] text-white border-transparent',
    none: 'bg-ink text-white border-transparent',
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4">
      <span className="text-sm font-semibold">
        {label}
        {numberValue !== null && stance !== 'none' && (
          <input
            type="number"
            min={1}
            step={1}
            value={numberValue}
            onChange={(e) => onNumber(e.target.value)}
            aria-label={`${label} — how many`}
            className="ml-2 w-16 rounded-lg border border-line bg-field px-2 py-1 text-sm"
          />
        )}
      </span>

      <div className="flex gap-1.5" role="group" aria-label={label}>
        {options.map((option) => {
          const active = answered && stance === option.id
          const disabled = option.id === 'dealbreaker' && dealbreakerDisabled
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onStance(option.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-35 ${
                active ? tone[option.id] : 'border-line bg-field text-ink-soft hover:border-ink-faint'
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
