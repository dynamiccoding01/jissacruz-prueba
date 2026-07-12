import { cn } from "@/lib/utils"

type Estado = "sin-stock" | "bajo" | "disponible"

const ESTILOS: Record<Estado, string> = {
  "sin-stock": "bg-red-100 text-red-700",
  bajo: "bg-amber-100 text-amber-700",
  disponible: "bg-green-100 text-green-700",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        ESTILOS[estado]
      )}
    >
      {ETIQUETAS[estado]} ({stockActual})
    </span>
  )
}
