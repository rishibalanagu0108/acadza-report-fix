import { checkDatabase } from "../lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  let connected = false;
  try {
    connected = await checkDatabase();
  } catch {
    // Keep the setup page available while the database is unreachable.
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-ink/10 bg-shell px-6 py-5 text-paper md:px-10">
        <span className="text-sm font-semibold tracking-[0.2em] uppercase">Acadza / Review Desk</span>
        <span className="text-xs tracking-wider uppercase text-paper/60">Project setup</span>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-20 md:px-10 md:py-28">
        <div className="mb-5 h-1 w-14 bg-coral" />
        <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Foundation</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">The review desk is taking shape.</h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
          This first screen confirms the app can reach its review database. The case queue and faculty decisions follow in their planned milestones.
        </p>
        <div className="mt-12 flex items-center gap-4 border-y border-ink/10 py-6">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-700" : "bg-red-700"}`} aria-hidden="true" />
          <span className="font-medium">Postgres</span>
          <span className="ml-auto text-sm text-muted" role="status">
            {connected ? "Connected" : "Unavailable"}
          </span>
        </div>
      </section>
    </main>
  );
}
