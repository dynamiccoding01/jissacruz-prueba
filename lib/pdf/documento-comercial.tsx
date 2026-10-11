import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { importeALiteral } from "./numero-a-literal"
import "./tipografia"
import { formatearMedidas, type Medida } from "@/lib/medidas"

// Diseño único de los documentos comerciales: comprobante de venta, proforma y
// cotización (PLAN_7 · T7). Sigue la factura de referencia del cliente: empresa
// a la izquierda y datos del documento a la derecha, título centrado, datos del
// cliente en dos columnas, tabla con grilla y encabezados centrados, y los
// totales en un cuadro pegado a la tabla con el importe en literal a su lado.
// Los colores son los de la marca. Cada documento arma sus datos y llama a
// <DocumentoComercial />; no duplicar el diseño en cada uno.

const AZUL = "#0E3C6D"
const TEXTO = "#212121"
const LINEA = 0.75

// Tope de códigos originales por ítem (Q6): más allá se corta con "…" para que
// un documento de varios ítems no se dispare de páginas.
const TOPE_OEM = 5

// Anchos de las columnas, en % de la tabla. La descripción se queda con lo que
// sobra; el descuento solo aparece si algún ítem lo tiene.
const W = { codigo: 14, cantidad: 9, unidad: 9, precio: 12, descuento: 10, subtotal: 13 }

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: TEXTO },

  // Encabezado: empresa (izquierda, centrada) + datos del documento (derecha)
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  empresaBloque: { width: "46%", alignItems: "center" },
  // El PNG trae ~30% de margen transparente arriba y abajo: se compensa con
  // márgenes negativos para que el logo no quede chico ni separado del nombre.
  logo: { width: 168, height: 112, objectFit: "contain", marginTop: -30, marginBottom: -26 },
  empresaNombre: { fontSize: 11, fontWeight: 700, color: AZUL, textAlign: "center" },
  empresaSucursal: { fontSize: 9, fontWeight: 700, textAlign: "center", marginTop: 2 },
  empresaLinea: { fontSize: 8, textAlign: "center", marginTop: 1 },
  docBloque: { width: "42%", marginTop: 8 },
  par: { flexDirection: "row", marginBottom: 4 },
  parRotulo: { width: "44%", fontSize: 9, fontWeight: 700, color: AZUL },
  parValor: { width: "56%", fontSize: 9 },

  // Título centrado
  tituloBloque: { alignItems: "center", marginTop: 16, marginBottom: 14 },
  titulo: { fontSize: 16, fontWeight: 700, color: AZUL },
  subtitulo: { fontSize: 8, marginTop: 2 },

  // Datos del cliente, en dos columnas
  datos: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  datosIzq: { width: "60%" },
  datosDer: { width: "36%" },
  dato: { flexDirection: "row", marginBottom: 3 },
  datoRotuloIzq: { width: 104, fontSize: 9, fontWeight: 700 },
  datoRotuloDer: { width: 68, fontSize: 9, fontWeight: 700 },
  datoValor: { flex: 1, fontSize: 9 },
  glosa: { flexDirection: "row", marginBottom: 6 },

  // Tabla con grilla. Cada fila dibuja su propio marco (izquierda, arriba y
  // abajo) y cada celda su línea derecha; el margen negativo encima la línea de
  // arriba de una fila con la de abajo de la anterior. Así, cuando la tabla
  // sigue en otra hoja, la primera fila de esa hoja no queda sin línea de arriba.
  tabla: { marginTop: 4 },
  fila: {
    flexDirection: "row",
    borderLeftWidth: LINEA,
    borderTopWidth: LINEA,
    borderBottomWidth: LINEA,
    borderColor: AZUL,
    marginTop: -LINEA,
  },
  celda: {
    borderRightWidth: LINEA,
    borderColor: AZUL,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  celdaCab: { backgroundColor: AZUL, justifyContent: "center", paddingVertical: 5 },
  // dentro del encabezado azul las separaciones van en blanco, para que se vean
  celdaCabSeparada: { borderRightColor: "#FFFFFF" },
  txtCab: { color: "#FFFFFF", fontSize: 7.5, fontWeight: 700, textAlign: "center" },
  txt: { fontSize: 8 },
  centro: { textAlign: "center" },
  derecha: { textAlign: "right" },
  detalleSub: { fontSize: 7, color: "#555555", marginTop: 1 },
  sinItems: { fontSize: 8, textAlign: "center", paddingVertical: 8 },

  // Cierre: literal a la izquierda, cuadro de totales pegado a la tabla
  cierre: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  literal: { width: "58%", fontSize: 9, fontWeight: 700, marginTop: 12 },
  totales: { width: "38%" },
  totalRotulo: { flex: 25, alignItems: "flex-end" },
  totalValor: { flex: W.subtotal, alignItems: "flex-end" },
  txtTotal: { fontSize: 7.5, fontWeight: 700 },
  totalFinal: { backgroundColor: AZUL },
  txtTotalFinal: { fontSize: 8.5, fontWeight: 700, color: "#FFFFFF" },

  pie: { marginTop: 30, fontSize: 7.5, textAlign: "center" },
})

export type EmpresaPdf = {
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
}

// La dirección y el teléfono de la sucursal son opcionales: si faltan se usan
// los de la empresa.
export type SucursalPdf = {
  codigo: string
  nombre: string
  direccion?: string | null
  telefono?: string | null
}

export type ClientePdf = {
  nombre: string
  ci_nit: string | null
  telefono: string | null
  direccion: string | null
}

export type ItemComercialPdf = {
  codigo: string
  descripcion: string
  linea_marca: string | null
  cantidad: number
  precio_unitario: number
  descuento_tipo: "porcentaje" | "monto_fijo" | null
  descuento_valor: number
  subtotal_linea: number
  // Unidad de medida como código corto del catálogo (PZA, KG).
  unidad: string
  medidas: Medida[]
  originales: string[]
}

export type Par = { rotulo: string; valor: string }

// Formato boliviano con separador de miles: 1112.4 -> "1.112,40" (P7).
export const bsMiles = (n: number) => {
  const [ent, dec] = Number(n).toFixed(2).split(".")
  return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`
}

// "PRO-0005" -> "0005", para "PROFORMA Nº 0005" (P3).
export const numeroCorto = (numero: string) =>
  numero.includes("-") ? (numero.split("-").pop() ?? numero) : numero

// Descuento de la línea en Bs: lo que va de cantidad × precio al subtotal guardado.
const descuentoLinea = (it: ItemComercialPdf) =>
  Math.max(0, Number(it.cantidad) * Number(it.precio_unitario) - Number(it.subtotal_linea))

export function DocumentoComercial({
  empresa,
  sucursal,
  logo,
  titulo,
  subtitulo,
  datosDocumento,
  datosIzquierda,
  datosDerecha,
  glosa,
  items,
  subtotal,
  descuento,
  impuestoPorcentaje,
  impuesto,
  total,
  pie,
}: {
  empresa: EmpresaPdf
  sucursal: SucursalPdf | null
  logo?: string | null
  // "COMPROBANTE DE VENTA", "PROFORMA", "COTIZACIÓN"
  titulo: string
  subtitulo: string
  // Bloque de arriba a la derecha: NIT, número del documento, vendedor…
  datosDocumento: Par[]
  // Debajo del título: fecha y cliente (izquierda) · NIT/CI, teléfono, pago (derecha)
  datosIzquierda: Par[]
  datosDerecha: Par[]
  glosa?: string | null
  items: ItemComercialPdf[]
  subtotal: number
  // Descuento global del documento, en Bs (0 si no hay).
  descuento: number
  impuestoPorcentaje: number
  impuesto: number
  total: number
  // Leyendas del pie, una por renglón.
  pie: string[]
}) {
  const conDescuento = items.some((it) => descuentoLinea(it) > 0.004)
  const wDescripcion =
    100 - W.codigo - W.cantidad - W.unidad - W.precio - W.subtotal - (conDescuento ? W.descuento : 0)

  const columnas: { rotulo: string; ancho: number }[] = [
    { rotulo: "CÓDIGO", ancho: W.codigo },
    { rotulo: "CANTIDAD", ancho: W.cantidad },
    { rotulo: "UNIDAD DE MEDIDA", ancho: W.unidad },
    { rotulo: "DESCRIPCIÓN", ancho: wDescripcion },
    { rotulo: "PRECIO UNITARIO", ancho: W.precio },
    ...(conDescuento ? [{ rotulo: "DESCUENTO", ancho: W.descuento }] : []),
    { rotulo: "SUBTOTAL", ancho: W.subtotal },
  ]

  const direccion = sucursal?.direccion || empresa.direccion
  const telefono = sucursal?.telefono || empresa.telefono

  const filasTotales: { rotulo: string; valor: string }[] = [
    { rotulo: "SUBTOTAL Bs", valor: bsMiles(subtotal) },
    ...(descuento > 0 ? [{ rotulo: "DESCUENTO Bs", valor: bsMiles(descuento) }] : []),
    ...(impuesto > 0
      ? [{ rotulo: `IMPUESTO (${Number(impuestoPorcentaje)}%) Bs`, valor: bsMiles(impuesto) }]
      : []),
  ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          <View style={styles.empresaBloque}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, no es un <img> del DOM */}
            {logo ? <Image style={styles.logo} src={logo} /> : null}
            <Text style={styles.empresaNombre}>{empresa.nombre}</Text>
            {sucursal ? (
              <Text style={styles.empresaSucursal}>SUCURSAL: {sucursal.nombre.toUpperCase()}</Text>
            ) : null}
            {direccion ? <Text style={styles.empresaLinea}>{direccion}</Text> : null}
            {telefono ? <Text style={styles.empresaLinea}>Teléfono: {telefono}</Text> : null}
          </View>

          <View style={styles.docBloque}>
            {datosDocumento.map((d) => (
              <View style={styles.par} key={d.rotulo}>
                <Text style={styles.parRotulo}>{d.rotulo}</Text>
                <Text style={styles.parValor}>{d.valor}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tituloBloque}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.subtitulo}>{subtitulo}</Text>
        </View>

        <View style={styles.datos}>
          <View style={styles.datosIzq}>
            {datosIzquierda.map((d) => (
              <View style={styles.dato} key={d.rotulo}>
                <Text style={styles.datoRotuloIzq}>{d.rotulo}</Text>
                <Text style={styles.datoValor}>{d.valor}</Text>
              </View>
            ))}
          </View>
          <View style={styles.datosDer}>
            {datosDerecha.map((d) => (
              <View style={styles.dato} key={d.rotulo}>
                <Text style={styles.datoRotuloDer}>{d.rotulo}</Text>
                <Text style={styles.datoValor}>{d.valor}</Text>
              </View>
            ))}
          </View>
        </View>

        {glosa ? (
          <View style={styles.glosa}>
            <Text style={styles.datoRotuloIzq}>Glosa:</Text>
            <Text style={styles.datoValor}>{glosa}</Text>
          </View>
        ) : null}

        <View style={styles.tabla}>
          {/* `fixed`: si la tabla sigue en otra hoja, el encabezado se repite arriba */}
          <View style={styles.fila} fixed>
            {columnas.map((c, i) => (
              <View
                key={c.rotulo}
                style={[
                  styles.celda,
                  styles.celdaCab,
                  i < columnas.length - 1 ? styles.celdaCabSeparada : {},
                  { width: `${c.ancho}%` },
                ]}
              >
                <Text style={styles.txtCab}>{c.rotulo}</Text>
              </View>
            ))}
          </View>

          {items.map((it, i) => {
            const oem =
              it.originales.slice(0, TOPE_OEM).join("  ") +
              (it.originales.length > TOPE_OEM ? "  …" : "")
            return (
              <View style={styles.fila} key={i} wrap={false}>
                <View style={[styles.celda, { width: `${W.codigo}%` }]}>
                  <Text style={[styles.txt, styles.centro]}>{it.codigo}</Text>
                </View>
                <View style={[styles.celda, { width: `${W.cantidad}%` }]}>
                  <Text style={[styles.txt, styles.centro]}>{it.cantidad}</Text>
                </View>
                <View style={[styles.celda, { width: `${W.unidad}%` }]}>
                  <Text style={[styles.txt, styles.centro]}>{it.unidad || "—"}</Text>
                </View>
                <View style={[styles.celda, { width: `${wDescripcion}%` }]}>
                  <Text style={styles.txt}>{it.descripcion}</Text>
                  {it.linea_marca ? (
                    <Text style={styles.detalleSub}>Línea: {it.linea_marca}</Text>
                  ) : null}
                  {it.medidas.length > 0 ? (
                    <Text style={styles.detalleSub}>Medidas: {formatearMedidas(it.medidas)}</Text>
                  ) : null}
                  {it.originales.length > 0 ? (
                    <Text style={styles.detalleSub}>Cód. original: {oem}</Text>
                  ) : null}
                </View>
                <View style={[styles.celda, { width: `${W.precio}%` }]}>
                  <Text style={[styles.txt, styles.derecha]}>{bsMiles(it.precio_unitario)}</Text>
                </View>
                {conDescuento ? (
                  <View style={[styles.celda, { width: `${W.descuento}%` }]}>
                    <Text style={[styles.txt, styles.derecha]}>{bsMiles(descuentoLinea(it))}</Text>
                  </View>
                ) : null}
                <View style={[styles.celda, { width: `${W.subtotal}%` }]}>
                  <Text style={[styles.txt, styles.derecha]}>{bsMiles(it.subtotal_linea)}</Text>
                </View>
              </View>
            )
          })}

          {items.length === 0 ? (
            <View style={styles.fila}>
              <View style={[styles.celda, { width: "100%" }]}>
                <Text style={styles.sinItems}>Sin ítems.</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.cierre} wrap={false}>
          {/* Importe en literal (P8) */}
          <Text style={styles.literal}>Son: {importeALiteral(total)}</Text>

          <View style={styles.totales}>
            {filasTotales.map((f) => (
              <View style={styles.fila} key={f.rotulo}>
                <View style={[styles.celda, styles.totalRotulo]}>
                  <Text style={styles.txtTotal}>{f.rotulo}</Text>
                </View>
                <View style={[styles.celda, styles.totalValor]}>
                  <Text style={styles.txt}>{f.valor}</Text>
                </View>
              </View>
            ))}
            <View style={styles.fila}>
              <View style={[styles.celda, styles.totalRotulo, styles.totalFinal, styles.celdaCabSeparada]}>
                <Text style={styles.txtTotalFinal}>TOTAL A PAGAR Bs</Text>
              </View>
              <View style={[styles.celda, styles.totalValor, styles.totalFinal]}>
                <Text style={styles.txtTotalFinal}>{bsMiles(total)}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.pie}>{pie.join("\n")}</Text>
      </Page>
    </Document>
  )
}
