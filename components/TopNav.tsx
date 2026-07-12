"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Recipes" },
  { href: "/this-week", label: "This Week" },
  { href: "/shopping", label: "Shopping" },
  { href: "/kitchen", label: "My Kitchen" },
  { href: "/add", label: "+ Add Recipe" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto bg-surface border-b border-border sticky top-0 z-20">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-shrink-0 whitespace-nowrap px-4 h-12 flex items-center text-[13px] font-medium border-b-2 transition-colors ${
              isActive
                ? "text-teal border-teal"
                : "text-ink-light border-transparent hover:text-ink-mid"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
