import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export function DashboardHeader() {
  return (
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
  );
}
