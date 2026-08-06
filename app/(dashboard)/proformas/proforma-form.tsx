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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

export function ProformaForm({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [clienteSel, setClienteSel] = useState<ClienteSel | null>(null)
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProformaInput>({
    resolver: zodResolver(proformaSchema),
    defaultValues: VACIO,
  })

  const items = useFieldArray({ control, name: "items" })
  // C3: precio base + escalas vigentes por producto agregado, para recalcular
  // el precio unitario cuando cambia la cantidad.
  const preciosRef = useRef(new Map<string, { base: number; escalas: EscalaPrecio[] }>())
  const valores = watch()
  const totales = calcularTotales(
    valores.items ?? [],
    valores.descuento_tipo,
    valores.descuento_valor ?? 0,
    valores.impuesto_porcentaje ?? 0
  )

  function limpiar() {
    reset(VACIO)
    setResultados([])
    setBusqueda("")
    setClienteSel(null)
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
    setBusqueda("")
    setResultados([])
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
    setOpen(false)
    limpiar()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) limpiar()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-6xl overflow-hidden p-0 sm:rounded-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border bg-muted/30 px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="size-5 text-primary" /> Nueva proforma
            </DialogTitle>
            <DialogDescription>
              Elegí el cliente, agregá productos y definí descuentos e impuesto.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* Datos generales */}
            <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tipo_pago">Tipo de pago</Label>
                  <Input id="tipo_pago" className="h-11" placeholder="Contado / Crédito" {...register("tipo_pago")} />
                </div>
                {/* Q20: la "Validez" ya no se pide (vigencia fija de 3 días). */}
                <div className="space-y-2">
                  <Label htmlFor="tiempo_entrega_dias">Entrega (días)</Label>
                  <Input
                    id="tiempo_entrega_dias"
                    type="number"
                    min={0}
                    className="h-11"
                    placeholder="0 = no indicar"
                    {...register("tiempo_entrega_dias")}
                  />
                </div>
              </div>
            </div>

            {/* Buscar productos */}
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
                    // F3: Enter agrega el primer resultado. preventDefault ademas
                    // evita que el Enter dispare el submit del <form> del modal.
                    // Se ignora mientras busca o si no hay resultados.
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
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {resultados.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => agregarProducto(r)}
                      className="flex w-full items-start justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block">
                          <span className="text-base font-semibold">{r.codigo}</span>{" "}
                          <span className="text-muted-foreground">— {r.descripcion}</span>
                        </span>
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
                      <span className="flex shrink-0 flex-col items-end text-base font-semibold text-primary">
                        <span className="flex items-center gap-2">
                          {bs(r.precio)}
                          <Plus className="size-5" />
                        </span>
                        {r.unidad && r.unidad !== "unidad" && (
                          <span className="text-[11px] font-normal text-muted-foreground">/ {r.unidad}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ítems + resumen (2 columnas) */}
            <div className="grid gap-8 lg:grid-cols-[1fr_27rem]">
              <div className="space-y-3">
                <Label className="text-base">Ítems</Label>
                {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}
                {items.fields.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
                    <FileText className="size-8 opacity-40" />
                    <p className="text-base">Todavía no agregaste productos.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
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
                          className="space-y-2.5 rounded-xl border border-border bg-background p-3.5 shadow-sm transition-colors hover:border-primary/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-base font-semibold">{field.codigo}</p>
                              <p className="text-sm text-muted-foreground">{field.descripcion}</p>
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
                          <div className="grid grid-cols-[4.5rem_7rem_1fr_auto] items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Cant.</Label>
                              <Input
                                type="number"
                                min={1}
                                className="h-11 text-base font-medium"
                                {...register(`items.${index}.cantidad`, {
                                  onChange: (e) =>
                                    ajustarPrecioPorCantidad(
                                      index,
                                      field.producto_id,
                                      Number(e.target.value)
                                    ),
                                })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Precio Bs</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className="h-11 text-base"
                                {...register(`items.${index}.precio_unitario`)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Descuento</Label>
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
                                  <SelectTrigger className="h-11 w-[4.5rem]">
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
                                  className="h-11 text-base"
                                  disabled={!linea?.descuento_tipo || linea.descuento_tipo === "ninguno"}
                                  {...register(`items.${index}.descuento_valor`)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1 text-right">
                              <Label className="text-xs">Subtotal</Label>
                              <p className="whitespace-nowrap pb-2 text-lg font-bold text-primary">{bs(subtotalLinea)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Descuento global</Label>
                    <div className="flex gap-1">
                      <Select
                        value={valores.descuento_tipo ?? "ninguno"}
                        onValueChange={(v) =>
                          setValue("descuento_tipo", v as ProformaInput["descuento_tipo"])
                        }
                      >
                        <SelectTrigger className="h-11 w-[4.5rem]">
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
                        className="h-11 text-base"
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

                <div className="space-y-2">
                  <Label htmlFor="glosa">Glosa (opcional)</Label>
                  <Textarea id="glosa" rows={2} {...register("glosa")} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border p-4">
            <Button type="submit" className="h-14 w-full text-lg font-semibold" disabled={loading}>
              {loading ? "Guardando..." : "Crear proforma"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
