import Link from "next/link";
import { legalDetails } from "@/lib/legal";

const legalLinks = [
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/terms", label: "תנאי שימוש" },
  { href: "/accessibility", label: "הצהרת נגישות" },
] as const;

export function LegalFooter() {
  return (
    <footer className="border-t border-line bg-surface-raised px-6 py-5 text-xs text-ink-muted">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-start">
        <p suppressHydrationWarning>
          © {new Date().getFullYear()} {legalDetails.brandName} · מופעל על ידי{" "}
          {legalDetails.operatorName}
        </p>
        <nav
          aria-label="מידע משפטי"
          className="flex flex-wrap justify-center gap-x-5 gap-y-2"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm transition-colors hover:text-ink focus-visible:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
