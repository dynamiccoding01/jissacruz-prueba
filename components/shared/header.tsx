"use client"

import { usePathname } from "next/navigation"

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

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <h1 className="text-base font-semibold">{seccion?.label ?? "SISREP"}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {iniciales(nombre)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{nombre}</p>
            <p className="text-xs capitalize text-muted-foreground">{rol}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={signOut} className="w-full">
              <button type="submit" className="w-full text-left">
                Cerrar sesión
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
