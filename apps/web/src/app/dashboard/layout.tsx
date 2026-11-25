import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div data-dashboard-shell className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-lg text-xl leading-none font-bold"
          >
            <Image
              src="/Spotz-profile.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-md object-contain"
            />
            <bdi dir="ltr">
              Spotz<span className="text-owner">.</span>
            </bdi>
          </Link>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 pb-10 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
        <DashboardNavigation />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-w-0 flex-col gap-6 lg:gap-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
