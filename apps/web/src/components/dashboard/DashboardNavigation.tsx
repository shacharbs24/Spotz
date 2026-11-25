"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const calendar = [
  { href: "/dashboard", label: "היום" },
  { href: "/dashboard/appointments", label: "כל התורים" },
  { href: "/dashboard/history", label: "היסטוריית תורים" },
];

const business = [
  { href: "/dashboard/services", label: "שירותים" },
  { href: "/dashboard/business", label: "פרטי העסק" },
  { href: "/dashboard/availability", label: "שעות פעילות" },
  { href: "/dashboard/blocked", label: "חסימות ביומן" },
];

const mobilePrimary = [calendar[0], calendar[1], business[0]];
const mobileMore = [calendar[2], ...business.slice(1)];
type Destination = (typeof calendar)[number];

function NavigationLink({
  item,
  pathname,
  compact = false,
  onSelect,
}: {
  item: Destination;
  pathname: string;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-lg py-2 text-sm transition-colors ${
        compact ? "justify-center px-1.5 text-center" : "px-3"
      } ${
        active
          ? "bg-owner-soft font-semibold text-owner"
          : "font-medium text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {item.label}
    </Link>
  );
}

export function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 min-w-0 bg-surface py-2 lg:top-6 lg:self-start lg:py-0">
      <nav
        aria-label="ניווט בלוח הבקרה"
        className="hidden rounded-xl border border-line bg-surface-raised p-3 lg:block"
      >
        {[
          { label: "יומן", items: calendar },
          { label: "ניהול העסק", items: business },
        ].map(({ label, items }) => (
          <div
            key={label}
            className="space-y-1.5 not-first:mt-3 not-first:border-t not-first:border-line not-first:pt-3"
          >
            <p className="px-3 py-1 text-sm font-semibold text-ink">{label}</p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavigationLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <nav
        aria-label="ניווט בלוח הבקרה"
        className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface-raised p-1 lg:hidden"
      >
        {mobilePrimary.map((item) => (
          <NavigationLink
            key={item.href}
            item={item}
            pathname={pathname}
            compact
          />
        ))}
        <MobileMoreNavigation key={pathname} pathname={pathname} />
      </nav>
    </div>
  );
}

function MobileMoreNavigation({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const extraPage = mobileMore.some((item) => item.href === pathname);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePress, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress, true);
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative"
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        } else if (event.key === "Tab") {
          requestAnimationFrame(() => {
            if (!menuRef.current?.contains(document.activeElement))
              setOpen(false);
          });
        }
      }}
    >
      <button
        type="button"
        ref={buttonRef}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-medium transition-colors ${
          open || extraPage
            ? "bg-owner-soft font-semibold text-owner"
            : "text-ink-muted hover:bg-surface hover:text-ink"
        }`}
      >
        עוד
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={open ? "rotate-180" : undefined}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 mt-2 max-h-[50dvh] w-52 space-y-0.5 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-raised p-1.5"
      >
        {mobileMore.map((item) => (
          <li key={item.href}>
            <NavigationLink
              item={item}
              pathname={pathname}
              onSelect={() => {
                setOpen(false);
                if (item.href === pathname) buttonRef.current?.focus();
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
