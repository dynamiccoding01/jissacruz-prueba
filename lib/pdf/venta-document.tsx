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

export type VentaPdf = {
  numero: string
  creado_en: string
  proforma_origen_numero: string | null
  tipo_pago: string | null
  subtotal: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  impuesto_porcentaje: number
  total: number
  cliente: ClientePdf | null
  sucursal: SucursalPdf | null
  vendedor: string | null
}

export type VentaItemPdf = ItemComercialPdf

// Comprobante de venta. El diseño es el de <DocumentoComercial /> (compartido
// con la proforma y la cotización); acá solo se arman sus datos.
export function VentaDocument({
  empresa,
  venta,
  items,
  logo,
}: {
  empresa: EmpresaPdf
  venta: VentaPdf
  items: VentaItemPdf[]
  logo?: string | null
}) {
  const descMonto =
    venta.descuento_tipo === "porcentaje"
      ? (venta.subtotal * Number(venta.descuento_valor)) / 100
      : venta.descuento_tipo === "monto_fijo"
        ? Number(venta.descuento_valor)
        : 0
  const baseImponible = Math.max(0, venta.subtotal - descMonto)
  const impMonto = (baseImponible * Number(venta.impuesto_porcentaje)) / 100

  const datosDocumento: Par[] = [
    ...(empresa.nit ? [{ rotulo: "NIT", valor: empresa.nit }] : []),
    { rotulo: "VENTA Nº", valor: numeroCorto(venta.numero) },
    ...(venta.vendedor ? [{ rotulo: "VENDEDOR", valor: venta.vendedor }] : []),
    ...(venta.proforma_origen_numero
      ? [{ rotulo: "ORIGEN", valor: `Proforma ${venta.proforma_origen_numero}` }]
      : []),
  ]

  const datosIzquierda: Par[] = [
    { rotulo: "Fecha:", valor: textoFechaBolivia(venta.creado_en, true) },
    { rotulo: "Nombre/Razón Social:", valor: venta.cliente?.nombre ?? "Consumidor final" },
    ...(venta.cliente?.direccion ? [{ rotulo: "Dirección:", valor: venta.cliente.direccion }] : []),
  ]

  const datosDerecha: Par[] = [
    ...(venta.cliente?.ci_nit ? [{ rotulo: "NIT/CI:", valor: venta.cliente.ci_nit }] : []),
    ...(venta.cliente?.telefono ? [{ rotulo: "Teléfono:", valor: venta.cliente.telefono }] : []),
    ...(venta.tipo_pago ? [{ rotulo: "Tipo de pago:", valor: venta.tipo_pago }] : []),
  ]

  return (
    <DocumentoComercial
      empresa={empresa}
      sucursal={venta.sucursal}
      logo={logo}
      titulo="COMPROBANTE DE VENTA"
      subtitulo="(Sin valor fiscal)"
      datosDocumento={datosDocumento}
      datosIzquierda={datosIzquierda}
      datosDerecha={datosDerecha}
      items={items}
      subtotal={venta.subtotal}
      descuento={descMonto}
      impuestoPorcentaje={venta.impuesto_porcentaje}
      impuesto={impMonto}
      total={venta.total}
      pie={["Comprobante sin valor fiscal. Precios en bolivianos (Bs)."]}
    />
  )
}
