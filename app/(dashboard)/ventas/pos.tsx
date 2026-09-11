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
import {
  ventaPendienteSchema,
  calcularSubtotalLinea,
  calcularTotales,
  type VentaPendienteInput,
} from "@/lib/validations/venta-pendiente"
import { avisarBusqueda } from "@/lib/avisar-busqueda"
import { Paginacion } from "@/components/shared/paginacion"
import { precioSegunCantidad, type EscalaPrecio } from "@/lib/precios-mayor"
import {
  buscarProductosParaVenta,
  obtenerClienteSinNombre,
  crearVentaPendiente,
  type ProductoBusqueda,
} from "./actions"

// PLAN_5 · T5: el POS ya NO cobra. Arma un PEDIDO DE VENTA (sin mover stock) y lo
// envía a CAJA, donde el cajero lo confirma/cobra (elige tipo de pago y factura).
const VACIO: VentaPendienteInput = {
  cliente_id: "",
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
  const [pagina, setPagina] = useState(0)
  const [tamano, setTamano] = useState(10)
  const buscadorRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm<VentaPendienteInput>({
    resolver: zodResolver(ventaPendienteSchema),
    defaultValues: VACIO,
  })

  const items = useFieldArray({ control, name: "items" })
  // Precio base + escalas vigentes por producto agregado, para recalcular el
  // precio unitario cuando cambia la cantidad.
  const preciosRef = useRef(new Map<string, { base: number; escalas: EscalaPrecio[] }>())
  // Stock disponible en la sucursal del POS por producto agregado, para no
  // pedir más de lo que hay (la venta descuenta solo de esa sucursal al confirmar).
  const stockRef = useRef(new Map<string, number>())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valores = watch()
  const totales = calcularTotales(
    valores.items ?? [],
    valores.descuento_tipo,
    valores.descuento_valor ?? 0,
    valores.impuesto_porcentaje ?? 0
  )
  const resultadosPagina = resultados.slice(pagina * tamano, (pagina + 1) * tamano)

  function limpiar() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    reset(VACIO)
    setResultados([])
    setBusqueda("")
    setClienteSel(null)
    stockRef.current.clear()
    buscadorRef.current?.focus()
  }

  // Botón "Sin nombre" — usa el cliente genérico SIN NOMBRE (NIT 0000).
  async function usarClienteSinNombre() {
    const c = await obtenerClienteSinNombre()
    if (!c) {
      toast.error("No se pudo usar el cliente Sin nombre.")
      return
    }
    setClienteSel(c)
    setValue("cliente_id", c.id)
  }

  async function ejecutarBusqueda(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaVenta(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
    avisarBusqueda(data.length)
    setPagina(0)
  }

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

  // Si la cantidad alcanza una escala por mayor vigente, ajusta el precio.
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
    // Sin precio (PLAN_5): no se puede vender un producto a precio 0.
    if (p.precio <= 0) {
      toast.error("Ese producto no tiene precio; asignale un precio antes de agregarlo.")
      return
    }
    // No se puede pedir lo que no hay en la sucursal desde la que opera el POS.
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
    // Los resultados quedan a la vista para poder agregar varios seguidos.
  }

  async function onSubmit(values: VentaPendienteInput) {
    setLoading(true)
    const result = await crearVentaPendiente(values)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Pedido ${result.numero} enviado a caja.`)
    limpiar()
    router.refresh()
  }

  const cantItems = items.fields.length

  return (
    <div className="space-y-4">
      {/* 1. Cliente (el pago y la factura los define la caja al cobrar) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente (opcional)</Label>
        <div className="mt-1 flex flex-col gap-2 sm:max-w-sm">
          <BuscadorCliente
            opcional
            value={clienteSel}
            onChange={(c) => {
              setClienteSel(c)
              setValue("cliente_id", c?.id ?? "")
            }}
          />
          {!clienteSel && (
            <Button type="button" variant="outline" size="sm" onClick={usarClienteSinNombre}>
              Sin nombre
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          El tipo de pago y con/sin factura los define la <strong>caja</strong> al cobrar.
        </p>
      </div>

      {/* 2. Buscador */}
      <div className="space-y-3">
        <Label className="text-base">Buscar producto</Label>
        <CriteriosBusqueda value={campos} onChange={onCamposChange} />
        <div className="relative">
          <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
          <Input
            ref={buscadorRef}
            autoFocus
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

        {/* 3. Resultados como filas (con botón Agregar) */}
        {resultados.length > 0 && (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {resultadosPagina.map((r) => {
              const sinStock = r.stockSucursalActual <= 0
              const sinPrecio = r.precio <= 0
              const bloqueado = sinStock || sinPrecio
              return (
                <div
                  key={r.id}
                  className={cn("flex items-center gap-3 p-3", bloqueado && "opacity-60")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{r.codigo}</span>
                      {!r.con_factura && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          S/F
                        </span>
                      )}
                      {sinPrecio && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                          sin precio
                        </span>
                      )}
                      <StockBadge
                        stockActual={r.stockTotal}
                        stockMinimo={r.stockMinimo}
                        stockSucursales={r.porSucursal}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{r.descripcion}</p>
                    {r.medidas.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Medidas: {formatearMedidas(r.medidas)}
                      </p>
                    )}
                    {r.originales.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        OEM: {r.originales.slice(0, 4).join(", ")}
                        {r.originales.length > 4 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Precio de venta</p>
                    <p className="text-lg font-bold text-primary">{bs(r.precio)}</p>
                    {r.unidad && r.unidad !== "unidad" && (
                      <p className="text-[11px] text-muted-foreground">/ {r.unidad}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={bloqueado}
                    onClick={() => agregarProducto(r)}
                    className="shrink-0"
                    title={
                      sinPrecio
                        ? "Sin precio: asignale un precio primero"
                        : sinStock
                          ? "Sin stock en tu sucursal"
                          : "Agregar al pedido"
                    }
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>
              )
            })}
            </div>
            <Paginacion
              total={resultados.length}
              pagina={pagina}
              tamano={tamano}
              onPaginaChange={setPagina}
              onTamanoChange={(t) => {
                setTamano(t)
                setPagina(0)
              }}
            />
          </>
        )}
        {!buscando && busqueda.trim() && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin resultados para &quot;{busqueda}&quot;.</p>
        )}
      </div>

      {/* 4. Pedido + totales + enviar a caja */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Pedido</h2>
          {cantItems > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
              {cantItems} ítem{cantItems === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {items.fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
            <ShoppingCart className="size-8 opacity-40" />
            <p className="text-base">
              Todavía no agregaste productos. Buscá arriba y apretá &quot;Agregar&quot;.
            </p>
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
                    {/* T2 (PLAN_4): el precio NO se edita a mano en el POS. Solo lectura. */}
                    <span className="whitespace-nowrap px-1 text-right text-sm font-medium tabular-nums">
                      {bs(Number(linea?.precio_unitario) || 0)}
                    </span>
                    <div className="flex gap-1">
                      <Select
                        value={linea?.descuento_tipo ?? "ninguno"}
                        onValueChange={(v) =>
                          setValue(
                            `items.${index}.descuento_tipo`,
                            v as VentaPendienteInput["items"][number]["descuento_tipo"]
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

        {/* Descuento global + impuesto + totales */}
        <div className="flex flex-col items-end gap-3">
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Descuento global</Label>
              <div className="flex gap-1">
                <Select
                  value={valores.descuento_tipo ?? "ninguno"}
                  onValueChange={(v) => setValue("descuento_tipo", v as VentaPendienteInput["descuento_tipo"])}
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

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-14"
            onClick={limpiar}
            disabled={loading}
          >
            Limpiar
          </Button>
          <Button
            type="submit"
            className="h-14 flex-1 text-lg font-semibold"
            disabled={loading || items.fields.length === 0}
          >
            {loading ? "Enviando..." : "Enviar a caja"}
          </Button>
        </div>
      </form>
    </div>
  )
}
