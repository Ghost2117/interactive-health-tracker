"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity, Dumbbell, Heart, LayoutDashboard, Utensils } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daily", label: "Daily", icon: Heart },
  { href: "/strength", label: "Strength", icon: Dumbbell },
  { href: "/cardio", label: "Cardio", icon: Activity },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-semibold text-sm mr-4 text-foreground">HealthTracker</span>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
