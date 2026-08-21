"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { FileText, Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  proformaSchema,
  calcularSubtotalLinea,
  calcularTotales,
  type ProformaInput,
} from "@/lib/validations/proforma"
import { buscarProductosParaProforma, createProforma, type ProductoBusqueda } from "./actions"
import { precioSegunCantidad, type EscalaPrecio } from "@/lib/precios-mayor"
import { formatearMedidas } from "@/lib/medidas"
import { TIPOS_PAGO } from "@/lib/tipos-pago"
import { avisarBusqueda } from "@/lib/avisar-busqueda"
import { Paginacion } from "@/components/shared/paginacion"

const VACIO: ProformaInput = {
  cliente_id: "",
  tipo_pago: "",
  // Q20 (Sprint 6): vigencia fija en 3 días; ya no se pide en el formulario.
  plazo_validez_dias: 3,
  tiempo_entrega_dias: 0,
  glosa: "",
  descuento_tipo: "ninguno",
  descuento_valor: 0,
  impuesto_porcentaje: 0,
  items: [],
}

const bs = (n: number) => `Bs ${n.toFixed(2)}`

export function ProformaForm() {
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
    formState: { errors },
  } = useForm<ProformaInput>({
    resolver: zodResolver(proformaSchema),
    defaultValues: VACIO,
  })

  const items = useFieldArray({ control, name: "items" })
  // C3: precio base + escalas vigentes por producto agregado, para recalcular
  // el precio unitario cuando cambia la cantidad.
  const preciosRef = useRef(new Map<string, { base: number; escalas: EscalaPrecio[] }>())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valores = watch()
  const totales = calcularTotales(
    valores.items ?? [],
    valores.descuento_tipo,
    valores.descuento_valor ?? 0,
    valores.impuesto_porcentaje ?? 0
  )
  const resultadosPagina = resultados.slice(pagina * tamano, (pagina + 1) * tamano)

  // Consulta real al servidor.
  async function ejecutarBusqueda(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaProforma(texto, camposBusqueda)
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

  function agregarProducto(p: ProductoBusqueda) {
    if (items.fields.some((f) => f.producto_id === p.id)) {
      toast.error("Ese producto ya está en la proforma.")
      return
    }
    preciosRef.current.set(p.id, { base: p.precio, escalas: p.escalas })
    items.append({
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      cantidad: 1,
      precio_unitario: p.precio,
      descuento_tipo: "ninguno",
      descuento_valor: 0,
    })
    // T3: los resultados quedan a la vista para agregar varios seguidos.
  }

  async function onSubmit(values: ProformaInput) {
    setLoading(true)
    const result = await createProforma(values)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Proforma ${result.numero} creada.`)
    router.push("/proformas")
  }

  const cantItems = items.fields.length

  return (
    <div className="space-y-4">
      {/* 1. Cliente + pago + entrega */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
          <BuscadorCliente
            value={clienteSel}
            onChange={(c) => {
              setClienteSel(c)
              setValue("cliente_id", c?.id ?? "")
            }}
          />
          {errors.cliente_id && (
            <p className="text-sm text-destructive">{errors.cliente_id.message}</p>
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
          <Label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="tiempo_entrega_dias">
            Entrega (días)
          </Label>
          <Input
            id="tiempo_entrega_dias"
            type="number"
            min={0}
            className="h-10"
            placeholder="0 = no indicar"
            {...register("tiempo_entrega_dias")}
          />
        </div>
      </div>

      {/* 2. Buscador */}
      <div className="space-y-3">
        <Label className="text-base">Agregar productos</Label>
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

        {resultados.length > 0 && (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {resultadosPagina.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <span className="text-base font-semibold">{r.codigo}</span>
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
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Precio</p>
                  <p className="text-lg font-bold text-primary">{bs(r.precio)}</p>
                  {r.unidad && r.unidad !== "unidad" && (
                    <p className="text-[11px] text-muted-foreground">/ {r.unidad}</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => agregarProducto(r)}
                  className="shrink-0"
                  title="Agregar a la proforma"
                >
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>
            ))}
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

      {/* 3. Ítems + totales + glosa + crear */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Ítems</h2>
          {cantItems > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">
              {cantItems} ítem{cantItems === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}

        {items.fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
            <FileText className="size-8 opacity-40" />
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
                      className="h-9 text-center text-sm font-medium"
                      {...register(`items.${index}.cantidad`, {
                        onChange: (e) =>
                          ajustarPrecioPorCantidad(index, field.producto_id, Number(e.target.value)),
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
                            v as ProformaInput["items"][number]["descuento_tipo"]
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

        {/* Descuento global + impuesto + glosa + totales */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="w-full max-w-md space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Descuento global</Label>
                <div className="flex gap-1">
                  <Select
                    value={valores.descuento_tipo ?? "ninguno"}
                    onValueChange={(v) => setValue("descuento_tipo", v as ProformaInput["descuento_tipo"])}
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
            <div className="space-y-1">
              <Label htmlFor="glosa" className="text-xs">Glosa (opcional)</Label>
              <Textarea id="glosa" rows={2} {...register("glosa")} />
            </div>
          </div>

          <div className="w-full space-y-2 rounded-lg border border-border p-4 lg:max-w-sm">
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

        <Button type="submit" className="h-14 w-full text-lg font-semibold" disabled={loading}>
          {loading ? "Guardando..." : "Crear proforma"}
        </Button>
      </form>
    </div>
  )
}
