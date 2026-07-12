import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { VentaDocument, type VentaItemPdf, type VentaPdf } from "@/lib/pdf/venta-document"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: venta } = await supabase
    .from("ventas")
    .select(
      "numero, creado_en, subtotal, descuento_tipo, descuento_valor, impuesto_porcentaje, total, clientes(nombre, ci_nit, telefono, direccion), proformas!ventas_proforma_origen_id_fkey(numero)"
    )
    .eq("id", params.id)
    .single()

  if (!venta) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
  }

  const { data: itemsRaw } = await supabase
    .from("venta_items")
    .select(
      "cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea, productos(codigo, descripcion)"
    )
    .eq("venta_id", params.id)

  const { data: empresa } = await supabase
    .from("configuracion_empresa")
    .select("nombre, nit, direccion, telefono")
    .eq("id", 1)
    .single()

  const cliente = (venta as Record<string, unknown>).clientes as VentaPdf["cliente"]
  const proformaOrigen = (venta as Record<string, unknown>).proformas as { numero: string } | null

  const ventaPdf: VentaPdf = {
    numero: venta.numero,
    creado_en: venta.creado_en,
    proforma_origen_numero: proformaOrigen?.numero ?? null,
    subtotal: Number(venta.subtotal),
    descuento_tipo: venta.descuento_tipo,
    descuento_valor: Number(venta.descuento_valor),
    impuesto_porcentaje: Number(venta.impuesto_porcentaje),
    total: Number(venta.total),
    cliente,
  }

  const items: VentaItemPdf[] = (itemsRaw ?? []).map((it) => {
    const producto = (it as Record<string, unknown>).productos as {
      codigo: string
      descripcion: string
    } | null
    return {
      codigo: producto?.codigo ?? "—",
      descripcion: producto?.descripcion ?? "",
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      descuento_tipo: it.descuento_tipo,
      descuento_valor: Number(it.descuento_valor),
      subtotal_linea: Number(it.subtotal_linea),
    }
  })

  const buffer = await renderToBuffer(
    <VentaDocument
      empresa={empresa ?? { nombre: "JISSACRUZ", nit: null, direccion: null, telefono: null }}
      venta={ventaPdf}
      items={items}
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="venta-${venta.numero}.pdf"`,
    },
  })
}
