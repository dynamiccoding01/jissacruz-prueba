import "server-only"
import {
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
} from "date-fns"
import { es } from "date-fns/locale"

import { createClient } from "@/lib/supabase/server"
import { diaBolivia } from "@/lib/fechas-bolivia"
import { logError } from "@/lib/log"
import type { Columna, Fila, Periodo, ReporteResultado, ReporteTipo } from "@/lib/reportes-tipos"

export type { Columna, Fila, Periodo, ReporteResultado, ReporteTipo } from "@/lib/reportes-tipos"
export { REPORTE_LABEL } from "@/lib/reportes-tipos"

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

// Normaliza el rango de fechas: si no viene, usa el mes en curso.
function rango(desde?: string, hasta?: string) {
  const finBase = hasta ? parseISO(hasta) : new Date()
  const inicioBase = desde ? parseISO(desde) : startOfMonth(finBase)
  return { desde: startOfDay(inicioBase), hasta: endOfDay(finBase) }
}

function etiquetaRango(desde: Date, hasta: Date) {
  return `${format(desde, "dd/MM/yyyy", { locale: es })} — ${format(hasta, "dd/MM/yyyy", {
    locale: es,
  })}`
}

// ---------- Ventas por período ----------
async function reporteVentas(
  desdeStr?: string,
  hastaStr?: string,
  periodo: Periodo = "diario"
): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("ventas")
    .select("total, creado_en, con_factura")
    .gte("creado_en", desde.toISOString())
    .lte("creado_en", hasta.toISOString())
    .order("creado_en")

  const ventas = data ?? []

  // Agrupa por bucket segun el periodo elegido
  const buckets = new Map<string, { orden: number; etiqueta: string; total: number; cantidad: number }>()
  for (const v of ventas) {
    const fecha = new Date(v.creado_en)
    let clave: Date
    let etiqueta: string
    if (periodo === "mensual") {
      clave = startOfMonth(fecha)
      etiqueta = format(clave, "MMM yyyy", { locale: es })
    } else if (periodo === "semanal") {
      clave = startOfISOWeek(fecha)
      etiqueta = `Sem. ${format(clave, "dd/MM", { locale: es })}`
    } else {
      clave = startOfDay(fecha)
      etiqueta = format(clave, "dd/MM/yyyy", { locale: es })
    }
    const k = clave.toISOString()
    const prev = buckets.get(k) ?? { orden: clave.getTime(), etiqueta, total: 0, cantidad: 0 }
    prev.total += Number(v.total)
    prev.cantidad += 1
    buckets.set(k, prev)
  }

  const ordenados = Array.from(buckets.values()).sort((a, b) => a.orden - b.orden)
  const totalGeneral = ventas.reduce((acc, v) => acc + Number(v.total), 0)
  const cantidadVentas = ventas.length
  // T7: separa el total en ventas CON factura y SIN factura (S/F).
  const totalConFactura = ventas.reduce(
    (acc, v) => acc + ((v as { con_factura?: boolean }).con_factura === false ? 0 : Number(v.total)),
    0
  )
  const totalSinFactura = ventas.reduce(
    (acc, v) => acc + ((v as { con_factura?: boolean }).con_factura === false ? Number(v.total) : 0),
    0
  )

  return {
    tipo: "ventas",
    titulo: "Reporte de ventas por período",
    subtitulo: `${etiquetaRango(desde, hasta)} · agrupado ${periodo}`,
    columnas: [
      { key: "periodo", label: "Período" },
      { key: "cantidad", label: "N.º ventas", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ],
    filas: ordenados.map((b) => ({
      periodo: b.etiqueta,
      cantidad: b.cantidad,
      total: bs(b.total),
    })),
    resumen: [
      { label: "Ventas", value: String(cantidadVentas) },
      { label: "Total", value: bs(totalGeneral) },
      { label: "Con factura", value: bs(totalConFactura) },
      { label: "Sin factura (S/F)", value: bs(totalSinFactura) },
      {
        label: "Ticket promedio",
        value: bs(cantidadVentas ? totalGeneral / cantidadVentas : 0),
      },
    ],
    grafico: ordenados.map((b) => ({ etiqueta: b.etiqueta, total: b.total })),
  }
}

// ---------- Proformas ----------
async function reporteProformas(desdeStr?: string, hastaStr?: string): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("vista_proformas")
    .select("numero, creado_en, total, estado_efectivo, clientes(nombre)")
    .gte("creado_en", desde.toISOString())
    .lte("creado_en", hasta.toISOString())
    .order("creado_en", { ascending: false })

  const proformas = (data ?? []) as unknown as {
    numero: string
    creado_en: string
    total: number
    estado_efectivo: "vigente" | "pendiente" | "convertida" | "vencida"
    clientes: { nombre: string } | null
  }[]

  // 'pendiente' se agregó en el Sprint 6 (Parte IV): sin contemplarlo, el conteo daba NaN.
  const cuenta = { vigente: 0, pendiente: 0, convertida: 0, vencida: 0 }
  for (const p of proformas) cuenta[p.estado_efectivo] += 1

  const ETIQUETA_ESTADO = {
    vigente: "Vigente",
    pendiente: "Pendiente",
    convertida: "Convertida",
    vencida: "Vencida",
  }

  return {
    tipo: "proformas",
    titulo: "Reporte de proformas",
    subtitulo: etiquetaRango(desde, hasta),
    columnas: [
      { key: "numero", label: "Número" },
      { key: "fecha", label: "Fecha" },
      { key: "cliente", label: "Cliente" },
      { key: "estado", label: "Estado" },
      { key: "total", label: "Total", align: "right" },
    ],
    filas: proformas.map((p) => ({
      numero: p.numero,
      fecha: format(new Date(p.creado_en), "dd/MM/yyyy", { locale: es }),
      cliente: p.clientes?.nombre ?? "—",
      estado: ETIQUETA_ESTADO[p.estado_efectivo],
      total: bs(Number(p.total)),
    })),
    resumen: [
      { label: "Emitidas", value: String(proformas.length) },
      { label: "Convertidas", value: String(cuenta.convertida) },
      { label: "Vigentes", value: String(cuenta.vigente) },
      { label: "Pendientes", value: String(cuenta.pendiente) },
      { label: "Vencidas", value: String(cuenta.vencida) },
    ],
  }
}

// ---------- Productos más vendidos ----------
async function reporteMasVendidos(desdeStr?: string, hastaStr?: string): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("venta_items")
    .select(
      "cantidad, subtotal_linea, productos(codigo, descripcion), ventas!inner(creado_en)"
    )
    .gte("ventas.creado_en", desde.toISOString())
    .lte("ventas.creado_en", hasta.toISOString())

  const items = (data ?? []) as unknown as {
    cantidad: number
    subtotal_linea: number
    productos: { codigo: string; descripcion: string } | null
  }[]

  const acumulado = new Map<string, { codigo: string; descripcion: string; cantidad: number; total: number }>()
  for (const it of items) {
    const codigo = it.productos?.codigo ?? "—"
    const prev =
      acumulado.get(codigo) ?? {
        codigo,
        descripcion: it.productos?.descripcion ?? "",
        cantidad: 0,
        total: 0,
      }
    prev.cantidad += Number(it.cantidad)
    prev.total += Number(it.subtotal_linea)
    acumulado.set(codigo, prev)
  }

  const ordenados = Array.from(acumulado.values()).sort((a, b) => b.cantidad - a.cantidad)
  const totalUnidades = ordenados.reduce((acc, p) => acc + p.cantidad, 0)

  return {
    tipo: "mas_vendidos",
    titulo: "Productos más vendidos",
    subtitulo: etiquetaRango(desde, hasta),
    columnas: [
      { key: "codigo", label: "Código" },
      { key: "descripcion", label: "Descripción" },
      { key: "cantidad", label: "Unidades", align: "right" },
      { key: "total", label: "Total vendido", align: "right" },
    ],
    filas: ordenados.map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      total: bs(p.total),
    })),
    resumen: [
      { label: "Productos distintos", value: String(ordenados.length) },
      { label: "Unidades vendidas", value: String(totalUnidades) },
      { label: "Más vendido", value: ordenados[0]?.codigo ?? "—" },
    ],
    grafico: ordenados.slice(0, 8).map((p) => ({ etiqueta: p.codigo, total: p.cantidad })),
  }
}

// ---------- Estado de inventario por línea/marca ----------
async function reporteInventario(): Promise<ReporteResultado> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("productos")
    .select("linea_marca, stock_actual, stock_minimo, precio")
    .eq("activo", true)

  const productos = data ?? []

  const acumulado = new Map<
    string,
    { linea: string; productos: number; unidades: number; valorizacion: number; bajoMinimo: number }
  >()
  for (const p of productos) {
    const linea = p.linea_marca?.trim() || "Sin línea"
    const prev =
      acumulado.get(linea) ?? { linea, productos: 0, unidades: 0, valorizacion: 0, bajoMinimo: 0 }
    prev.productos += 1
    prev.unidades += Number(p.stock_actual)
    prev.valorizacion += Number(p.stock_actual) * Number(p.precio)
    if (Number(p.stock_actual) <= Number(p.stock_minimo)) prev.bajoMinimo += 1
    acumulado.set(linea, prev)
  }

  const ordenados = Array.from(acumulado.values()).sort((a, b) => b.valorizacion - a.valorizacion)
  const valorTotal = ordenados.reduce((acc, l) => acc + l.valorizacion, 0)
  const unidadesTotal = ordenados.reduce((acc, l) => acc + l.unidades, 0)
  const bajoMinimoTotal = ordenados.reduce((acc, l) => acc + l.bajoMinimo, 0)

  // ---------- Stock en tránsito (Parte III · H2) ----------
  // Pedidos despachados y no recibidos: el stock salió del origen pero todavía no
  // entró al destino, así que NO está en ninguna sucursal. Se muestra como bloque
  // aparte (no se suma al inventario), valorizado al costo FIFO del origen y con
  // el recorrido origen → destino.
  const { data: transitoData } = await supabase
    .from("pedido_traspaso_items")
    .select(
      `cantidad, costo_fifo_unitario,
       producto:productos(codigo, descripcion),
       pedido:pedidos_traspaso!inner(
         numero, fecha_envio, estado,
         origen:sucursales!pedidos_traspaso_sucursal_origen_id_fkey(nombre),
         destino:sucursales!pedidos_traspaso_sucursal_destino_id_fkey(nombre)
       )`
    )
    .eq("pedido.estado", "enviado")
    .gt("cantidad", 0)

  const transito = (transitoData ?? []) as unknown as {
    cantidad: number
    costo_fifo_unitario: number
    producto: { codigo: string; descripcion: string } | null
    pedido: {
      numero: string
      fecha_envio: string | null
      origen: { nombre: string } | null
      destino: { nombre: string } | null
    } | null
  }[]

  const valorTransito = transito.reduce((acc, t) => acc + t.cantidad * Number(t.costo_fifo_unitario), 0)

  const bloqueExtra =
    transito.length > 0
      ? {
          titulo: "Stock en tránsito (despachado, aún no recibido)",
          hojaExcel: "En tránsito",
          mensajeVacio: "Sin stock en tránsito.",
          columnaAncha: 1,
          columnas: [
            { key: "pedido", label: "Pedido" },
            { key: "producto", label: "Producto" },
            { key: "cantidad", label: "Cantidad", align: "right" as const },
            { key: "recorrido", label: "Recorrido" },
            { key: "enviado", label: "Enviado" },
            { key: "valor", label: "Valor (costo FIFO)", align: "right" as const },
          ],
          filas: transito.map((t) => ({
            pedido: t.pedido?.numero ?? "—",
            producto: `${t.producto?.codigo ?? "—"} — ${t.producto?.descripcion ?? ""}`,
            cantidad: t.cantidad,
            recorrido: `${t.pedido?.origen?.nombre ?? "?"} → ${t.pedido?.destino?.nombre ?? "?"}`,
            enviado: t.pedido?.fecha_envio
              ? format(new Date(t.pedido.fecha_envio), "dd/MM/yyyy", { locale: es })
              : "—",
            valor: bs(t.cantidad * Number(t.costo_fifo_unitario)),
          })),
        }
      : undefined

  return {
    tipo: "inventario",
    titulo: "Estado de inventario por línea",
    subtitulo: `Al ${format(new Date(), "dd/MM/yyyy", { locale: es })}`,
    columnas: [
      { key: "linea", label: "Línea / marca" },
      { key: "productos", label: "Productos", align: "right" },
      { key: "unidades", label: "Unidades", align: "right" },
      { key: "bajoMinimo", label: "Bajo mínimo", align: "right" },
      { key: "valorizacion", label: "Valorización", align: "right" },
    ],
    filas: ordenados.map((l) => ({
      linea: l.linea,
      productos: l.productos,
      unidades: l.unidades,
      bajoMinimo: l.bajoMinimo,
      valorizacion: bs(l.valorizacion),
    })),
    resumen: [
      { label: "Valorización total", value: bs(valorTotal) },
      { label: "Unidades en stock", value: String(unidadesTotal) },
      { label: "Productos bajo mínimo", value: String(bajoMinimoTotal) },
      { label: "Valor en tránsito", value: bs(valorTransito) },
    ],
    bloqueExtra,
  }
}

// ---------- Rentabilidad: con factura y sin factura por separado (PLAN_6 · T4) ----------
// Suma en SQL (fn_reporte_rentabilidad, script 43, solo admin) con cortes en hora
// de Bolivia. Las dos tablas NUNCA se suman entre sí: no hay total combinado.
type FilaRentabilidadSql = {
  periodo: string // yyyy-MM-dd: inicio del período (fecha de Bolivia)
  con_factura: boolean
  cantidad_ventas: number
  ingresos: number
  costo_ventas: number
  lineas_sin_costo: number
}

const round2 = (n: number) => Math.round(n * 100) / 100
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const margenTxt = (utilidad: number, ingresos: number) =>
  ingresos > 0 ? `${((utilidad / ingresos) * 100).toFixed(1)} %` : "—"

function etiquetaPeriodoRentabilidad(iso: string, periodo: Periodo) {
  // Mediodía UTC: misma fecha calendario en cualquier huso del servidor.
  const d = new Date(`${iso}T12:00:00Z`)
  if (periodo === "mensual") return format(d, "MMM yyyy", { locale: es })
  if (periodo === "semanal") return `Sem. ${format(d, "dd/MM", { locale: es })}`
  return format(d, "dd/MM/yyyy", { locale: es })
}

async function reporteRentabilidad(
  desdeStr?: string,
  hastaStr?: string,
  periodo: Periodo = "diario"
): Promise<ReporteResultado> {
  const supabase = await createClient()
  const hoy = diaBolivia(new Date())
  const hasta = hastaStr || hoy
  const desde = desdeStr || `${hoy.slice(0, 8)}01`

  const columnas: Columna[] = [
    { key: "periodo", label: "Período" },
    { key: "ventas", label: "N.º ventas", align: "right" },
    { key: "ingresos", label: "Ingresos", align: "right" },
    { key: "costo", label: "Costo de ventas", align: "right" },
    { key: "utilidad", label: "Utilidad bruta", align: "right" },
    { key: "margen", label: "Margen", align: "right" },
  ]
  const base = {
    tipo: "rentabilidad" as const,
    titulo: "Rentabilidad con factura y sin factura",
    columnas,
    tituloTabla: "Con factura",
    hojaExcel: "Con factura",
  }
  const subtitulo = `${fechaCorta(desde)} — ${fechaCorta(hasta)} · agrupado ${periodo} · antes de impuestos`

  const { data, error } = await supabase.rpc("fn_reporte_rentabilidad", {
    p_desde: desde,
    p_hasta: hasta,
    p_agrupacion: periodo,
  })
  if (error) {
    logError("reportes.rentabilidad", error, { desde, hasta, periodo })
    return {
      ...base,
      subtitulo: "No se pudo calcular. Verificá que el script 43_rentabilidad_por_factura.sql esté corrido.",
      filas: [],
      resumen: [],
    }
  }

  const filasSql = (data ?? []) as FilaRentabilidadSql[]

  function tabla(conFactura: boolean) {
    const rows = filasSql.filter((r) => r.con_factura === conFactura)
    const tot = { ventas: 0, ingresos: 0, costo: 0, sinCosto: 0 }
    const filas: Fila[] = rows.map((r) => {
      const ingresos = Number(r.ingresos)
      const costo = Number(r.costo_ventas)
      tot.ventas += Number(r.cantidad_ventas)
      tot.ingresos += ingresos
      tot.costo += costo
      tot.sinCosto += Number(r.lineas_sin_costo)
      return {
        periodo: etiquetaPeriodoRentabilidad(r.periodo, periodo),
        ventas: Number(r.cantidad_ventas),
        ingresos: bs(ingresos),
        costo: bs(costo),
        utilidad: bs(ingresos - costo),
        margen: margenTxt(ingresos - costo, ingresos),
      }
    })
    if (rows.length > 0) {
      filas.push({
        periodo: "TOTAL",
        ventas: tot.ventas,
        ingresos: bs(tot.ingresos),
        costo: bs(tot.costo),
        utilidad: bs(tot.ingresos - tot.costo),
        margen: margenTxt(tot.ingresos - tot.costo, tot.ingresos),
      })
    }
    return { filas, tot, utilidad: tot.ingresos - tot.costo }
  }

  const cf = tabla(true)
  const sf = tabla(false)

  // Gráfico: utilidad bruta por período, una serie por tipo de factura.
  const periodos = Array.from(new Set(filasSql.map((r) => r.periodo))).sort()
  const utilidadDe = (p: string, conFactura: boolean) => {
    const r = filasSql.find((x) => x.periodo === p && x.con_factura === conFactura)
    return r ? round2(Number(r.ingresos) - Number(r.costo_ventas)) : 0
  }

  const sinCosto = cf.tot.sinCosto + sf.tot.sinCosto

  return {
    ...base,
    subtitulo:
      sinCosto > 0
        ? `${subtitulo} · Atención: ${sinCosto} línea(s) vendida(s) sin costo registrado (utilidad sobreestimada)`
        : subtitulo,
    filas: cf.filas,
    resumen: [
      { label: "Con factura · utilidad bruta", value: bs(cf.utilidad) },
      { label: "Con factura · margen", value: margenTxt(cf.utilidad, cf.tot.ingresos) },
      { label: "Sin factura · utilidad bruta", value: bs(sf.utilidad) },
      { label: "Sin factura · margen", value: margenTxt(sf.utilidad, sf.tot.ingresos) },
    ],
    grafico: periodos.map((p) => ({
      etiqueta: etiquetaPeriodoRentabilidad(p, periodo),
      total: utilidadDe(p, true),
      total2: utilidadDe(p, false),
    })),
    graficoSeries: { total: "Con factura", total2: "Sin factura (S/F)" },
    bloqueExtra: {
      titulo: "Sin factura (S/F)",
      columnas,
      filas: sf.filas,
      hojaExcel: "Sin factura (SF)",
      mensajeVacio: "No hubo ventas sin factura en el período.",
      columnaAncha: 0,
    },
  }
}

// Punto de entrada único usado por page, actions y ruta PDF.
export async function generarReporte(
  tipo: ReporteTipo,
  params: { desde?: string; hasta?: string; periodo?: Periodo } = {}
): Promise<ReporteResultado> {
  switch (tipo) {
    case "proformas":
      return reporteProformas(params.desde, params.hasta)
    case "mas_vendidos":
      return reporteMasVendidos(params.desde, params.hasta)
    case "inventario":
      return reporteInventario()
    case "rentabilidad":
      return reporteRentabilidad(params.desde, params.hasta, params.periodo ?? "diario")
    case "ventas":
    default:
      return reporteVentas(params.desde, params.hasta, params.periodo ?? "diario")
  }
}
