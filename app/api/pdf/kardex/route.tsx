import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { calcularSaldo } from "@/lib/kardex"
import { KardexDocument } from "@/lib/pdf/kardex-document"

export async function GET(request: NextRequest) {
  const productoId = request.nextUrl.searchParams.get("producto")
  if (!productoId) {
    return NextResponse.json({ error: "Falta el parámetro producto" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: producto } = await supabase
    .from("productos")
    .select("codigo, descripcion, stock_actual")
    .eq("id", productoId)
    .single()

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  const { data: movimientosRaw } = await supabase
    .from("kardex_movimientos")
    .select("tipo_movimiento, cantidad, costo_unitario, motivo, creado_en")
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: true })
    .order("consecutivo", { ascending: true })

  const movimientos = calcularSaldo(movimientosRaw ?? []).reverse()

  const buffer = await renderToBuffer(
    <KardexDocument producto={producto} movimientos={movimientos} />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kardex-${producto.codigo}.pdf"`,
    },
  })
}
