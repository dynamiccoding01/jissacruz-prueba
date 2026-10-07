"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, ArrowRightLeft, Download, Plus, RefreshCw, Search, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import {
  proformaSchema,
  calcularSubtotalLinea,
  calcularTotales,
  type ProformaInput,
} from "@/lib/validations/proforma"
import { precioSegunCantidad, type EscalaPrecio } from "@/lib/precios-mayor"
import {
  buscarProductosParaProforma,
  convertirProformaAVenta,
  revalidarProforma,
  updateProforma,
  type ProductoBusqueda,
  type ProformaDetalle,
  type EstadoEfectivo,
} from "../actions"

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

const ESTADO_ESTILO: Record<EstadoEfectivo, string> = {
  vigente: "bg-green-100 text-green-800 border-green-300",
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  convertida: "bg-blue-100 text-blue-800 border-blue-300",
  vencida: "bg-gray-100 text-gray-700 border-gray-300",
}
const ESTADO_ETIQUETA: Record<EstadoEfectivo, string> = {
  vigente: "Vigente",
  pendiente: "Pendiente — revisar precios",
  convertida: "Convertida",
  vencida: "Vencida",
}

export function ProformaDetalleView({ detalle }: { detalle: ProformaDetalle }) {
  const router = useRouter()
  const editable = detalle.estado_efectivo === "vigente" || detalle.estado_efectivo === "pendiente"
  const esPendiente = detalle.estado_efectivo === "pendiente"

  const [busqueda, setBusqueda] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, startGuardar] = useTransition()
  const [convirtiendo, startConvertir] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm<ProformaInput>({
    resolver: zodResolver(proformaSchema),
    defaultValues: {
      cliente_id: detalle.cliente_id,
      tipo_pago: detalle.tipo_pago ?? "",
      plazo_validez_dias: detalle.plazo_validez_dias,
      tiempo_entrega_dias: detalle.tiempo_entrega_dias ?? 0,
      glosa: detalle.glosa ?? "",
      // T1 (PLAN_6): sin descuentos; una proforma vieja que los tenía los pierde al guardar.
      descuento_tipo: "ninguno",
      descuento_valor: 0,
      impuesto_porcentaje: detalle.impuesto_porcentaje,
      items: detalle.items.map((i) => ({
        producto_id: i.producto_id,
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento_tipo: "ninguno",
        descuento_valor: 0,
      })),
    },
  })

  const items = useFieldArray({ control, name: "items" })
  // Precio actual + escalas por mayor vigentes de cada producto (los que ya
  // estaban y los que se agregan acá): de ahí salen el ajuste por cantidad y el
  // precio mínimo de T2 (PLAN_6).
  const preciosRef = useRef(
    new Map<string, { base: number; escalas: EscalaPrecio[] }>(
      detalle.items.map((i) => [i.producto_id, { base: i.precio_actual, escalas: i.escalas }])
    )
  )
  // precio ACTUAL del producto, para comparar contra el de la proforma (Q23)
  const preciosActualRef = useRef(
    new Map<string, number>(detalle.items.map((i) => [i.producto_id, i.precio_actual]))
  )
  // T4 (PLAN_6): con/sin factura por producto; la proforma no mezcla tipos.
  const conFacturaRef = useRef(
    new Map<string, boolean>(detalle.items.map((i) => [i.producto_id, i.con_factura]))
  )

  const valores = watch()
  const proformaConFactura: boolean | null =
    items.fields.length > 0 ? conFacturaRef.current.get(items.fields[0].producto_id) ?? true : null
  const totales = calcularTotales(valores.items ?? [], "ninguno", 0, valores.impuesto_porcentaje ?? 0)

  // T2 (PLAN_6): precio mínimo = precio del sistema para esa cantidad.
  function precioMinimo(productoId: string, cantidad: number): number {
    const info = preciosRef.current.get(productoId)
    if (!info) return 0
    return precioSegunCantidad(info.base, info.escalas, cantidad)
  }

  function onPrecioBlur(index: number, productoId: string) {
    const linea = valores.items?.[index]
    const minimo = precioMinimo(productoId, Number(linea?.cantidad) || 1)
    if ((Number(linea?.precio_unitario) || 0) < minimo) {
      setValue(`items.${index}.precio_unitario`, minimo)
      toast.error(`El precio no puede ser menor a ${bs(minimo)} (precio del sistema).`)
    }
  }

  async function onBuscar(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    setBusqueda(texto)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaProforma(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (busqueda.trim()) onBuscar(busqueda, next)
  }

  function ajustarPrecioPorCantidad(index: number, productoId: string, cantidad: number) {
    const info = preciosRef.current.get(productoId)
    if (!info || info.escalas.length === 0) return
    setValue(`items.${index}.precio_unitario`, precioSegunCantidad(info.base, info.escalas, cantidad))
  }

  function agregarProducto(p: ProductoBusqueda) {
    // Igual que al crear (T4 PLAN_5): no se proforma un producto sin precio.
    if (p.precio <= 0) {
      toast.error("Ese producto no tiene precio; asignale un precio antes de agregarlo.")
      return
    }
    if (items.fields.some((f) => f.producto_id === p.id)) {
      toast.error("Ese producto ya está en la proforma.")
      return
    }
    if (proformaConFactura !== null && p.con_factura !== proformaConFactura) {
      toast.error(
        proformaConFactura
          ? "Esta proforma es con factura: los productos S/F van en una proforma aparte."
          : "Esta proforma es sin factura (S/F): los productos con factura van en una proforma aparte."
      )
      return
    }
    preciosRef.current.set(p.id, { base: p.precio, escalas: p.escalas })
    preciosActualRef.current.set(p.id, p.precio)
    conFacturaRef.current.set(p.id, p.con_factura)
    items.append({
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidad: p.unidad,
      cantidad: 1,
      precio_unitario: p.precio,
      descuento_tipo: "ninguno",
      descuento_valor: 0,
    })
    setBusqueda("")
    setResultados([])
  }

  // Q32: pone en todas las líneas el precio actual del producto (con el precio
  // por mayor si la cantidad alcanza una escala — T2 PLAN_6).
  function traerPreciosActuales() {
    items.fields.forEach((f, index) => {
      if (!preciosRef.current.has(f.producto_id)) return
      const cantidad = Number(valores.items?.[index]?.cantidad) || 1
      setValue(`items.${index}.precio_unitario`, precioMinimo(f.producto_id, cantidad))
    })
    toast.success("Precios actualizados a los vigentes. Revisá y guardá.")
  }

  function onGuardar(values: ProformaInput) {
    const bajoMinimo = values.items.find(
      (i) => (Number(i.precio_unitario) || 0) < precioMinimo(i.producto_id, Number(i.cantidad) || 1)
    )
    if (bajoMinimo) {
      toast.error(
        `El precio de ${bajoMinimo.codigo} está por debajo del precio del sistema. Usá "Traer precios actuales" o subilo.`
      )
      return
    }
    startGuardar(async () => {
      const res = await updateProforma(detalle.id, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Proforma actualizada y revalidada (vigente de nuevo).")
      router.refresh()
    })
  }

  function onRevalidar() {
    startGuardar(async () => {
      const res = await revalidarProforma(detalle.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Proforma revalidada: vigente de nuevo.")
      router.refresh()
    })
  }

  function onConvertir() {
    startConvertir(async () => {
      const res = await convertirProformaAVenta(detalle.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Proforma ${detalle.numero} convertida en venta ${res.numero}.`, {
        action: res.id
          ? {
              label: "Ver comprobante",
              onClick: () => window.open(`/api/pdf/venta/${res.id}`, "_blank"),
            }
          : undefined,
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 text-muted-foreground" asChild>
            <Link href="/proformas">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Proforma {detalle.numero}</h1>
            <Badge variant="outline" className={cn("font-medium", ESTADO_ESTILO[detalle.estado_efectivo])}>
              {ESTADO_ETIQUETA[detalle.estado_efectivo]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detalle.cliente?.nombre ?? "Sin cliente"}
            {detalle.cliente?.ci_nit ? ` · ${detalle.cliente.ci_nit}` : ""}
            {" · "}
            {new Date(detalle.creado_en).toLocaleDateString("es-BO")}
          </p>
        </div>

        <a href={`/api/pdf/proforma/${detalle.id}`} target="_blank" rel="noreferrer">
          <Button variant="outline" className="gap-1">
            <Download className="size-4" /> PDF
          </Button>
        </a>
      </div>

      {/* Aviso segun estado */}
      {esPendiente && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Esta proforma superó su vigencia de {detalle.plazo_validez_dias} día(s). Revisá los precios
          (los que cambiaron aparecen resaltados), guardá para revalidarla y recién ahí vas a poder
          convertirla en venta.
        </div>
      )}
      {detalle.estado_efectivo === "vencida" && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Proforma vencida (más de 3 meses desde su creación). Es de solo lectura; si el cliente
          vuelve, creá una proforma nueva.
        </div>
      )}
      {editable && detalle.tenia_descuento && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Esta proforma se hizo con descuento. Las proformas ya no llevan descuentos: si la guardás,
          el descuento se quita y el total se recalcula sin él.
        </div>
      )}
      {detalle.estado_efectivo === "convertida" && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
          Esta proforma ya fue convertida en venta. Es de solo lectura.
        </div>
      )}

      {editable ? (
        <form onSubmit={handleSubmit(onGuardar)} className="grid gap-8 lg:grid-cols-[1fr_26rem]">
          {/* Columna izquierda: buscar + ítems */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Agregar productos</Label>
              <CriteriosBusqueda value={campos} onChange={onCamposChange} />
              <div className="relative">
                <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
                <Input
                  className="h-12 pl-10 text-base"
                  placeholder="Escribí para buscar un producto..."
                  value={busqueda}
                  onChange={(e) => onBuscar(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (buscando || resultados.length === 0) return
                      agregarProducto(resultados[0])
                    }
                  }}
                />
              </div>
              {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}
              {resultados.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                  {resultados.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => agregarProducto(r)}
                      className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="text-base font-semibold">{r.codigo}</span>{" "}
                        {!r.con_factura && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            S/F
                          </span>
                        )}{" "}
                        <span className="text-muted-foreground">— {r.descripcion}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-base font-semibold text-primary">
                        {bs(r.precio)}
                        {/* T1 (PLAN_7): unidad de medida del producto. */}
                        <span className="text-xs font-normal text-muted-foreground">/ {r.unidad}</span>
                        <Plus className="size-5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base">
                Ítems
                {proformaConFactura !== null && (
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-bold",
                      proformaConFactura ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {proformaConFactura ? "Con factura" : "Sin factura (S/F)"}
                  </span>
                )}
              </Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={traerPreciosActuales}>
                <RefreshCw className="size-3.5" /> Traer precios actuales
              </Button>
            </div>

            <div className="space-y-2.5">
              {items.fields.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-12 text-center text-base text-muted-foreground">
                  No hay ítems. Agregá productos con el buscador.
                </p>
              ) : (
                items.fields.map((field, index) => {
                  const linea = valores.items?.[index]
                  const subtotalLinea = linea
                    ? calcularSubtotalLinea(linea.cantidad, linea.precio_unitario, "ninguno", 0)
                    : 0
                  const actual = preciosActualRef.current.get(field.producto_id)
                  const cambio = actual != null && Number(linea?.precio_unitario) !== actual
                  const minimo = precioMinimo(field.producto_id, Number(linea?.cantidad) || 1)
                  const bajoMinimo = (Number(linea?.precio_unitario) || 0) < minimo
                  return (
                    <div key={field.id} className="space-y-2.5 rounded-xl border border-border bg-background p-3.5 shadow-sm transition-colors hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base font-semibold">{field.codigo}</p>
                          <p className="text-sm text-muted-foreground">{field.descripcion}</p>
                          <p className="text-xs text-muted-foreground">
                            Unidad: {field.unidad || "unidad"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => items.remove(index)}
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-[4.5rem_8rem_1fr] items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Cant.</Label>
                          <Input
                            type="number"
                            min={1}
                            className="h-11 text-base font-medium"
                            {...register(`items.${index}.cantidad`, {
                              onChange: (e) =>
                                ajustarPrecioPorCantidad(index, field.producto_id, Number(e.target.value)),
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Precio Bs (mín. {Number(minimo).toFixed(2)})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={minimo}
                            className={cn(
                              "h-11 text-base",
                              cambio && "border-amber-400 bg-amber-50",
                              bajoMinimo && "border-destructive bg-destructive/5"
                            )}
                            {...register(`items.${index}.precio_unitario`, {
                              onBlur: () => onPrecioBlur(index, field.producto_id),
                            })}
                          />
                        </div>
                        <div className="space-y-1 text-right">
                          <Label className="text-xs">Subtotal</Label>
                          <p className="whitespace-nowrap pb-2 text-lg font-bold text-primary">
                            {bs(subtotalLinea)}
                          </p>
                        </div>
                      </div>
                      {cambio && (
                        <p className="text-xs font-medium text-amber-700">
                          Precio actual del producto: {bs(actual!)} (el de la proforma es {bs(Number(linea?.precio_unitario) || 0)})
                        </p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Columna derecha: resumen + acciones */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="impuesto_porcentaje">
                  Impuesto %
                </Label>
                <Input
                  id="impuesto_porcentaje"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="h-11 text-base"
                  {...register("impuesto_porcentaje")}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{bs(totales.subtotal)}</span>
              </div>
              {totales.impuesto > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">Impuesto</span>
                  <span className="font-medium">{bs(totales.impuesto)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                <span className="text-lg font-semibold uppercase tracking-wide">Total</span>
                <span className="text-3xl font-bold tabular-nums">{bs(totales.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiempo_entrega_dias" className="text-xs">
                Entrega (días)
              </Label>
              <Input
                id="tiempo_entrega_dias"
                type="number"
                min={0}
                className="h-11"
                placeholder="0 = no indicar"
                {...register("tiempo_entrega_dias")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="glosa" className="text-xs">
                Glosa (opcional)
              </Label>
              <Textarea id="glosa" rows={2} {...register("glosa")} />
            </div>

            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={guardando}>
              {guardando ? "Guardando..." : esPendiente ? "Guardar y revalidar" : "Guardar cambios"}
            </Button>

            {esPendiente && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={guardando}
                onClick={onRevalidar}
              >
                Revalidar sin cambios (precios OK)
              </Button>
            )}

            {detalle.estado_efectivo === "vigente" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="secondary" className="h-12 w-full gap-1 text-base" disabled={convirtiendo}>
                    <ArrowRightLeft className="size-4" /> Convertir a venta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Convertir {detalle.numero} en venta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se registra la venta con los ítems guardados de la proforma por{" "}
                      {bs(detalle.total)}, y se descuenta el stock correspondiente. La proforma queda
                      convertida y no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onConvertir}>Convertir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Guardá los precios revisados para revalidar y habilitar la conversión.
              </p>
            )}
          </div>
        </form>
      ) : (
        /* Solo lectura (convertida o vencida) */
        <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
          <div className="space-y-2.5">
            {detalle.items.map((it) => (
              <div key={it.producto_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold">{it.codigo}</p>
                  <p className="text-sm text-muted-foreground">{it.descripcion}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p>
                    {it.cantidad} {it.unidad} × {bs(it.precio_unitario)}
                  </p>
                  <p className="font-semibold text-primary">
                    {bs(
                      calcularSubtotalLinea(
                        it.cantidad,
                        it.precio_unitario,
                        it.descuento_tipo,
                        it.descuento_valor
                      )
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-4 lg:sticky lg:top-4 lg:self-start">
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{bs(detalle.subtotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
              <span className="text-lg font-semibold uppercase tracking-wide">Total</span>
              <span className="text-3xl font-bold tabular-nums">{bs(detalle.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
