import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { calcularSaldo } from "@/lib/kardex"
import { getLogoEmpresa } from "@/lib/pdf/logo"
import { KardexDocument, type MovimientoPdf } from "@/lib/pdf/kardex-document"

export async function GET(request: NextRequest) {
  // PLAN_7 · T3: el costo de compra es solo para el admin. La pantalla ya lo
  // esconde; la ruta lo vuelve a decidir porque el PDF se puede abrir directo.
  const perfil = await getPerfil()
  if (!perfil || !perfil.activo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const verCosto = perfil.rol === "admin"

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
    .select(
      verCosto
        ? "tipo_movimiento, cantidad, costo_unitario, motivo, creado_en, sucursal:sucursales(codigo, nombre)"
        : "tipo_movimiento, cantidad, motivo, creado_en, sucursal:sucursales(codigo, nombre)"
    )
    .eq("producto_id", productoId)
    .order("creado_en", { ascending: true })
    .order("consecutivo", { ascending: true })

  const movimientos = calcularSaldo((movimientosRaw ?? []) as unknown as MovimientoPdf[]).reverse()

  const buffer = await renderToBuffer(
    <KardexDocument
      producto={producto}
      movimientos={movimientos}
      logo={getLogoEmpresa()}
      mostrarCosto={verCosto}
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kardex-${producto.codigo}.pdf"`,
    },
  })
}
