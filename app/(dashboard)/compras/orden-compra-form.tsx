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
import { ordenCompraSchema, type OrdenCompraInput } from "@/lib/validations/compra"
import { buscarProductosParaCompra, createOrdenCompra } from "./actions"

const VACIO: OrdenCompraInput = {
  proveedor_id: "",
  notas: "",
  items: [],
}

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
  const [resultados, setResultados] = useState<
    { id: string; codigo: string; descripcion: string }[]
  >([])
  const [buscando, setBuscando] = useState(false)
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

  async function onBuscarProducto(texto: string) {
    setBusquedaProducto(texto)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaCompra(texto)
    setBuscando(false)
    setResultados(data)
  }

  function agregarProducto(producto: { id: string; codigo: string; descripcion: string }) {
    if (items.fields.some((f) => f.producto_id === producto.id)) {
      toast.error("Ese producto ya está en la orden.")
      return
    }
    items.append({
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      cantidad: 1,
      costo_unitario: 0,
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          reset(VACIO)
          setResultados([])
          setBusquedaProducto("")
        }
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nueva orden de compra</SheetTitle>
          <SheetDescription>
            Seleccioná el proveedor y agregá los productos con cantidad y costo.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select
              value={proveedorId || undefined}
              onValueChange={(v) => setValue("proveedor_id", v)}
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Agregar productos</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por código, descripción o equivalente..."
                value={busquedaProducto}
                onChange={(e) => onBuscarProducto(e.target.value)}
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
                    <Plus className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Ítems de la orden</Label>
            {errors.items && (
              <p className="text-sm text-destructive">{errors.items.message}</p>
            )}
            {items.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no agregaste productos.
              </p>
            ) : (
              <div className="space-y-2">
                {items.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2 rounded-md border border-border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{field.codigo}</p>
                      <p className="text-xs text-muted-foreground">{field.descripcion}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`items.${index}.cantidad`)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Costo Bs</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`items.${index}.costo_unitario`)}
                      />
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
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea id="notas" rows={2} {...register("notas")} />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Crear orden"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
