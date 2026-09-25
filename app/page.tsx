import { createSearchAction } from './actions'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 sm:py-16">
      <div className="card w-full p-8 sm:p-12">
        <p className="field-label">FlatSearch</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Three of you, one flat.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Each of you says what you need, privately. Nobody sees anyone
          else&rsquo;s answers. You come out with a handful of flats worth
          discussing.
        </p>

        <form action={createSearchAction} className="mt-10">
          <button type="submit" className="btn-primary">
            Start a new search
          </button>
        </form>

        <p className="mt-8 text-sm text-ink-faint">
          The app shortlists. It never picks &mdash; the three of you do that.
        </p>
      </div>
    </main>
  )
}
