import { createClient } from "@/lib/supabase/server"
import { calcularSaldo } from "@/lib/kardex"
import { KardexView, type MovimientoConSaldo } from "./kardex-view"

export default async function KardexPage({
  searchParams,
}: {
  searchParams: { producto?: string }
}) {
  const productoId = searchParams.producto

  if (!productoId) {
    return (
      <p className="text-muted-foreground">
        Seleccioná un producto desde Inventario para ver su Kardex.
      </p>
    )
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
    .select("id, tipo_movimiento, cantidad, costo_unitario, motivo, creado_en, sucursal:sucursales(codigo, nombre)")
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: true })
    .order("consecutivo", { ascending: true })

  // El kardex mezcla TODAS las sucursales: el saldo acumulado es el total del
  // producto y por eso cada fila muestra a que sucursal pertenece.
  const movimientos = calcularSaldo((movimientosRaw ?? []) as unknown as MovimientoConSaldo[])

  return <KardexView producto={producto} movimientos={movimientos} />
}
