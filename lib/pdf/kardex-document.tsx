import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"

import { ETIQUETA_MOVIMIENTO, esEntrada, type TipoMovimiento } from "@/lib/kardex"
import "./tipografia"

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  logo: { width: 104, height: 64, objectFit: "contain" },
  tituloBloque: { alignItems: "flex-end" },
  title: { fontSize: 16, marginBottom: 2, color: "#0E3C6D", textAlign: "right" },
  subtitle: { fontSize: 10, marginBottom: 2, color: "#212121", textAlign: "right" },
  meta: { fontSize: 9, color: "#212121", textAlign: "right" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#0E3C6D",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: { color: "#FFFFFF", fontSize: 8, fontWeight: 700 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#B6B7B4",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cell: { fontSize: 8 },
  // Columnas. Cada una lleva su margen interno para que el texto de una no quede
  // pegado al de la siguiente (antes la fecha llenaba su columna y se juntaba
  // con el movimiento). Cantidad va centrada; costo y saldo, a la derecha.
  cFecha: { flex: 1.3, paddingHorizontal: 3 },
  cMovimiento: { flex: 1.5, paddingHorizontal: 3 },
  cSucursal: { flex: 1.2, paddingHorizontal: 3 },
  cCantidad: { flex: 0.8, paddingHorizontal: 3, textAlign: "center" },
  cCosto: { flex: 0.9, paddingHorizontal: 3, textAlign: "right" },
  cSaldo: { flex: 0.7, paddingHorizontal: 3, textAlign: "right" },
  cMotivo: { flex: 2, paddingHorizontal: 6 },
})

export type MovimientoPdf = {
  tipo_movimiento: TipoMovimiento
  cantidad: number
  // PLAN_7 · T3: solo viene cuando el PDF lo pide un admin (`mostrarCosto`).
  costo_unitario?: number
  motivo: string | null
  creado_en: string
  saldo: number
  sucursal: { codigo: string; nombre: string } | null
}

export function KardexDocument({
  producto,
  movimientos,
  logo,
  mostrarCosto = true,
}: {
  producto: { codigo: string; descripcion: string; stock_actual: number }
  movimientos: MovimientoPdf[]
  logo?: string | null
  mostrarCosto?: boolean
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, no es un <img> del DOM */}
          {logo ? <Image style={styles.logo} src={logo} /> : <View />}
          <View style={styles.tituloBloque}>
            <Text style={styles.title}>Kardex — {producto.codigo}</Text>
            <Text style={styles.subtitle}>{producto.descripcion}</Text>
            <Text style={styles.meta}>
              Stock actual: {producto.stock_actual} · Generado:{" "}
              {format(new Date(), "dd/MM/yyyy HH:mm")}
            </Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.cFecha]}>Fecha</Text>
          <Text style={[styles.headerCell, styles.cMovimiento]}>Movimiento</Text>
          <Text style={[styles.headerCell, styles.cSucursal]}>Sucursal</Text>
          <Text style={[styles.headerCell, styles.cCantidad]}>Cantidad</Text>
          {mostrarCosto && <Text style={[styles.headerCell, styles.cCosto]}>Costo (Bs)</Text>}
          <Text style={[styles.headerCell, styles.cSaldo]}>Saldo</Text>
          <Text style={[styles.headerCell, styles.cMotivo]}>Motivo</Text>
        </View>

        {movimientos.map((m, i) => (
          <View style={styles.row} key={i} wrap={false}>
            <Text style={[styles.cell, styles.cFecha]}>
              {format(new Date(m.creado_en), "dd/MM/yyyy HH:mm")}
            </Text>
            <Text style={[styles.cell, styles.cMovimiento]}>
              {ETIQUETA_MOVIMIENTO[m.tipo_movimiento]}
            </Text>
            <Text style={[styles.cell, styles.cSucursal]}>{m.sucursal?.nombre ?? "—"}</Text>
            <Text style={[styles.cell, styles.cCantidad]}>
              {esEntrada(m.tipo_movimiento) ? "+" : "-"}
              {m.cantidad}
            </Text>
            {mostrarCosto && (
              <Text style={[styles.cell, styles.cCosto]}>
                {Number(m.costo_unitario ?? 0).toFixed(2)}
              </Text>
            )}
            <Text style={[styles.cell, styles.cSaldo]}>{m.saldo}</Text>
            <Text style={[styles.cell, styles.cMotivo]}>{m.motivo ?? "—"}</Text>
          </View>
        ))}

        {movimientos.length === 0 && (
          <Text style={{ marginTop: 12, color: "#212121" }}>Sin movimientos registrados.</Text>
        )}
      </Page>
    </Document>
  )
}
