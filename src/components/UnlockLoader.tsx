"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Fetching article…",
  "Searching Internet Archive…",
  "Extracting readable text…",
];

export function UnlockLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const interval = setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="w-full rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 dark:bg-neutral-900/60"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="relative flex h-5 w-5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-25" />
          <span className="relative inline-flex h-5 w-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </span>
        <p className="text-sm font-medium">{STEPS[step]}</p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="unlock-progress-bar h-full rounded-full bg-[var(--accent)]" />
      </div>

      <p className="mt-3 text-center text-xs text-[var(--muted)]">
        Usually takes a few seconds
      </p>
    </div>
  );
}
