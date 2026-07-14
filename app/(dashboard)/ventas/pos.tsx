"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ventaSchema, calcularSubtotalLinea, calcularTotales, type VentaInput } from "@/lib/validations/venta"
import { buscarProductosParaVenta, registrarVenta, type ProductoBusqueda } from "./actions"

const VACIO: VentaInput = {
  cliente_id: "",
  descuento_tipo: "ninguno",
  descuento_valor: 0,
  impuesto_porcentaje: 0,
  items: [],
}

const bs = (n: number) => `Bs ${n.toFixed(2)}`

export function Pos({ clientes }: { clientes: { id: string; nombre: string }[] }) {
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
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
    buscadorRef.current?.focus()
  }

  async function onBuscar(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    setBusqueda(texto)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaVenta(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (busqueda.trim()) onBuscar(busqueda, next)
  }

  function agregarProducto(p: ProductoBusqueda) {
    const existente = items.fields.findIndex((f) => f.producto_id === p.id)
    if (existente >= 0) {
      const actual = valores.items?.[existente]
      setValue(`items.${existente}.cantidad`, (Number(actual?.cantidad) || 0) + 1)
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
    const result = await registrarVenta(values)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Venta ${result.numero} registrada.`, {
      action: result.id
        ? {
            label: "Ver comprobante",
            onClick: () => window.open(`/api/pdf/venta/${result.id}`, "_blank"),
          }
        : undefined,
    })
    limpiar()
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-3">
        <Label>Buscar producto</Label>
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
          />
        </div>
        {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {resultados.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => agregarProducto(r)}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary hover:bg-muted/40"
            >
              <span>
                <span className="block font-medium">{r.codigo}</span>
                <span className="block text-xs text-muted-foreground">{r.descripcion}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 font-medium text-primary">
                {bs(r.precio)}
                <Plus className="size-4" />
              </span>
            </button>
          ))}
          {!buscando && busqueda.trim() && resultados.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground">
              Sin resultados para &quot;{busqueda}&quot;.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-2">
          <Label>Cliente (opcional)</Label>
          <Select
            value={valores.cliente_id || undefined}
            onValueChange={(v) => setValue("cliente_id", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Consumidor final" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {items.fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              El carrito está vacío.
            </p>
          ) : (
            items.fields.map((field, index) => {
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
                  <div className="grid grid-cols-[3.5rem_5.5rem_1fr_4.5rem] items-end gap-1.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input type="number" min={1} {...register(`items.${index}.cantidad`)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`items.${index}.precio_unitario`)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Desc.</Label>
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
                          <SelectTrigger className="w-[3.75rem]">
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
                      <Label className="text-xs">Subt.</Label>
                      <p className="pb-2 text-sm font-medium">{bs(subtotalLinea)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
          <div className="space-y-1">
            <Label className="text-xs">Descuento global</Label>
            <div className="flex gap-1">
              <Select
                value={valores.descuento_tipo ?? "ninguno"}
                onValueChange={(v) => setValue("descuento_tipo", v as VentaInput["descuento_tipo"])}
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

        <Button type="submit" className="w-full" size="lg" disabled={loading || items.fields.length === 0}>
          {loading ? "Registrando..." : "Confirmar venta"}
        </Button>
      </div>
    </form>
  )
}
