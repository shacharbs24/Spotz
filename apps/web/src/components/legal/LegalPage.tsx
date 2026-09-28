import Link from "next/link";
import type { ReactNode } from "react";
import { legalDetails } from "@/lib/legal";

interface LegalPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}

export function LegalPage({ eyebrow, title, intro, children }: LegalPageProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 bg-surface px-5 py-10 sm:px-8 sm:py-16"
    >
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-line bg-surface-raised p-6 shadow-soft sm:p-10">
        <header className="border-b border-line pb-7">
          <Link
            href="/"
            className="mb-8 inline-flex rounded-sm text-sm font-medium text-owner transition-colors hover:text-owner/75"
          >
            חזרה ל־Spotz
          </Link>
          <p className="mb-2 text-sm font-semibold text-owner">{eyebrow}</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted">
            {intro}
          </p>
          <p className="mt-4 text-xs text-ink-muted">
            עודכן לאחרונה: {legalDetails.lastUpdated}
          </p>
        </header>

        <div className="mt-8 space-y-9 text-sm leading-7 text-ink-muted [&_a]:font-medium [&_a]:text-owner [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ps-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pe-5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pe-5">
          {children}
        </div>
      </article>
    </main>
  );
}
