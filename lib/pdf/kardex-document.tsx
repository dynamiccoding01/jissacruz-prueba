import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"

import { ETIQUETA_MOVIMIENTO, type TipoMovimiento } from "@/lib/kardex"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 2, color: "#0E3C6D" },
  subtitle: { fontSize: 10, marginBottom: 2, color: "#212121" },
  meta: { fontSize: 9, marginBottom: 12, color: "#212121" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#0E3C6D",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: { color: "#FFFFFF", fontSize: 8, fontWeight: 700, flex: 1 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#B6B7B4",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cell: { fontSize: 8, flex: 1 },
})

export type MovimientoPdf = {
  tipo_movimiento: TipoMovimiento
  cantidad: number
  costo_unitario: number
  motivo: string | null
  creado_en: string
  saldo: number
}

export function KardexDocument({
  producto,
  movimientos,
}: {
  producto: { codigo: string; descripcion: string; stock_actual: number }
  movimientos: MovimientoPdf[]
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Kardex — {producto.codigo}</Text>
        <Text style={styles.subtitle}>{producto.descripcion}</Text>
        <Text style={styles.meta}>
          Stock actual: {producto.stock_actual} · Generado:{" "}
          {format(new Date(), "dd/MM/yyyy HH:mm")}
        </Text>

        <View style={styles.headerRow}>
          <Text style={styles.headerCell}>Fecha</Text>
          <Text style={styles.headerCell}>Movimiento</Text>
          <Text style={styles.headerCell}>Cantidad</Text>
          <Text style={styles.headerCell}>Costo (Bs)</Text>
          <Text style={styles.headerCell}>Saldo</Text>
          <Text style={[styles.headerCell, { flex: 2 }]}>Motivo</Text>
        </View>

        {movimientos.map((m, i) => (
          <View style={styles.row} key={i} wrap={false}>
            <Text style={styles.cell}>{format(new Date(m.creado_en), "dd/MM/yyyy HH:mm")}</Text>
            <Text style={styles.cell}>{ETIQUETA_MOVIMIENTO[m.tipo_movimiento]}</Text>
            <Text style={styles.cell}>{m.cantidad}</Text>
            <Text style={styles.cell}>{Number(m.costo_unitario).toFixed(2)}</Text>
            <Text style={styles.cell}>{m.saldo}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{m.motivo ?? "—"}</Text>
          </View>
        ))}

        {movimientos.length === 0 && (
          <Text style={{ marginTop: 12, color: "#212121" }}>Sin movimientos registrados.</Text>
        )}
      </Page>
    </Document>
  )
}
