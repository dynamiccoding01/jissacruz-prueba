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

export type StockSucursalItem = {
  stock_actual: number
  sucursales: {
    codigo: string
    nombre: string
  } | null
}

export function StockBadge({
  stockActual,
  stockMinimo,
  stockSucursales,
}: {
  stockActual: number
  stockMinimo: number
  stockSucursales?: StockSucursalItem[]
}) {
  const estado: Estado =
    stockActual === 0 ? "sin-stock" : stockActual <= stockMinimo ? "bajo" : "disponible"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          ESTILOS[estado]
        )}
      >
        <span className={cn("size-1.5 rounded-full", PUNTO[estado])} />
        {ETIQUETAS[estado]} ({stockActual})
      </span>

      {stockSucursales && stockSucursales.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stockSucursales.map((item, idx) => {
            const codigoSuc = item.sucursales?.codigo ?? `Suc${idx + 1}`
            const tieneStock = item.stock_actual > 0
            return (
              <span
                key={idx}
                title={item.sucursales?.nombre ?? codigoSuc}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide border",
                  tieneStock
                    ? "bg-slate-100 text-slate-800 border-slate-200"
                    : "bg-red-50 text-red-600 border-red-200"
                )}
              >
                {codigoSuc}: {tieneStock ? item.stock_actual : "BO"}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
