"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS, type Rol } from "./nav-items"

export function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(rol))

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-4 text-lg font-bold">SISREP</div>
      <nav className="flex-1 space-y-1 px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
