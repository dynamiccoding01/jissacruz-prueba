import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"

import type { Columna, Fila } from "@/lib/reportes-tipos"

const AZUL = "#0E3C6D"
const GRIS = "#B6B7B4"

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#212121" },
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 104, height: 64, objectFit: "contain" },
  empresa: { fontSize: 13, color: AZUL, fontWeight: 700 },
  empresaMeta: { fontSize: 8, color: "#212121", marginTop: 4, marginBottom: 12 },
  tituloBloque: { alignItems: "flex-end" },
  titulo: { fontSize: 14, color: AZUL, fontWeight: 700, textAlign: "right" },
  subtitulo: { fontSize: 9, color: "#212121", textAlign: "right", marginTop: 2 },
  resumenRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  resumenBox: {
    borderWidth: 1,
    borderColor: GRIS,
    borderRadius: 4,
    padding: 6,
    minWidth: 110,
  },
  resumenLabel: { fontSize: 7, color: "#666" },
  resumenValue: { fontSize: 11, color: AZUL, fontWeight: 700 },
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
  pie: { marginTop: 24, fontSize: 7, color: GRIS, textAlign: "center" },
})

type Empresa = { nombre: string; nit: string | null }

export type ReportePdf = {
  titulo: string
  subtitulo: string
  columnas: Columna[]
  filas: Fila[]
  resumen: { label: string; value: string }[]
}

export function ReporteDocument({
  empresa,
  reporte,
  logo,
}: {
  empresa: Empresa
  reporte: ReportePdf
  logo?: string | null
}) {
  // Reparte el ancho: la primera columna (descriptiva) se lleva mas espacio.
  const nCols = reporte.columnas.length
  const anchoPrimera = nCols > 1 ? 30 : 100
  const anchoResto = nCols > 1 ? (100 - anchoPrimera) / (nCols - 1) : 0
  const ancho = (i: number) => `${i === 0 ? anchoPrimera : anchoResto}%`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          {logo ? (
            <Image style={styles.logo} src={logo} />
          ) : (
            <Text style={styles.empresa}>{empresa.nombre}</Text>
          )}
          <View style={styles.tituloBloque}>
            <Text style={styles.titulo}>{reporte.titulo}</Text>
            <Text style={styles.subtitulo}>{reporte.subtitulo}</Text>
          </View>
        </View>
        <Text style={styles.empresaMeta}>{empresa.nit ? `NIT: ${empresa.nit}` : " "}</Text>

        <View style={styles.resumenRow}>
          {reporte.resumen.map((r, i) => (
            <View style={styles.resumenBox} key={i}>
              <Text style={styles.resumenLabel}>{r.label}</Text>
              <Text style={styles.resumenValue}>{r.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.headerRow}>
          {reporte.columnas.map((c, i) => (
            <Text
              key={c.key}
              style={[styles.hCell, { width: ancho(i), textAlign: c.align ?? "left" }]}
            >
              {c.label}
            </Text>
          ))}
        </View>

        {reporte.filas.map((fila, i) => (
          <View style={styles.row} key={i} wrap={false}>
            {reporte.columnas.map((c, j) => (
              <Text
                key={c.key}
                style={[styles.cell, { width: ancho(j), textAlign: c.align ?? "left" }]}
              >
                {String(fila[c.key] ?? "")}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.pie}>
          Generado el {format(new Date(), "dd/MM/yyyy HH:mm")} · Precios en bolivianos (Bs).
        </Text>
      </Page>
    </Document>
  )
}
