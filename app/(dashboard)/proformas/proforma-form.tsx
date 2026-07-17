"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Search, Trash2 } from "lucide-react"

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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

const VACIO: ProformaInput = {
  cliente_id: "",
  tipo_pago: "",
  plazo_validez_dias: 15,
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

  function agregarProducto(p: ProductoBusqueda) {
    if (items.fields.some((f) => f.producto_id === p.id)) {
      toast.error("Ese producto ya está en la proforma.")
      return
    }
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) limpiar()
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Nueva proforma</SheetTitle>
          <SheetDescription>
            Elegí el cliente, agregá productos y definí descuentos e impuesto.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
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
                <Input id="tipo_pago" placeholder="Contado / Crédito" {...register("tipo_pago")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plazo_validez_dias">Validez (días)</Label>
                <Input
                  id="plazo_validez_dias"
                  type="number"
                  min={0}
                  {...register("plazo_validez_dias")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Agregar productos</Label>
            <CriteriosBusqueda value={campos} onChange={onCamposChange} />
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Escribí para buscar un producto..."
                value={busqueda}
                onChange={(e) => onBuscar(e.target.value)}
              />
            </div>
            {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}
            {resultados.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {resultados.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => agregarProducto(r)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span>
                      <span className="font-medium">{r.codigo}</span> — {r.descripcion}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {bs(r.precio)}
                      <Plus className="size-4" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Ítems</Label>
            {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}
            {items.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no agregaste productos.</p>
            ) : (
              <div className="space-y-2">
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
                    <div key={field.id} className="space-y-2 rounded-md border border-border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{field.codigo}</p>
                          <p className="text-xs text-muted-foreground">{field.descripcion}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => items.remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-[4rem_6rem_1fr_5rem] items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Cant.</Label>
                          <Input type="number" min={1} {...register(`items.${index}.cantidad`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Precio Bs</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
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
                              <SelectTrigger className="w-[4.5rem]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ninguno">—</SelectItem>
                                <SelectItem value="porcentaje">%</SelectItem>
                                <SelectItem value="monto_fijo">Bs</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              disabled={!linea?.descuento_tipo || linea.descuento_tipo === "ninguno"}
                              {...register(`items.${index}.descuento_valor`)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <Label className="text-xs">Subtotal</Label>
                          <p className="pb-2 text-sm font-medium">{bs(subtotalLinea)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
                  <SelectTrigger className="w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">—</SelectItem>
                    <SelectItem value="porcentaje">%</SelectItem>
                    <SelectItem value="monto_fijo">Bs</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
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
                {...register("impuesto_porcentaje")}
              />
            </div>
          </div>

          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{bs(totales.subtotal)}</span>
            </div>
            {totales.descuento > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span>−{bs(totales.descuento)}</span>
              </div>
            )}
            {totales.impuesto > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impuesto</span>
                <span>{bs(totales.impuesto)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{bs(totales.total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="glosa">Glosa (opcional)</Label>
            <Textarea id="glosa" rows={2} {...register("glosa")} />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Crear proforma"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
