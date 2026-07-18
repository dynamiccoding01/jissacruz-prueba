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
  empresaBloque: { width: "38%" },
  empresa: { fontSize: 15, color: AZUL, fontWeight: 700, marginBottom: 3 },
  empresaLinea: { fontSize: 8, color: "#212121", marginTop: 1 },
  tituloBloque: { width: "30%", alignItems: "flex-end" },
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
  glosaTop: { marginBottom: 10 },
  glosaTopLabel: { fontSize: 8, color: AZUL, fontWeight: 700, marginBottom: 2 },
  glosaTopTxt: { fontSize: 8, color: "#212121" },
  pie: { marginTop: 24, fontSize: 7, color: GRIS, textAlign: "center" },
})

type Empresa = { nombre: string; nit: string | null; direccion: string | null; telefono: string | null }

export type ProformaPdf = {
  numero: string
  creado_en: string
  tipo_pago: string | null
  plazo_validez_dias: number
  tiempo_entrega_dias: number | null
  glosa: string | null
  subtotal: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  impuesto_porcentaje: number
  total: number
  cliente: { nombre: string; ci_nit: string | null; telefono: string | null; direccion: string | null } | null
  sucursal: { codigo: string; nombre: string } | null
  vendedor: string | null
}

export type ProformaItemPdf = {
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

export function ProformaDocument({
  empresa,
  proforma,
  items,
  logo,
}: {
  empresa: Empresa
  proforma: ProformaPdf
  items: ProformaItemPdf[]
  logo?: string | null
}) {
  const descMonto =
    proforma.descuento_tipo === "porcentaje"
      ? (proforma.subtotal * Number(proforma.descuento_valor)) / 100
      : proforma.descuento_tipo === "monto_fijo"
        ? Number(proforma.descuento_valor)
        : 0
  const baseImponible = Math.max(0, proforma.subtotal - descMonto)
  const impMonto = (baseImponible * Number(proforma.impuesto_porcentaje)) / 100

  // "PRO-0005" -> "0005" para el título "PROFORMA No. 0005" (P3).
  const numeroCorto = proforma.numero.includes("-")
    ? proforma.numero.split("-").pop()
    : proforma.numero

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
            {proforma.sucursal ? (
              <Text style={styles.empresaLinea}>Sucursal: {proforma.sucursal.nombre}</Text>
            ) : null}
          </View>

          {/* Centro: logo (P1) */}
          {logo ? <Image style={styles.logo} src={logo} /> : null}

          {/* Derecha: título / FECHA / VENDEDOR (P1, P2, P3) */}
          <View style={styles.tituloBloque}>
            <Text style={styles.titulo}>PROFORMA No. {numeroCorto}</Text>
            <Text style={styles.metaRight}>
              Fecha: {format(new Date(proforma.creado_en), "dd/MM/yyyy")}
            </Text>
            {proforma.vendedor ? (
              <Text style={styles.metaRight}>Vendedor: {proforma.vendedor}</Text>
            ) : null}
          </View>
        </View>

        {/* Recuadro del cliente: Señor(es) / Contacto / Dirección / Tipo de pago (P4) */}
        <View style={styles.clienteBox}>
          <Text style={styles.clienteTitulo}>CLIENTE</Text>
          <Text>Señor(es): {proforma.cliente?.nombre ?? "—"}</Text>
          {proforma.cliente?.ci_nit ? <Text>CI/NIT: {proforma.cliente.ci_nit}</Text> : null}
          {proforma.cliente?.telefono ? (
            <Text>Contacto: {proforma.cliente.telefono}</Text>
          ) : null}
          {proforma.cliente?.direccion ? (
            <Text>Dirección: {proforma.cliente.direccion}</Text>
          ) : null}
          <Text>Tipo de pago: {proforma.tipo_pago ?? "—"}</Text>
        </View>

        {proforma.glosa ? (
          <View style={styles.glosaTop}>
            <Text style={styles.glosaTopLabel}>GLOSA</Text>
            <Text style={styles.glosaTopTxt}>{proforma.glosa}</Text>
          </View>
        ) : null}

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
            <Text>Bs {bsMiles(proforma.subtotal)}</Text>
          </View>
          {descMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Descuento</Text>
              <Text>− Bs {bsMiles(descMonto)}</Text>
            </View>
          )}
          {impMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Impuesto ({Number(proforma.impuesto_porcentaje)}%)</Text>
              <Text>Bs {bsMiles(impMonto)}</Text>
            </View>
          )}
          <View style={styles.totalFuerte}>
            <Text style={styles.totalFuerteTxt}>TOTAL IMPORTE</Text>
            <Text style={styles.totalFuerteTxt}>Bs. {bsMiles(proforma.total)}</Text>
          </View>
        </View>

        {/* Importe en literal (P8) */}
        <Text style={styles.literal}>Son: {importeALiteral(proforma.total)}</Text>

        <Text style={styles.pie}>
          Proforma sin valor fiscal. Precios en bolivianos (Bs).{"\n"}
          La cotización solo tiene validez por el plazo de {proforma.plazo_validez_dias} día(s).
          {proforma.tiempo_entrega_dias != null
            ? ` Tiempo de entrega: ${proforma.tiempo_entrega_dias} día(s).`
            : ""}
        </Text>
      </Page>
    </Document>
  )
}
