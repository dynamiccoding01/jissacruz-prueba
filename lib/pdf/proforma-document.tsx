import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"

const AZUL = "#0E3C6D"
const GRIS = "#B6B7B4"

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#212121" },
  empresa: { fontSize: 15, color: AZUL, fontWeight: 700 },
  empresaMeta: { fontSize: 8, color: "#212121" },
  tituloRow: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titulo: { fontSize: 14, color: AZUL, fontWeight: 700 },
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
  cCodigo: { width: "16%" },
  cDesc: { width: "38%" },
  cCant: { width: "10%", textAlign: "right" },
  cPrecio: { width: "14%", textAlign: "right" },
  cDesc2: { width: "10%", textAlign: "right" },
  cSub: { width: "12%", textAlign: "right" },
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
  glosa: { marginTop: 16, fontSize: 8, color: "#212121" },
  pie: { marginTop: 24, fontSize: 7, color: GRIS, textAlign: "center" },
})

type Empresa = { nombre: string; nit: string | null; direccion: string | null; telefono: string | null }

export type ProformaPdf = {
  numero: string
  creado_en: string
  tipo_pago: string | null
  plazo_validez_dias: number
  glosa: string | null
  subtotal: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  impuesto_porcentaje: number
  total: number
  cliente: { nombre: string; ci_nit: string | null; telefono: string | null; direccion: string | null } | null
}

export type ProformaItemPdf = {
  codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  subtotal_linea: number
}

const bs = (n: number) => Number(n).toFixed(2)

function etiquetaDescuento(tipo: "porcentaje" | "monto_fijo" | null, valor: number) {
  if (tipo === "porcentaje") return `${Number(valor)}%`
  if (tipo === "monto_fijo") return `Bs ${bs(valor)}`
  return "—"
}

export function ProformaDocument({
  empresa,
  proforma,
  items,
}: {
  empresa: Empresa
  proforma: ProformaPdf
  items: ProformaItemPdf[]
}) {
  const descMonto =
    proforma.descuento_tipo === "porcentaje"
      ? (proforma.subtotal * Number(proforma.descuento_valor)) / 100
      : proforma.descuento_tipo === "monto_fijo"
        ? Number(proforma.descuento_valor)
        : 0
  const baseImponible = Math.max(0, proforma.subtotal - descMonto)
  const impMonto = (baseImponible * Number(proforma.impuesto_porcentaje)) / 100

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.empresa}>{empresa.nombre}</Text>
        <Text style={styles.empresaMeta}>
          {[empresa.nit ? `NIT: ${empresa.nit}` : null, empresa.direccion, empresa.telefono]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>

        <View style={styles.tituloRow}>
          <Text style={styles.titulo}>PROFORMA {proforma.numero}</Text>
          <View style={styles.metaRight}>
            <Text>Fecha: {format(new Date(proforma.creado_en), "dd/MM/yyyy")}</Text>
            <Text>Validez: {proforma.plazo_validez_dias} días</Text>
            {proforma.tipo_pago ? <Text>Pago: {proforma.tipo_pago}</Text> : null}
          </View>
        </View>

        <View style={styles.clienteBox}>
          <Text style={styles.clienteTitulo}>CLIENTE</Text>
          <Text>{proforma.cliente?.nombre ?? "—"}</Text>
          <Text>
            {[
              proforma.cliente?.ci_nit ? `CI/NIT: ${proforma.cliente.ci_nit}` : null,
              proforma.cliente?.telefono ? `Tel: ${proforma.cliente.telefono}` : null,
              proforma.cliente?.direccion,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.hCell, styles.cCodigo]}>Código</Text>
          <Text style={[styles.hCell, styles.cDesc]}>Descripción</Text>
          <Text style={[styles.hCell, styles.cCant]}>Cant.</Text>
          <Text style={[styles.hCell, styles.cPrecio]}>P. Unit</Text>
          <Text style={[styles.hCell, styles.cDesc2]}>Desc.</Text>
          <Text style={[styles.hCell, styles.cSub]}>Subtotal</Text>
        </View>

        {items.map((it, i) => (
          <View style={styles.row} key={i} wrap={false}>
            <Text style={[styles.cell, styles.cCodigo]}>{it.codigo}</Text>
            <Text style={[styles.cell, styles.cDesc]}>{it.descripcion}</Text>
            <Text style={[styles.cell, styles.cCant]}>{it.cantidad}</Text>
            <Text style={[styles.cell, styles.cPrecio]}>{bs(it.precio_unitario)}</Text>
            <Text style={[styles.cell, styles.cDesc2]}>
              {etiquetaDescuento(it.descuento_tipo, it.descuento_valor)}
            </Text>
            <Text style={[styles.cell, styles.cSub]}>{bs(it.subtotal_linea)}</Text>
          </View>
        ))}

        <View style={styles.totales}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>Bs {bs(proforma.subtotal)}</Text>
          </View>
          {descMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Descuento</Text>
              <Text>− Bs {bs(descMonto)}</Text>
            </View>
          )}
          {impMonto > 0 && (
            <View style={styles.totalRow}>
              <Text>Impuesto ({Number(proforma.impuesto_porcentaje)}%)</Text>
              <Text>Bs {bs(impMonto)}</Text>
            </View>
          )}
          <View style={styles.totalFuerte}>
            <Text style={styles.totalFuerteTxt}>TOTAL</Text>
            <Text style={styles.totalFuerteTxt}>Bs {bs(proforma.total)}</Text>
          </View>
        </View>

        {proforma.glosa ? <Text style={styles.glosa}>Glosa: {proforma.glosa}</Text> : null}

        <Text style={styles.pie}>
          Proforma sin valor fiscal. Precios en bolivianos (Bs). Válida por{" "}
          {proforma.plazo_validez_dias} días desde su emisión.
        </Text>
      </Page>
    </Document>
  )
}
