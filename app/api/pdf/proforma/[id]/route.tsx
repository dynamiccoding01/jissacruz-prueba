import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getLogoEmpresa } from "@/lib/pdf/logo"
import {
  ProformaDocument,
  type ProformaItemPdf,
  type ProformaPdf,
} from "@/lib/pdf/proforma-document"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: proforma } = await supabase
    .from("proformas")
    .select(
      "numero, creado_en, tipo_pago, plazo_validez_dias, glosa, subtotal, descuento_tipo, descuento_valor, impuesto_porcentaje, total, clientes(nombre, ci_nit, telefono, direccion)"
    )
    .eq("id", params.id)
    .single()

  if (!proforma) {
    return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 })
  }

  const { data: itemsRaw } = await supabase
    .from("proforma_items")
    .select(
      "cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea, productos(codigo, descripcion)"
    )
    .eq("proforma_id", params.id)

  const { data: empresa } = await supabase
    .from("configuracion_empresa")
    .select("nombre, nit, direccion, telefono")
    .eq("id", 1)
    .single()

  const cliente = (proforma as Record<string, unknown>).clientes as ProformaPdf["cliente"]
  const proformaPdf: ProformaPdf = {
    numero: proforma.numero,
    creado_en: proforma.creado_en,
    tipo_pago: proforma.tipo_pago,
    plazo_validez_dias: proforma.plazo_validez_dias,
    glosa: proforma.glosa,
    subtotal: Number(proforma.subtotal),
    descuento_tipo: proforma.descuento_tipo,
    descuento_valor: Number(proforma.descuento_valor),
    impuesto_porcentaje: Number(proforma.impuesto_porcentaje),
    total: Number(proforma.total),
    cliente,
  }

  const items: ProformaItemPdf[] = (itemsRaw ?? []).map((it) => {
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
    <ProformaDocument
      empresa={empresa ?? { nombre: "JISSACRUZ", nit: null, direccion: null, telefono: null }}
      proforma={proformaPdf}
      items={items}
      logo={getLogoEmpresa()}
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proforma-${proforma.numero}.pdf"`,
    },
  })
}
