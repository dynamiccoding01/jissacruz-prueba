import { addDays } from "date-fns"

import { textoFechaBolivia } from "@/lib/fechas-bolivia"
import {
  DocumentoComercial,
  numeroCorto,
  type ClientePdf,
  type EmpresaPdf,
  type ItemComercialPdf,
  type Par,
  type SucursalPdf,
} from "./documento-comercial"

export type ProformaPdf = {
  numero: string
  creado_en: string
  // PLAN_7 · T5: si la proforma se revisó (editó o revalidó), la validez corre
  // desde ahí, igual que en el sistema. La cotización no lo manda.
  revalidada_en?: string | null
  tipo_pago: string | null
  plazo_validez_dias: number
  tiempo_entrega_dias: number | null
  glosa: string | null
  subtotal: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  impuesto_porcentaje: number
  total: number
  cliente: ClientePdf | null
  sucursal: SucursalPdf | null
  vendedor: string | null
}

export type ProformaItemPdf = ItemComercialPdf

// Proforma y cotización. El diseño es el de <DocumentoComercial /> (compartido
// con el comprobante de venta); acá solo se arman sus datos.
export function ProformaDocument({
  empresa,
  proforma,
  items,
  logo,
  variante = "proforma",
}: {
  empresa: EmpresaPdf
  proforma: ProformaPdf
  items: ProformaItemPdf[]
  logo?: string | null
  // La cotización S/F (PLAN_4) reusa este mismo documento cambiando solo el
  // título y una línea del pie; el resto (cliente, glosa, tabla, total en
  // literal, validez y tiempo de entrega) es idéntico.
  variante?: "proforma" | "cotizacion"
}) {
  const esCotizacion = variante === "cotizacion"
  const rotulo = esCotizacion ? "COTIZACIÓN" : "PROFORMA"
  const descMonto =
    proforma.descuento_tipo === "porcentaje"
      ? (proforma.subtotal * Number(proforma.descuento_valor)) / 100
      : proforma.descuento_tipo === "monto_fijo"
        ? Number(proforma.descuento_valor)
        : 0
  const baseImponible = Math.max(0, proforma.subtotal - descMonto)
  const impMonto = (baseImponible * Number(proforma.impuesto_porcentaje)) / 100

  // T9: fecha concreta de vencimiento = emisión + plazo de validez. PLAN_7 · T5:
  // si la proforma se revisó, el plazo corre desde esa revisión (misma regla que
  // `vista_proformas`), para que el PDF no muestre una fecha distinta a la del sistema.
  const baseValidez = proforma.revalidada_en ?? proforma.creado_en
  const fechaVence = textoFechaBolivia(
    addDays(new Date(baseValidez), proforma.plazo_validez_dias)
  )

  const datosDocumento: Par[] = [
    ...(empresa.nit ? [{ rotulo: "NIT", valor: empresa.nit }] : []),
    { rotulo: `${rotulo} Nº`, valor: numeroCorto(proforma.numero) },
    ...(proforma.vendedor ? [{ rotulo: "VENDEDOR", valor: proforma.vendedor }] : []),
  ]

  const datosIzquierda: Par[] = [
    { rotulo: "Fecha:", valor: textoFechaBolivia(proforma.creado_en) },
    { rotulo: "Nombre/Razón Social:", valor: proforma.cliente?.nombre ?? "—" },
    ...(proforma.cliente?.direccion
      ? [{ rotulo: "Dirección:", valor: proforma.cliente.direccion }]
      : []),
  ]

  const datosDerecha: Par[] = [
    ...(proforma.cliente?.ci_nit ? [{ rotulo: "NIT/CI:", valor: proforma.cliente.ci_nit }] : []),
    ...(proforma.cliente?.telefono
      ? [{ rotulo: "Teléfono:", valor: proforma.cliente.telefono }]
      : []),
    { rotulo: "Tipo de pago:", valor: proforma.tipo_pago ?? "—" },
  ]

  const validez =
    `Válida hasta el ${fechaVence} (${proforma.plazo_validez_dias} día(s) desde ` +
    `${proforma.revalidada_en ? "su última revisión" : "la emisión"}).` +
    (proforma.tiempo_entrega_dias != null
      ? ` Tiempo de entrega: ${proforma.tiempo_entrega_dias} día(s).`
      : "")

  return (
    <DocumentoComercial
      empresa={empresa}
      sucursal={proforma.sucursal}
      logo={logo}
      titulo={rotulo}
      subtitulo="(Sin valor fiscal)"
      datosDocumento={datosDocumento}
      datosIzquierda={datosIzquierda}
      datosDerecha={datosDerecha}
      glosa={proforma.glosa}
      items={items}
      subtotal={proforma.subtotal}
      descuento={descMonto}
      impuestoPorcentaje={proforma.impuesto_porcentaje}
      impuesto={impMonto}
      total={proforma.total}
      pie={[
        `${rotulo.charAt(0) + rotulo.slice(1).toLowerCase()} sin valor fiscal. Precios en bolivianos (Bs).`,
        validez,
      ]}
    />
  )
}
