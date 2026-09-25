/**
 * Numbered steps with a connecting line. Filled for the step you are on and
 * the ones behind it, pale for the ones ahead.
 */
export function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <ol className="flex items-center" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => {
        const done = step <= current
        return (
          <li key={step} className={step === total ? 'flex items-center' : 'flex flex-1 items-center'}>
            <span
              aria-current={step === current ? 'step' : undefined}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                done
                  ? 'bg-accent text-white shadow-[0_8px_18px_-6px_rgba(79,86,229,0.8)]'
                  : 'bg-field text-ink-faint'
              }`}
            >
              {step}
            </span>
            {step !== total && (
              <span
                className={`mx-2 h-0.5 flex-1 rounded-full ${
                  step < current ? 'bg-accent' : 'bg-line'
                }`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
