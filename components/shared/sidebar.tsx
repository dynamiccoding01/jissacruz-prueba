"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Pin, PinOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { NAV_GROUPS, type Rol } from "./nav-items"

const STORAGE_KEY = "sisrep:sidebar-fijado"

export function Sidebar({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const [fijado, setFijado] = useState(false)
  const [hover, setHover] = useState(false)
  const [listo, setListo] = useState(false)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    setFijado(localStorage.getItem(STORAGE_KEY) === "1")
    setListo(true)
  }, [])

  // El menú está expandido si el usuario lo fijó o si el cursor está encima.
  const expandido = listo && (fijado || hover)

  function toggleFijado() {
    setFijado((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }

  // Solo los grupos con al menos un ítem visible para el rol.
  const grupos = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(rol)),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      {/* Espaciador: reserva el ancho en el layout. Angosto por defecto; ancho
          solo si el menú está fijado (cuando se abre por hover, flota encima). */}
      <div
        className={cn(
          "shrink-0 transition-[width] duration-200",
          fijado ? "w-64" : "w-[4.5rem]"
        )}
        aria-hidden
      />

      {/* Panel real: fijo a la izquierda; se expande al pasar el cursor. */}
      <aside
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          expandido ? "w-64" : "w-[4.5rem]",
          // sombra solo cuando flota sobre el contenido (abierto por hover, no fijado)
          expandido && !fijado && "shadow-2xl shadow-black/40"
        )}
      >
        {/* Logo */}
        <div className="flex h-24 shrink-0 items-center justify-center px-3 py-3">
          {!logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo-empresa.png"
              alt="JISSACRUZ"
              onError={() => setLogoError(true)}
              className={cn("object-contain transition-all", expandido ? "h-20 w-auto max-w-[200px]" : "size-11")}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-base font-bold">
                S
              </div>
              {expandido && <span className="truncate text-xl font-bold tracking-tight">SISREP</span>}
            </div>
          )}
        </div>

        {/* Navegación agrupada */}
        <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2.5 py-3">
          {grupos.map((grupo, gi) => (
            <div key={grupo.label} className="space-y-0.5">
              {expandido ? (
                <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {grupo.label}
                </p>
              ) : gi > 0 ? (
                <div className="mx-auto my-2 h-px w-6 rounded-full bg-sidebar-foreground/15" />
              ) : null}

              {grupo.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/")
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!expandido ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      !expandido && "justify-center px-0",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
                    )}
                    <Icon className="size-[18px] shrink-0" />
                    {expandido && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Fijar / soltar el menú */}
        <div className="shrink-0 border-t border-sidebar-border p-2.5">
          <button
            type="button"
            onClick={toggleFijado}
            title={fijado ? "Soltar menú (auto-ocultar)" : "Fijar menú abierto"}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-sidebar-foreground",
              !expandido && "justify-center px-0"
            )}
          >
            {fijado ? (
              <PinOff className="size-[18px] shrink-0" />
            ) : (
              <Pin className="size-[18px] shrink-0" />
            )}
            {expandido && <span>{fijado ? "Soltar menú" : "Fijar menú"}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
