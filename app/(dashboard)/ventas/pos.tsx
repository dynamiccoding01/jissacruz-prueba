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
import { ventaSchema, calcularSubtotalLinea, calcularTotales, type VentaInput } from "@/lib/validations/venta"
import { TIPOS_PAGO } from "@/lib/tipos-pago"
import { avisarBusqueda } from "@/lib/avisar-busqueda"
import { Paginacion } from "@/components/shared/paginacion"
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
    avisarBusqueda(data.length)
    setPagina(0)
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
    // T6: si el producto es "S/F", se sugiere marcar la venta como sin factura.
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
    // T3: los resultados quedan a la vista para poder agregar varios seguidos.
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
    limpiar()
    router.refresh()
  }

  const cantItems = items.fields.length

  return (
    <div className="space-y-4">
      {/* 1. Cliente + pago (cabecera) */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente (opcional)</Label>
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
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de pago</Label>
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
              // Enter agrega el primer resultado (si hay).
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
              return (
                <div
                  key={r.id}
                  className={cn("flex items-center gap-3 p-3", sinStock && "opacity-60")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{r.codigo}</span>
                      {!r.con_factura && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          S/F
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
                    disabled={sinStock}
                    onClick={() => agregarProducto(r)}
                    className="shrink-0"
                    title={sinStock ? "Sin stock en tu sucursal" : "Agregar al pedido"}
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

      {/* 4. Pedido + totales + confirmar */}
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

        {/* Descuento global + impuesto + totales */}
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
            {loading ? "Registrando..." : "Confirmar venta"}
          </Button>
        </div>
      </form>
    </div>
  )
}
