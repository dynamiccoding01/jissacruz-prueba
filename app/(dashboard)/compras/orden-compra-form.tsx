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
import { formatearMedidas } from "@/lib/medidas"
import { ordenCompraSchema, type OrdenCompraInput } from "@/lib/validations/compra"
import {
  buscarProductosParaCompra,
  createOrdenCompra,
  type ProductoBusquedaCompra,
} from "./actions"

const VACIO: OrdenCompraInput = {
  proveedor_id: "",
  notas: "",
  items: [],
}

const bs = (n: number) =>
  `Bs ${Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function OrdenCompraForm({
  proveedores,
  trigger,
}: {
  proveedores: { id: string; nombre: string }[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoBusquedaCompra[]>([])
  const [buscando, setBuscando] = useState(false)
  // Referencias de precio/costo por producto, para mostrarlas junto a cada ítem.
  // Van aparte del useFieldArray: son solo para la vista, no se envían.
  const [referencias, setReferencias] = useState<
    Record<string, { precio: number; ultimoCosto: number | null }>
  >({})
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrdenCompraInput>({
    resolver: zodResolver(ordenCompraSchema),
    defaultValues: VACIO,
  })

  const items = useFieldArray({ control, name: "items" })
  const proveedorId = watch("proveedor_id")
  const itemsWatch = watch("items")

  const total = (itemsWatch ?? []).reduce(
    (acc, it) => acc + Number(it?.cantidad ?? 0) * Number(it?.costo_unitario ?? 0),
    0
  )

  // Ningún ítem puede comprarse a un costo >= su precio de venta. Se bloquea el
  // botón para no llegar al submit sabiendo que va a fallar.
  const itemsInvalidos = (itemsWatch ?? []).filter(
    (it) => Number(it?.precio_venta ?? 0) <= Number(it?.costo_unitario ?? 0)
  ).length

  async function onBuscarProducto(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    setBusquedaProducto(texto)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaCompra(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (busquedaProducto.trim()) onBuscarProducto(busquedaProducto, next)
  }

  function agregarProducto(producto: ProductoBusquedaCompra) {
    if (items.fields.some((f) => f.producto_id === producto.id)) {
      toast.error("Ese producto ya está en la orden.")
      return
    }
    setReferencias((prev) => ({
      ...prev,
      [producto.id]: { precio: producto.precio, ultimoCosto: producto.ultimoCosto },
    }))
    items.append({
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      cantidad: 1,
      // Arranca en el ultimo costo real de compra, no en 0: sin esa referencia
      // se terminaban cargando costos inventados.
      costo_unitario: producto.ultimoCosto ?? 0,
      // Precio de venta actual del producto: se edita acá si la compra lo cambia.
      precio_venta: producto.precio,
    })
    setBusquedaProducto("")
    setResultados([])
  }

  async function onSubmit(values: OrdenCompraInput) {
    setLoading(true)
    const result = await createOrdenCompra(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Orden de compra creada.")
    setOpen(false)
    reset(VACIO)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          reset(VACIO)
          setResultados([])
          setBusquedaProducto("")
          setReferencias({})
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-6xl overflow-hidden p-0 sm:rounded-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-xl">Nueva orden de compra</DialogTitle>
            <DialogDescription>
              Seleccioná el proveedor y agregá los productos con cantidad y costo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Datos generales */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="max-w-md space-y-2">
                <Label>Proveedor</Label>
                <Select
                  value={proveedorId || undefined}
                  onValueChange={(v) => setValue("proveedor_id", v)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Seleccioná un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.proveedor_id && (
                  <p className="text-sm text-destructive">{errors.proveedor_id.message}</p>
                )}
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
                  value={busquedaProducto}
                  onChange={(e) => onBuscarProducto(e.target.value)}
                  onKeyDown={(e) => {
                    // F3: Enter agrega el primer resultado. preventDefault ademas
                    // evita que el Enter dispare el submit del <form> del modal.
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
                      <span className="flex shrink-0 items-center gap-3 text-right text-xs">
                        <span>
                          <span className="block text-muted-foreground">
                            Venta {bs(r.precio)}
                          </span>
                          <span className="block text-muted-foreground">
                            {r.ultimoCosto === null
                              ? "Nunca comprado"
                              : `Últ. costo ${bs(r.ultimoCosto)}`}
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">{r.unidad}</span>
                        <Plus className="size-5 text-primary" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ítems */}
            <div className="space-y-3">
              <Label className="text-base">Ítems de la orden ({items.fields.length})</Label>
              {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}
              {items.fields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Todavía no agregaste productos.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="w-24 px-3 py-2 text-right">Cantidad</th>
                        <th className="w-32 px-3 py-2 text-right">Costo Bs</th>
                        <th className="w-36 px-3 py-2 text-right">Precio venta Bs</th>
                        <th className="w-32 px-3 py-2 text-right">Importe</th>
                        <th className="w-12 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.fields.map((field, index) => {
                        const fila = itemsWatch?.[index]
                        const costo = Number(fila?.costo_unitario ?? 0)
                        const importe = Number(fila?.cantidad ?? 0) * costo
                        const ref = referencias[field.producto_id]
                        const precioVenta = Number(fila?.precio_venta ?? 0)
                        // La regla: no se puede comprar mas caro de lo que se vende.
                        const bajoCosto = precioVenta <= costo
                        return (
                          <tr key={field.id} className="border-t border-border">
                            <td className="px-4 py-2">
                              <p className="font-medium">{field.codigo}</p>
                              <p className="text-xs text-muted-foreground">{field.descripcion}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Precio de venta {bs(ref?.precio ?? 0)}
                                {" · "}
                                {ref?.ultimoCosto == null
                                  ? "sin compras previas"
                                  : `último costo ${bs(ref.ultimoCosto)}`}
                              </p>
                              {bajoCosto && (
                                <p className="mt-0.5 text-xs font-medium text-destructive">
                                  El precio de venta tiene que ser mayor al costo de compra.
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={1}
                                className="h-10 text-right"
                                {...register(`items.${index}.cantidad`)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className="h-10 text-right"
                                {...register(`items.${index}.costo_unitario`)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                className={
                                  bajoCosto
                                    ? "h-10 border-destructive text-right"
                                    : "h-10 text-right"
                                }
                                {...register(`items.${index}.precio_venta`)}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{bs(importe)}</td>
                            <td className="px-2 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                onClick={() => items.remove(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea id="notas" rows={2} {...register("notas")} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
            <div className="text-sm text-muted-foreground">
              Total de la orden:{" "}
              <span className="text-lg font-semibold text-foreground">{bs(total)}</span>
            </div>
            <div className="flex items-center gap-4">
              {itemsInvalidos > 0 && (
                <p className="text-sm font-medium text-destructive">
                  {itemsInvalidos} ítem{itemsInvalidos === 1 ? "" : "s"} con precio de venta menor o
                  igual al costo.
                </p>
              )}
              <Button type="submit" size="lg" disabled={loading || itemsInvalidos > 0}>
                {loading ? "Guardando..." : "Crear orden"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
