"use client"

import { useRef, useState } from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchClientes, type ClienteBusqueda } from "@/app/(dashboard)/clientes/actions"

export type ClienteSel = ClienteBusqueda

// Arma "NIT 1234567-A2" a partir de ci_nit + complemento (si hay).
function nitCompleto(c: { ci_nit: string | null; complemento: string | null }) {
  if (!c.ci_nit) return "Sin NIT"
  return `NIT ${c.ci_nit}${c.complemento ? `-${c.complemento}` : ""}`
}

export function BuscadorCliente({
  value,
  onChange,
  opcional = false,
}: {
  value: ClienteSel | null
  onChange: (cliente: ClienteSel | null) => void
  opcional?: boolean
}) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState<ClienteSel[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onQuery(texto: string) {
    setQuery(texto)
    setAbierto(true)
    if (debounce.current) clearTimeout(debounce.current)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      const data = await searchClientes(texto)
      setBuscando(false)
      setResultados(data)
    }, 300)
  }

  function elegir(c: ClienteSel) {
    onChange(c)
    setQuery("")
    setResultados([])
    setAbierto(false)
  }

  // Cliente ya elegido: mostramos su ficha resumida (datos de factura autocompletados).
  if (value) {
    return (
      <div className="rounded-md border border-border p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{value.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[nitCompleto(value), value.nombre_factura].filter(Boolean).join("  ·  ")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {opcional ? "Quitar" : "Cambiar"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        className="pl-8"
        placeholder={
          opcional
            ? "Buscar cliente por código/NIT o nombre (opcional)..."
            : "Buscar cliente por código/NIT o nombre..."
        }
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      {buscando && <p className="mt-1 text-xs text-muted-foreground">Buscando...</p>}
      {abierto && resultados.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {resultados.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => elegir(c)}
              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
            >
              <span className="text-sm font-medium">{c.nombre}</span>
              <span className="text-xs text-muted-foreground">
                {[nitCompleto(c), c.nombre_factura].filter(Boolean).join("  ·  ")}
              </span>
            </button>
          ))}
        </div>
      )}
      {abierto && !buscando && query.trim() && resultados.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Sin resultados. Podés crear el cliente en la sección Clientes.
        </p>
      )}
    </div>
  )
}
