import { cn } from "@/lib/utils"

type Estado = "sin-stock" | "bajo" | "disponible"

const ESTILOS: Record<Estado, string> = {
  "sin-stock": "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  bajo: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  disponible: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
}

const PUNTO: Record<Estado, string> = {
  "sin-stock": "bg-red-600",
  bajo: "bg-amber-500",
  disponible: "bg-green-600",
}

const ETIQUETAS: Record<Estado, string> = {
  "sin-stock": "Sin stock",
  bajo: "Stock bajo",
  disponible: "Disponible",
}

export function StockBadge({
  stockActual,
  stockMinimo,
}: {
  stockActual: number
  stockMinimo: number
}) {
  const estado: Estado =
    stockActual === 0 ? "sin-stock" : stockActual <= stockMinimo ? "bajo" : "disponible"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ESTILOS[estado]
      )}
    >
      <span className={cn("size-1.5 rounded-full", PUNTO[estado])} />
      {ETIQUETAS[estado]} ({stockActual})
    </span>
  )
}
