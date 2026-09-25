import { createSearchAction } from './actions'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">FlatSearch</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Three of you, one shared flat. Each of you fills in what you need,
          privately. Nobody sees anyone else&rsquo;s answers.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Start a search and you&rsquo;ll get one link to share with the other two.
        </p>
        <form action={createSearchAction}>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            New search
          </button>
        </form>
      </div>

      <p className="text-sm text-gray-500">
        This app shortlists flats. It never picks one &mdash; the three of you do that.
      </p>
    </main>
  )
}
