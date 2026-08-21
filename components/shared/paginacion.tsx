"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// T4 (PLAN_3): paginación con tamaño seleccionable (5/10/20/50) para las listas
// de resultados de búsqueda de productos (POS, Proforma, Cotización). Pagina en
// el cliente sobre un arreglo ya cargado. `pagina` es 0-indexado.
export function Paginacion({
  total,
  pagina,
  tamano,
  onPaginaChange,
  onTamanoChange,
  opciones = [5, 10, 20, 50],
}: {
  total: number
  pagina: number
  tamano: number
  onPaginaChange: (pagina: number) => void
  onTamanoChange: (tamano: number) => void
  opciones?: number[]
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))
  const desde = total === 0 ? 0 : pagina * tamano + 1
  const hasta = Math.min((pagina + 1) * tamano, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Productos por página</span>
        <Select value={String(tamano)} onValueChange={(v) => onTamanoChange(Number(v))}>
          <SelectTrigger className="h-8 w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular-nums">
          {desde}–{hasta} de {total}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onPaginaChange(pagina - 1)}
          disabled={pagina <= 0}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {pagina + 1} de {totalPaginas}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onPaginaChange(pagina + 1)}
          disabled={pagina >= totalPaginas - 1}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
