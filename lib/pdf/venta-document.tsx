import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"

import { importeALiteral } from "./numero-a-literal"

const AZUL = "#0E3C6D"
const GRIS = "#B6B7B4"

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#212121" },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 120, height: 74, objectFit: "contain" },
  empresaBloque: { width: "34%" },
  empresa: { fontSize: 15, color: AZUL, fontWeight: 700, marginBottom: 3 },
  empresaLinea: { fontSize: 8, color: "#212121", marginTop: 1 },
  tituloBloque: { width: "34%", alignItems: "flex-end" },
  titulo: { fontSize: 14, color: AZUL, fontWeight: 700, marginBottom: 3 },
  metaRight: { fontSize: 9, textAlign: "right" },
  clienteBox: {
    borderWidth: 1,
    borderColor: GRIS,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  clienteTitulo: { fontSize: 8, color: AZUL, fontWeight: 700, marginBottom: 2 },
  headerRow: {
    flexDirection: "row",
    backgroundColor: AZUL,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  hCell: { color: "#FFFFFF", fontSize: 8, fontWeight: 700 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: GRIS,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cell: { fontSize: 8 },
  cNum: { width: "5%" },
  cCant: { width: "10%", textAlign: "right" },
  cCodigo: { width: "15%" },
  cLinea: { width: "15%" },
  cDetalle: { width: "30%" },
  cPrecio: { width: "12%", textAlign: "right" },
  cImporte: { width: "13%", textAlign: "right" },
  totales: { marginTop: 10, marginLeft: "auto", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalFuerte: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: AZUL,
    paddingTop: 3,
    marginTop: 2,
  },
  totalFuerteTxt: { fontSize: 11, fontWeight: 700, color: AZUL },
  literal: { marginTop: 8, fontSize: 9, fontStyle: "italic", color: "#212121" },
  pie: { marginTop: 24, fontSize: 7, color: GRIS, textAlign: "center" },
})

type Empresa = { nombre: string; nit: string | null; direccion: string | null; telefono: string | null }

export type VentaPdf = {
  numero: string
  creado_en: string
  proforma_origen_numero: string | null
  subtotal: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  impuesto_porcentaje: number
  total: number
  cliente: { nombre: string; ci_nit: string | null; telefono: string | null; direccion: string | null } | null
  sucursal: { codigo: string; nombre: string } | null
  vendedor: string | null
}

export type VentaItemPdf = {
  codigo: string
  descripcion: string
  linea_marca: string | null
  cantidad: number
  precio_unitario: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  subtotal_linea: number
}

// Formato boliviano con separador de miles: 1112.4 -> "1.112,40" (P7).
const bsMiles = (n: number) => {
  const [ent, dec] = Number(n).toFixed(2).split(".")
  return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`
}

export function VentaDocument({
  empresa,
  venta,
  items,
  logo,
}: {
  empresa: Empresa
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

  // "VEN-0003" -> "0003" para el título "COMPROBANTE DE VENTA No. 0003" (P3).
  const numeroCorto = venta.numero.includes("-")
    ? venta.numero.split("-").pop()
    : venta.numero

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          {/* Izquierda: EMPRESA / DIRECCIÓN / SUCURSAL (P1) */}
          <View style={styles.empresaBloque}>
            <Text style={styles.empresa}>{empresa.nombre}</Text>
            {empresa.direccion ? (
              <Text style={styles.empresaLinea}>Dirección: {empresa.direccion}</Text>
            ) : null}
            {empresa.nit ? <Text style={styles.empresaLinea}>NIT: {empresa.nit}</Text> : null}
            {empresa.telefono ? (
              <Text style={styles.empresaLinea}>Tel: {empresa.telefono}</Text>
            ) : null}
            {venta.sucursal ? (
              <Text style={styles.empresaLinea}>Sucursal: {venta.sucursal.nombre}</Text>
            ) : null}
          </View>

          {/* Centro: logo (P1) */}
          {logo ? <Image style={styles.logo} src={logo} /> : null}

          {/* Derecha: título / FECHA / VENDEDOR (P1, P2, P3) */}
          <View style={styles.tituloBloque}>
            <Text style={styles.titulo}>COMPROBANTE DE VENTA No. {numeroCorto}</Text>
            <Text style={styles.metaRight}>
              Fecha: {format(new Date(venta.creado_en), "dd/MM/yyyy HH:mm")}
            </Text>
            {venta.vendedor ? (
              <Text style={styles.metaRight}>Vendedor: {venta.vendedor}</Text>
            ) : null}
            {venta.proforma_origen_numero ? (
              <Text style={styles.metaRight}>
                Origen: proforma {venta.proforma_origen_numero}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Recuadro del cliente: Señor(es) / Contacto / Dirección (P4) */}
        <View style={styles.clienteBox}>
          <Text style={styles.clienteTitulo}>CLIENTE</Text>
          <Text>Señor(es): {venta.cliente?.nombre ?? "Consumidor final"}</Text>
          {venta.cliente?.ci_nit ? <Text>CI/NIT: {venta.cliente.ci_nit}</Text> : null}
          {venta.cliente?.telefono ? <Text>Contacto: {venta.cliente.telefono}</Text> : null}
          {venta.cliente?.direccion ? <Text>Dirección: {venta.cliente.direccion}</Text> : null}
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.hCell, styles.cNum]}>N°</Text>
          <Text style={[styles.hCell, styles.cCant]}>Cantidad</Text>
          <Text style={[styles.hCell, styles.cCodigo]}>Código</Text>
          <Text style={[styles.hCell, styles.cLinea]}>Línea</Text>
          <Text style={[styles.hCell, styles.cDetalle]}>Detalle</Text>
          <Text style={[styles.hCell, styles.cPrecio]}>P. Unit.</Text>
          <Text style={[styles.hCell, styles.cImporte]}>Importe</Text>
        </View>

        {items.map((it, i) => (
          <View style={styles.row} key={i} wrap={false}>
            <Text style={[styles.cell, styles.cNum]}>{i + 1}</Text>
            <Text style={[styles.cell, styles.cCant]}>{it.cantidad}</Text>
            <Text style={[styles.cell, styles.cCodigo]}>{it.codigo}</Text>
            <Text style={[styles.cell, styles.cLinea]}>{it.linea_marca ?? "—"}</Text>
            <Text style={[styles.cell, styles.cDetalle]}>{it.descripcion}</Text>
            <Text style={[styles.cell, styles.cPrecio]}>{bsMiles(it.precio_unitario)}</Text>
            <Text style={[styles.cell, styles.cImporte]}>{bsMiles(it.subtotal_linea)}</Text>
          </View>
        ))}

        <View style={styles.totales}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>Bs {bsMiles(venta.subtotal)}</Text>
          </View>
          {descMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Descuento</Text>
              <Text>− Bs {bsMiles(descMonto)}</Text>
            </View>
          )}
          {impMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Impuesto ({Number(venta.impuesto_porcentaje)}%)</Text>
              <Text>Bs {bsMiles(impMonto)}</Text>
            </View>
          )}
          <View style={styles.totalFuerte}>
            <Text style={styles.totalFuerteTxt}>TOTAL IMPORTE</Text>
            <Text style={styles.totalFuerteTxt}>Bs. {bsMiles(venta.total)}</Text>
          </View>
        </View>

        {/* Importe en literal (P8) */}
        <Text style={styles.literal}>Son: {importeALiteral(venta.total)}</Text>

        <Text style={styles.pie}>
          Comprobante sin valor fiscal. Precios en bolivianos (Bs).
        </Text>
      </Page>
    </Document>
  )
}
