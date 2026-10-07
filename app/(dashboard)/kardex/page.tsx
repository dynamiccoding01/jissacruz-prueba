import { createClient } from "@/lib/supabase/server"
import { requireRol } from "@/lib/auth/session"
import { calcularSaldo } from "@/lib/kardex"
import { KardexExplorer } from "./kardex-explorer"
import { KardexView, type MovimientoConSaldo } from "./kardex-view"

// PLAN_7 · T3: el Kardex es un módulo propio. Sin producto elegido muestra su
// buscador; con `?producto=` muestra los movimientos (así sigue funcionando el
// atajo "Ver Kardex" de Inventario).
export default async function KardexPage({
  searchParams,
}: {
  searchParams: { producto?: string }
}) {
  const perfil = await requireRol(["admin", "vendedor", "cajero"])
  // El costo de compra es solo para el admin: a los demás roles ni se les pide
  // a la base (no alcanza con esconder la columna).
  const verCosto = perfil.rol === "admin"
  const productoId = searchParams.producto

  if (!productoId) {
    return <KardexExplorer />
  }

  const supabase = await createClient()

  const { data: producto } = await supabase
    .from("productos")
    .select("id, codigo, descripcion, stock_actual, stock_minimo")
    .eq("id", productoId)
    .single()

  if (!producto) {
    return <p className="text-muted-foreground">Producto no encontrado.</p>
  }

  const { data: movimientosRaw } = await supabase
    .from("kardex_movimientos")
    .select(
      verCosto
        ? "id, tipo_movimiento, cantidad, costo_unitario, motivo, creado_en, sucursal:sucursales(codigo, nombre)"
        : "id, tipo_movimiento, cantidad, motivo, creado_en, sucursal:sucursales(codigo, nombre)"
    )
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: true })
    .order("consecutivo", { ascending: true })

  // El kardex mezcla TODAS las sucursales: el saldo acumulado es el total del
  // producto y por eso cada fila muestra a que sucursal pertenece.
  const movimientos = calcularSaldo((movimientosRaw ?? []) as unknown as MovimientoConSaldo[])

  return <KardexView producto={producto} movimientos={movimientos} verCosto={verCosto} />
}
