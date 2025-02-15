import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "~/components/ui";

import backgroundImage from "/public/background-auth.jpg";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen justify-center md:px-12 lg:px-0">
      <div className="relative z-10 flex flex-1 flex-col bg-white px-4 py-10 shadow-2xl sm:justify-center md:flex-none md:px-28 dark:bg-zinc-900">
        <div className="absolute top-4 left-4">
          <Link
            href="/"
            className="text-xl font-bold text-zinc-900 dark:text-white"
          >
            Properly
          </Link>
        </div>
        <main className="mx-auto w-full max-w-md sm:px-4 md:w-96 md:max-w-sm md:px-0">
          {children}
        </main>
        <div className="fixed bottom-4 left-4">
          <ThemeToggle />
        </div>
      </div>
      <div className="hidden sm:contents lg:relative lg:block lg:flex-1">
        <Image
          className="absolute inset-0 h-full w-full object-cover"
          src={backgroundImage}
          alt=""
          width={1600}
          height={900}
          priority
        />
      </div>
    </div>
  );
}
