"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

type Props = {
  initialQuery: string;
  routeFilter: string;
};

export function CaseSearch({ initialQuery, routeFilter }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function removeQueryFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("q")) return;
    url.searchParams.delete("q");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }

  function clearSearch() {
    setQuery("");
    removeQueryFromUrl();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    if (!value) removeQueryFromUrl();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    const value = query.trim();
    if (value) params.set("q", value);
    if (routeFilter !== "all") params.set("route", routeFilter);
    const suffix = params.toString();
    router.push(`/${suffix ? `?${suffix}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex w-full max-w-md items-center gap-2 lg:w-auto">
      <label className="sr-only" htmlFor="case-search">Search reports</label>
      <div className="relative min-w-0 flex-1 lg:w-80">
        <input
          id="case-search"
          type="search"
          name="q"
          value={query}
          onChange={handleChange}
          placeholder="Search question, report, or comment"
          className="h-10 w-full border border-ink/15 bg-white px-3 pr-9 text-sm outline-none placeholder:text-muted/70 focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="absolute inset-y-0 right-1 grid w-8 place-items-center text-lg leading-none text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-coral"
          >
            ×
          </button>
        )}
      </div>
      <button className="h-10 border border-ink/15 px-4 text-sm font-medium hover:bg-canvas focus-visible:outline-2 focus-visible:outline-coral">Search</button>
    </form>
  );
}
