"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Search, ShoppingCart, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { StockBadge } from "@/components/shared/stock-badge"
import { cn } from "@/lib/utils"
import { formatearMedidas } from "@/lib/medidas"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import { BuscadorCliente, type ClienteSel } from "@/components/shared/buscador-cliente"
import { ventaSchema, calcularSubtotalLinea, calcularTotales, type VentaInput } from "@/lib/validations/venta"
import { TIPOS_PAGO } from "@/lib/tipos-pago"
import { precioSegunCantidad, type EscalaPrecio } from "@/lib/precios-mayor"
import {
  buscarProductosParaVenta,
  obtenerClienteSinNombre,
  registrarVenta,
  type ProductoBusqueda,
} from "./actions"

const VACIO: VentaInput = {
  cliente_id: "",
  tipo_pago: "",
  con_factura: true,
  descuento_tipo: "ninguno",
  descuento_valor: 0,
  impuesto_porcentaje: 0,
  items: [],
}

const bs = (n: number) => `Bs ${n.toFixed(2)}`

export function Pos() {
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [clienteSel, setClienteSel] = useState<ClienteSel | null>(null)
  const [carritoOpen, setCarritoOpen] = useState(false)
  const buscadorRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm<VentaInput>({
    resolver: zodResolver(ventaSchema),
    defaultValues: VACIO,
  })

  const items = useFieldArray({ control, name: "items" })
  // C3: precio base + escalas vigentes por producto agregado, para recalcular
  // el precio unitario cuando cambia la cantidad.
  const preciosRef = useRef(new Map<string, { base: number; escalas: EscalaPrecio[] }>())
  // Stock disponible en la sucursal del POS por producto agregado, para no
  // dejar vender más de lo que hay (la venta descuenta solo de esa sucursal).
  const stockRef = useRef(new Map<string, number>())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valores = watch()
  const totales = calcularTotales(
    valores.items ?? [],
    valores.descuento_tipo,
    valores.descuento_valor ?? 0,
    valores.impuesto_porcentaje ?? 0
  )

  function limpiar() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    reset(VACIO)
    setResultados([])
    setBusqueda("")
    setClienteSel(null)
    stockRef.current.clear()
    buscadorRef.current?.focus()
  }

  // T1 (PLAN_3): botón "Sin nombre" — usa el cliente genérico SIN NOMBRE (NIT 0000).
  async function usarClienteSinNombre() {
    const c = await obtenerClienteSinNombre()
    if (!c) {
      toast.error("No se pudo usar el cliente Sin nombre.")
      return
    }
    setClienteSel(c)
    setValue("cliente_id", c.id)
  }

  // Consulta real al servidor.
  async function ejecutarBusqueda(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaVenta(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
  }

  // En cada tecla: actualiza el texto YA (input fluido) y agenda la consulta con
  // 300ms de debounce, para no pegarle a la base en cada letra.
  function onBuscar(texto: string) {
    setBusqueda(texto)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    debounceRef.current = setTimeout(() => ejecutarBusqueda(texto, campos), 300)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (busqueda.trim()) ejecutarBusqueda(busqueda, next)
  }

  // C3: si la cantidad alcanza una escala por mayor vigente, ajusta el precio.
  function ajustarPrecioPorCantidad(index: number, productoId: string, cantidad: number) {
    const info = preciosRef.current.get(productoId)
    if (!info || info.escalas.length === 0) return
    setValue(`items.${index}.precio_unitario`, precioSegunCantidad(info.base, info.escalas, cantidad))
  }

  // Limita la cantidad de una línea al stock disponible en la sucursal del POS.
  function onCantidadChange(index: number, productoId: string, raw: string) {
    const max = stockRef.current.get(productoId) ?? Infinity
    let cantidad = Number(raw)
    if (Number.isFinite(cantidad) && cantidad > max) {
      cantidad = max
      setValue(`items.${index}.cantidad`, max)
      toast.error(`Solo hay ${max} unidad(es) en stock en tu sucursal.`)
    }
    ajustarPrecioPorCantidad(index, productoId, cantidad)
  }

  function agregarProducto(p: ProductoBusqueda) {
    // No se puede vender lo que no hay en la sucursal desde la que opera el POS.
    if (p.stockSucursalActual <= 0) {
      toast.error(
        p.stockTotal > 0
          ? "Ese producto no tiene stock en tu sucursal (hay en otra sucursal)."
          : "Ese producto no tiene stock."
      )
      return
    }
    preciosRef.current.set(p.id, { base: p.precio, escalas: p.escalas })
    stockRef.current.set(p.id, p.stockSucursalActual)
    // T6: si el producto es "S/F", se sugiere marcar la venta como sin factura
    // (el usuario lo puede cambiar en el selector "Factura" del carrito).
    if (!p.con_factura) setValue("con_factura", false)
    const existente = items.fields.findIndex((f) => f.producto_id === p.id)
    if (existente >= 0) {
      const actual = Number(valores.items?.[existente]?.cantidad) || 0
      const nuevaCantidad = Math.min(actual + 1, p.stockSucursalActual)
      if (nuevaCantidad === actual) {
        toast.error(`Solo hay ${p.stockSucursalActual} unidad(es) en stock en tu sucursal.`)
      } else {
        setValue(`items.${existente}.cantidad`, nuevaCantidad)
        ajustarPrecioPorCantidad(existente, p.id, nuevaCantidad)
      }
    } else {
      items.append({
        producto_id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        cantidad: 1,
        precio_unitario: p.precio,
        descuento_tipo: "ninguno",
        descuento_valor: 0,
      })
    }
    setBusqueda("")
    setResultados([])
    buscadorRef.current?.focus()
  }

  async function onSubmit(values: VentaInput) {
    setLoading(true)
    // la pestaña se abre ya, dentro del gesto del click, porque si se abre
    // despues del await el bloqueador de popups del navegador la corta;
    // si la venta falla se cierra sin que el usuario la vea
    const ventanaPdf = window.open("about:blank", "_blank")
    const result = await registrarVenta(values)
    setLoading(false)
    if (result.error) {
      ventanaPdf?.close()
      toast.error(result.error)
      return
    }
    if (result.id) {
      const urlPdf = `/api/pdf/venta/${result.id}`
      if (ventanaPdf) ventanaPdf.location.href = urlPdf
      else window.open(urlPdf, "_blank")
    } else {
      ventanaPdf?.close()
    }
    toast.success(`Venta ${result.numero} registrada.`)
    setCarritoOpen(false)
    limpiar()
    router.refresh()
  }

  const cantItems = items.fields.length

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base">Buscar producto</Label>
        <CriteriosBusqueda value={campos} onChange={onCamposChange} />
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
          <Input
            ref={buscadorRef}
            autoFocus
            className="h-12 pl-10 text-base"
            placeholder="Escribí para buscar un producto..."
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
            onKeyDown={(e) => {
              // F3: Enter agrega el primer resultado. Se ignora mientras la
              // busqueda esta en curso o si no hay resultados. agregarProducto
              // ya bloquea los productos sin stock en la sucursal y reenfoca.
              if (e.key === "Enter") {
                e.preventDefault()
                if (buscando || resultados.length === 0) return
                agregarProducto(resultados[0])
              }
            }}
          />
        </div>
        {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {resultados.map((r) => {
            const sinStock = r.stockSucursalActual <= 0
            return (
              <button
                type="button"
                key={r.id}
                disabled={sinStock}
                onClick={() => agregarProducto(r)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all",
                  sinStock
                    ? "cursor-not-allowed opacity-60"
                    : "hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold">{r.codigo}</span>
                      {!r.con_factura && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          S/F
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-muted-foreground">{r.descripcion}</span>
                    {r.medidas.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        Medidas: {formatearMedidas(r.medidas)}
                      </span>
                    )}
                    {r.originales.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        OEM: {r.originales.slice(0, 4).join(", ")}
                        {r.originales.length > 4 ? "…" : ""}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-primary">
                    {/* T11: precio de venta rotulado y destacado */}
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Precio de venta
                    </span>
                    <span className="flex items-center gap-2 text-lg font-bold">
                      {bs(r.precio)}
                      {!sinStock && <Plus className="size-5" />}
                    </span>
                    {r.unidad && r.unidad !== "unidad" && (
                      <span className="text-[11px] font-normal text-muted-foreground">/ {r.unidad}</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StockBadge
                    stockActual={r.stockTotal}
                    stockMinimo={r.stockMinimo}
                    stockSucursales={r.porSucursal}
                  />
                  {sinStock && (
                    <span className="shrink-0 text-[11px] font-medium text-red-600">
                      {r.stockTotal > 0 ? "Sin stock en tu sucursal" : "Sin stock"}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
          {!buscando && busqueda.trim() && resultados.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Sin resultados para &quot;{busqueda}&quot;.
            </p>
          )}
          {!busqueda.trim() && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Buscá un producto por código, descripción o equivalente para empezar la venta.
            </p>
          )}
        </div>
      </div>

      {/* Carrito: botón flotante + modal estilo factura */}
      <Dialog open={carritoOpen} onOpenChange={setCarritoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl ring-1 ring-black/10 transition-transform hover:scale-[1.03] active:scale-95"
          >
            <span className="relative">
              <ShoppingCart className="size-7" />
              {cantItems > 0 && (
                <span className="absolute -right-2.5 -top-2.5 flex min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold text-primary ring-2 ring-primary">
                  {cantItems}
                </span>
              )}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">Carrito</span>
              <span className="text-xl font-bold tabular-nums">{bs(totales.total)}</span>
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-hidden p-0 sm:rounded-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[94vh] flex-col">
            {/* Encabezado estilo factura */}
            <DialogHeader className="space-y-0 border-b-2 border-primary bg-muted/30 px-6 py-4 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-2xl font-bold tracking-tight text-primary">
                    JISSACRUZ
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">Comprobante de venta · vista previa</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{new Date().toLocaleDateString("es-BO")}</p>
                  <p className="text-muted-foreground">
                    {cantItems} ítem{cantItems === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {/* Cliente / pago (recuadro estilo factura) */}
              <div className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cliente (opcional)
                  </Label>
                  <BuscadorCliente
                    opcional
                    value={clienteSel}
                    onChange={(c) => {
                      setClienteSel(c)
                      setValue("cliente_id", c?.id ?? "")
                    }}
                  />
                  {!clienteSel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full"
                      onClick={usarClienteSinNombre}
                    >
                      Sin nombre
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tipo de pago
                  </Label>
                  <Select value={valores.tipo_pago || ""} onValueChange={(v) => setValue("tipo_pago", v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Seleccionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_PAGO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Factura</Label>
                  <Select
                    value={valores.con_factura === false ? "sin" : "con"}
                    onValueChange={(v) => setValue("con_factura", v === "con")}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="con">Con factura</SelectItem>
                      <SelectItem value="sin">Sin factura (S/F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabla de ítems estilo factura */}
              {items.fields.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
                  <ShoppingCart className="size-8 opacity-40" />
                  <p className="text-base">El comprobante está vacío. Buscá productos y agregalos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[44rem] overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[2rem_5.5rem_1fr_7rem_8.5rem_7rem_2rem] items-center gap-2 bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                      <span className="text-center">N°</span>
                      <span className="text-center">Cant.</span>
                      <span>Código / Detalle</span>
                      <span className="text-right">P. Unit.</span>
                      <span className="text-center">Descuento</span>
                      <span className="text-right">Importe</span>
                      <span />
                    </div>
                    {items.fields.map((field, index) => {
                      const linea = valores.items?.[index]
                      const subtotalLinea = linea
                        ? calcularSubtotalLinea(
                            linea.cantidad,
                            linea.precio_unitario,
                            linea.descuento_tipo,
                            linea.descuento_valor
                          )
                        : 0
                      return (
                        <div
                          key={field.id}
                          className="grid grid-cols-[2rem_5.5rem_1fr_7rem_8.5rem_7rem_2rem] items-center gap-2 border-t border-border px-3 py-2"
                        >
                          <span className="text-center text-sm text-muted-foreground">{index + 1}</span>
                          <Input
                            type="number"
                            min={1}
                            max={stockRef.current.get(field.producto_id)}
                            className="h-9 text-center text-sm font-medium"
                            {...register(`items.${index}.cantidad`, {
                              onChange: (e) => onCantidadChange(index, field.producto_id, e.target.value),
                            })}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{field.codigo}</p>
                            <p className="truncate text-xs text-muted-foreground">{field.descripcion}</p>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="h-9 text-right text-sm"
                            {...register(`items.${index}.precio_unitario`)}
                          />
                          <div className="flex gap-1">
                            <Select
                              value={linea?.descuento_tipo ?? "ninguno"}
                              onValueChange={(v) =>
                                setValue(
                                  `items.${index}.descuento_tipo`,
                                  v as VentaInput["items"][number]["descuento_tipo"]
                                )
                              }
                            >
                              <SelectTrigger className="h-9 w-[3.25rem] px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ninguno">—</SelectItem>
                                <SelectItem value="monto_fijo">Bs</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="h-9 text-right text-sm"
                              disabled={!linea?.descuento_tipo || linea.descuento_tipo === "ninguno"}
                              {...register(`items.${index}.descuento_valor`)}
                            />
                          </div>
                          <span className="whitespace-nowrap text-right text-sm font-bold text-primary">
                            {bs(subtotalLinea)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => items.remove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Totales estilo factura (a la derecha) */}
              <div className="flex flex-col items-end gap-3">
                <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Descuento global</Label>
                    <div className="flex gap-1">
                      <Select
                        value={valores.descuento_tipo ?? "ninguno"}
                        onValueChange={(v) => setValue("descuento_tipo", v as VentaInput["descuento_tipo"])}
                      >
                        <SelectTrigger className="h-10 w-[4.25rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ninguno">—</SelectItem>
                          <SelectItem value="monto_fijo">Bs</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="h-10 text-base"
                        disabled={!valores.descuento_tipo || valores.descuento_tipo === "ninguno"}
                        {...register("descuento_valor")}
                      />
                    </div>
                  </div>
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
                      className="h-10 text-base"
                      {...register("impuesto_porcentaje")}
                    />
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-2 rounded-lg border border-border p-4">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{bs(totales.subtotal)}</span>
                  </div>
                  {totales.descuento > 0 && (
                    <div className="flex justify-between text-base">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="font-medium">−{bs(totales.descuento)}</span>
                    </div>
                  )}
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
              </div>
            </div>

            <div className="border-t border-border p-4">
              <Button
                type="submit"
                className="h-14 w-full text-lg font-semibold"
                disabled={loading || items.fields.length === 0}
              >
                {loading ? "Registrando..." : "Confirmar venta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
