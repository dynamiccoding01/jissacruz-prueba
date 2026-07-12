"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsLeft, ChevronsRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { NAV_ITEMS, type Rol } from "./nav-items"

const STORAGE_KEY = "sisrep:sidebar-colapsado"

export function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(rol))
  const [colapsado, setColapsado] = useState(false)
  const [listo, setListo] = useState(false)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    setColapsado(localStorage.getItem(STORAGE_KEY) === "1")
    setListo(true)
  }, [])

  function toggle() {
    setColapsado((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        listo ? (colapsado ? "w-[4.5rem]" : "w-60") : "w-60"
      )}
    >
      <div className="flex h-24 items-center justify-center px-3 py-3">
        {!logoError ? (
          // Logo de la empresa: archivo en public/logo-empresa.png
          // Si el archivo no existe, cae al recuadro "S" de abajo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo-empresa.png"
            alt="JISSACRUZ"
            onError={() => setLogoError(true)}
            className={cn(
              "object-contain",
              colapsado ? "size-12" : "h-20 w-auto max-w-[200px]"
            )}
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-base font-bold">
              S
            </div>
            {!colapsado && (
              <span className="truncate text-xl font-bold tracking-tight">SISREP</span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={colapsado ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                colapsado && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
              )}
              <Icon className="size-[18px] shrink-0" />
              {!colapsado && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <button
          type="button"
          onClick={toggle}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-sidebar-foreground",
            colapsado && "justify-center px-0"
          )}
        >
          {colapsado ? (
            <ChevronsRight className="size-[18px] shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="size-[18px] shrink-0" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
