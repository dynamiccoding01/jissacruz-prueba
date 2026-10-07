import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getConfiguracionEmpresa } from "@/lib/datos-cacheados"
import { getLogoEmpresa } from "@/lib/pdf/logo"
import { resolverUnidadCorta } from "@/lib/unidades-server"
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
      "numero, creado_en, tipo_pago, plazo_validez_dias, tiempo_entrega_dias, glosa, subtotal, descuento_tipo, descuento_valor, impuesto_porcentaje, total, clientes(nombre, ci_nit, telefono, direccion), sucursal:sucursales(codigo, nombre), vendedor:perfiles!proformas_creado_por_fkey(nombre_completo)"
    )
    .eq("id", params.id)
    .single()

  if (!proforma) {
    return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 })
  }

  const { data: itemsRaw } = await supabase
    .from("proforma_items")
    .select(
      "cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea, productos(codigo, descripcion, linea_marca, unidad_medida, unidad_medida_id, producto_medidas(etiqueta, valor, unidad, orden), producto_codigos_originales(codigo_original))"
    )
    .eq("proforma_id", params.id)

  // T1 (PLAN_7): la unidad sale como código corto del catálogo (PZA, KG).
  const [empresa, unidadCorta] = await Promise.all([
    getConfiguracionEmpresa(),
    resolverUnidadCorta(),
  ])

  const cliente = (proforma as Record<string, unknown>).clientes as ProformaPdf["cliente"]
  const sucursal = (proforma as Record<string, unknown>).sucursal as ProformaPdf["sucursal"]
  const vendedor = (proforma as Record<string, unknown>).vendedor as {
    nombre_completo: string
  } | null
  const proformaPdf: ProformaPdf = {
    numero: proforma.numero,
    creado_en: proforma.creado_en,
    tipo_pago: proforma.tipo_pago,
    plazo_validez_dias: proforma.plazo_validez_dias,
    tiempo_entrega_dias: proforma.tiempo_entrega_dias,
    glosa: proforma.glosa,
    subtotal: Number(proforma.subtotal),
    descuento_tipo: proforma.descuento_tipo,
    descuento_valor: Number(proforma.descuento_valor),
    impuesto_porcentaje: Number(proforma.impuesto_porcentaje),
    total: Number(proforma.total),
    cliente,
    sucursal: sucursal ?? null,
    vendedor: vendedor?.nombre_completo ?? null,
  }

  const items: ProformaItemPdf[] = (itemsRaw ?? []).map((it) => {
    const producto = (it as Record<string, unknown>).productos as {
      codigo: string
      descripcion: string
      linea_marca: string | null
      unidad_medida: string | null
      unidad_medida_id: string | null
      producto_medidas: { etiqueta: string; valor: number | null; unidad: string | null; orden: number }[] | null
      producto_codigos_originales: { codigo_original: string }[] | null
    } | null
    const medidas = (producto?.producto_medidas ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({
        etiqueta: m.etiqueta,
        valor: m.valor == null ? null : Number(m.valor),
        unidad: m.unidad,
      }))
    return {
      codigo: producto?.codigo ?? "—",
      descripcion: producto?.descripcion ?? "",
      linea_marca: producto?.linea_marca ?? null,
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      descuento_tipo: it.descuento_tipo,
      descuento_valor: Number(it.descuento_valor),
      subtotal_linea: Number(it.subtotal_linea),
      unidad: unidadCorta(producto?.unidad_medida_id, producto?.unidad_medida),
      medidas,
      originales: (producto?.producto_codigos_originales ?? []).map((o) => o.codigo_original),
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
