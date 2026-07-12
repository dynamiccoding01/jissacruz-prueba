"use client"

import { usePathname } from "next/navigation"
import { ChevronDown, LogOut } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth/actions"
import { NAV_ITEMS, type Rol } from "./nav-items"

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("")
}

export function Header({ nombre, rol }: { nombre: string; rol: Rol }) {
  const pathname = usePathname()
  const seccion = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  )
  const Icon = seccion?.icon

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-2 text-foreground">
        {Icon && <Icon className="size-[18px] text-muted-foreground" />}
        <h1 className="text-base font-semibold">{seccion?.label ?? "SISREP"}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-muted">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {iniciales(nombre)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {nombre}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{nombre}</p>
            <p className="text-xs capitalize text-muted-foreground">{rol}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
            <form action={signOut} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2 text-left">
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
