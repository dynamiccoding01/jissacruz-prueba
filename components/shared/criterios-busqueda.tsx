"use client"

import { cn } from "@/lib/utils"

// Criterios que el usuario puede marcar para acotar la busqueda de productos.
// Los `id` coinciden exactamente con los que espera la RPC fn_buscar_productos
// (script supabase/10_busqueda_por_criterio.sql). No renombrar sin actualizar el SQL.
export type CampoBusqueda =
  | "codigo"
  | "equivalente"
  | "descripcion"
  | "linea_marca"
  | "vehiculo"

export const CAMPOS_BUSQUEDA: { id: CampoBusqueda; label: string }[] = [
  { id: "codigo", label: "Código" },
  { id: "equivalente", label: "Equivalente" },
  { id: "descripcion", label: "Descripción" },
  { id: "linea_marca", label: "Línea / Marca" },
  { id: "vehiculo", label: "Vehículo" },
]

// Criterio marcado por defecto (igual que el sistema de referencia del cliente).
export const CAMPOS_DEFECTO: CampoBusqueda[] = ["codigo"]

/**
 * Fila de casillas para elegir por que campos se busca un producto.
 * Multi-seleccion: la busqueda trae lo que coincida en cualquiera de los
 * criterios marcados. Si no hay ninguno marcado, la RPC busca en todos.
 */
export function CriteriosBusqueda({
  value,
  onChange,
  className,
}: {
  value: CampoBusqueda[]
  onChange: (campos: CampoBusqueda[]) => void
  className?: string
}) {
  function toggle(id: CampoBusqueda) {
    onChange(value.includes(id) ? value.filter((c) => c !== id) : [...value, id])
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">Buscar por:</span>
      {CAMPOS_BUSQUEDA.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer select-none items-center gap-1.5 text-sm"
        >
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
          {c.label}
        </label>
      ))}
    </div>
  )
}
