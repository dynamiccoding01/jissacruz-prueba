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

// La cotización S/F reusa el documento de proforma con variante="cotizacion"
// (mismo formato: título "COTIZACIÓN", cliente, glosa, tabla, total en literal,
// validez y tiempo de entrega). El cliente puede ser null (SIN NOMBRE).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select(
      "numero, creado_en, tipo_pago, plazo_validez_dias, tiempo_entrega_dias, glosa, subtotal, descuento_tipo, descuento_valor, impuesto_porcentaje, total, clientes(nombre, ci_nit, telefono, direccion), sucursal:sucursales(codigo, nombre), vendedor:perfiles!cotizaciones_creado_por_fkey(nombre_completo)"
    )
    .eq("id", params.id)
    .single()

  if (!cotizacion) {
    return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 })
  }

  const { data: itemsRaw } = await supabase
    .from("cotizacion_items")
    .select(
      "cantidad, precio_unitario, descuento_tipo, descuento_valor, subtotal_linea, productos(codigo, descripcion, linea_marca, unidad_medida, unidad_medida_id, producto_medidas(etiqueta, valor, unidad, orden), producto_codigos_originales(codigo_original))"
    )
    .eq("cotizacion_id", params.id)

  // T1 (PLAN_7): la unidad sale como código corto del catálogo (PZA, KG).
  const [empresa, unidadCorta] = await Promise.all([
    getConfiguracionEmpresa(),
    resolverUnidadCorta(),
  ])

  const cliente = (cotizacion as Record<string, unknown>).clientes as ProformaPdf["cliente"]
  const sucursal = (cotizacion as Record<string, unknown>).sucursal as ProformaPdf["sucursal"]
  const vendedor = (cotizacion as Record<string, unknown>).vendedor as {
    nombre_completo: string
  } | null
  const cotizacionPdf: ProformaPdf = {
    numero: cotizacion.numero,
    creado_en: cotizacion.creado_en,
    tipo_pago: cotizacion.tipo_pago,
    plazo_validez_dias: cotizacion.plazo_validez_dias,
    tiempo_entrega_dias: cotizacion.tiempo_entrega_dias,
    glosa: cotizacion.glosa,
    subtotal: Number(cotizacion.subtotal),
    descuento_tipo: cotizacion.descuento_tipo,
    descuento_valor: Number(cotizacion.descuento_valor),
    impuesto_porcentaje: Number(cotizacion.impuesto_porcentaje),
    total: Number(cotizacion.total),
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
      proforma={cotizacionPdf}
      items={items}
      logo={getLogoEmpresa()}
      variante="cotizacion"
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cotizacion-${cotizacion.numero}.pdf"`,
    },
  })
}
