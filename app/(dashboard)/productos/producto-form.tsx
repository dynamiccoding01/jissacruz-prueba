"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { productoSchema, type ProductoFormInput } from "@/lib/validations/producto"
import { createProducto, getProductoConDetalle, updateProducto } from "./actions"
import { listarUnidadesActivas } from "../unidades-medida/actions"

const VACIO: ProductoFormInput = {
  codigo: "",
  descripcion: "",
  linea_marca: "",
  unidad_medida: "unidad",
  unidad_medida_id: null,
  precio: 0,
  stock_minimo: 0,
  imagen_url: null,
  con_factura: true,
  codigos_equivalentes: [],
  codigos_originales: [],
  medidas: [],
  vehiculos_compatibles: [],
  precios_mayor: [],
}

export function ProductoForm({
  productoId,
  trigger,
  readOnly = false,
  onSaved,
}: {
  productoId?: string
  trigger: React.ReactNode
  readOnly?: boolean
  onSaved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  // Ultimo costo de compra del producto (null si nunca se compro): el precio de
  // venta tiene que superarlo.
  const [ultimoCosto, setUltimoCosto] = useState<number | null>(null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [unidades, setUnidades] = useState<Awaited<ReturnType<typeof listarUnidadesActivas>>>([])

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductoFormInput>({
    resolver: zodResolver(productoSchema),
    defaultValues: VACIO,
  })

  const codigosArray = useFieldArray({ control, name: "codigos_equivalentes" })
  const originalesArray = useFieldArray({ control, name: "codigos_originales" })
  const medidasArray = useFieldArray({ control, name: "medidas" })
  const vehiculosArray = useFieldArray({ control, name: "vehiculos_compatibles" })
  const preciosMayorArray = useFieldArray({ control, name: "precios_mayor" })
  const imagenUrl = watch("imagen_url")
  const precioActual = Number(watch("precio") ?? 0)

  useEffect(() => {
    if (!open) return
    listarUnidadesActivas().then(setUnidades)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!productoId) {
      reset(VACIO)
      setUltimoCosto(null)
      return
    }
    setCargandoDetalle(true)
    getProductoConDetalle(productoId).then(
      ({ producto, ultimoCosto, codigos, originales, medidas, vehiculos, precios_mayor }) => {
        setUltimoCosto(ultimoCosto)
        if (producto) {
          reset({
            codigo: producto.codigo,
            descripcion: producto.descripcion,
            linea_marca: producto.linea_marca ?? "",
            unidad_medida: producto.unidad_medida,
            unidad_medida_id: producto.unidad_medida_id ?? null,
            precio: producto.precio,
            stock_minimo: producto.stock_minimo,
            imagen_url: producto.imagen_url,
            con_factura: producto.con_factura ?? true,
            codigos_equivalentes: codigos,
            codigos_originales: originales,
            medidas,
            vehiculos_compatibles: vehiculos,
            precios_mayor,
          })
        }
        setCargandoDetalle(false)
      }
    )
  }, [open, productoId, reset])

  async function onSubmit(values: ProductoFormInput) {
    setLoading(true)
    const result = productoId
      ? await updateProducto(productoId, values)
      : await createProducto(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(productoId ? "Producto actualizado." : "Producto creado.")
    setOpen(false)
    onSaved?.()
  }

  async function onImagenSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoImagen(true)
    const supabase = createClient()
    const nombreArchivo = `${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage.from("productos-imagenes").upload(nombreArchivo, file)
    setSubiendoImagen(false)
    if (error) {
      toast.error("No se pudo subir la imagen.")
      return
    }
    const { data } = supabase.storage.from("productos-imagenes").getPublicUrl(nombreArchivo)
    setValue("imagen_url", data.publicUrl)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {readOnly ? "Ver producto" : productoId ? "Editar producto" : "Nuevo producto"}
          </SheetTitle>
          <SheetDescription>
            Datos generales, códigos originales (OEM) y equivalentes, y compatibilidad con vehículos.
          </SheetDescription>
        </SheetHeader>

        {cargandoDetalle ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
            <fieldset disabled={readOnly} className="m-0 space-y-6 border-0 p-0">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input id="codigo" {...register("codigo")} />
                  {errors.codigo && (
                    <p className="text-sm text-destructive">{errors.codigo.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linea_marca">Línea / marca</Label>
                  <Input id="linea_marca" {...register("linea_marca")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" rows={2} {...register("descripcion")} />
                {errors.descripcion && (
                  <p className="text-sm text-destructive">{errors.descripcion.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="unidad_medida">Unidad</Label>
                  {unidades.length > 0 ? (
                    <select
                      id="unidad_medida"
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                      value={watch("unidad_medida_id") ?? ""}
                      onChange={(e) => {
                        const uid = e.target.value
                        setValue("unidad_medida_id", uid || null)
                        // mantiene el texto (fallback) en sincronía con la unidad elegida
                        const u = unidades.find((x) => x.id === uid)
                        if (u) setValue("unidad_medida", u.nombre)
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} ({u.codigo})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input id="unidad_medida" {...register("unidad_medida")} />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio por unidad (Bs)</Label>
                  <Input id="precio" type="number" step="0.01" {...register("precio")} />
                  {errors.precio && (
                    <p className="text-sm text-destructive">{errors.precio.message}</p>
                  )}
                  {/* El precio de venta debe superar el ultimo costo de compra.
                      Se avisa acá para no descubrirlo recién al guardar. */}
                  {ultimoCosto !== null && (
                    <p
                      className={
                        precioActual > ultimoCosto
                          ? "text-xs text-muted-foreground"
                          : "text-xs font-medium text-destructive"
                      }
                    >
                      Último costo de compra: Bs {ultimoCosto.toFixed(2)}
                      {precioActual > ultimoCosto
                        ? ""
                        : " — el precio de venta tiene que ser mayor."}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock_minimo">Stock mínimo (en la unidad)</Label>
                  <Input id="stock_minimo" type="number" {...register("stock_minimo")} />
                </div>
              </div>

              <label htmlFor="con_factura" className="flex items-center gap-2 text-sm">
                <input
                  id="con_factura"
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  {...register("con_factura")}
                />
                <span>
                  Se vende <strong>con factura</strong> — destildá para marcarlo{" "}
                  <strong>S/F</strong> (sin factura)
                </span>
              </label>

              <div className="space-y-2">
                <Label htmlFor="imagen">Imagen</Label>
                {!readOnly && (
                  <Input id="imagen" type="file" accept="image/*" onChange={onImagenSeleccionada} />
                )}
                {subiendoImagen && <p className="text-sm text-muted-foreground">Subiendo...</p>}
                {imagenUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagenUrl}
                    alt="Vista previa"
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Códigos originales (OEM)</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => originalesArray.append({ codigo_original: "" })}
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                )}
              </div>
              {originalesArray.fields.length === 0 && readOnly && (
                <p className="text-sm text-muted-foreground">Sin códigos originales.</p>
              )}
              {originalesArray.fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Input
                    placeholder="Código original del fabricante"
                    {...register(`codigos_originales.${index}.codigo_original`)}
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => originalesArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Códigos equivalentes</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => codigosArray.append({ codigo_equivalente: "" })}
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                )}
              </div>
              {codigosArray.fields.length === 0 && readOnly && (
                <p className="text-sm text-muted-foreground">Sin códigos equivalentes.</p>
              )}
              {codigosArray.fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2">
                  <Input
                    placeholder="Código equivalente (otro fabricante)"
                    {...register(`codigos_equivalentes.${index}.codigo_equivalente`)}
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => codigosArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Medidas</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => medidasArray.append({ etiqueta: "", valor: 0, unidad: "MM" })}
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                )}
              </div>
              {medidasArray.fields.length === 0 && readOnly && (
                <p className="text-sm text-muted-foreground">Sin medidas.</p>
              )}
              {medidasArray.fields.length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2 text-xs text-muted-foreground">
                  <span>Etiqueta (A, B…)</span>
                  <span>Valor</span>
                  <span>Unidad</span>
                  <span />
                </div>
              )}
              {medidasArray.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2">
                  <Input placeholder="A" {...register(`medidas.${index}.etiqueta`)} />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="45.40"
                    {...register(`medidas.${index}.valor`)}
                  />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    {...register(`medidas.${index}.unidad`)}
                  >
                    <option value="MM">MM</option>
                    <option value="CM">CM</option>
                    <option value="PULG">PULG</option>
                  </select>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => medidasArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {errors.medidas && (
                <p className="text-sm text-destructive">
                  Revisá las medidas: la etiqueta es obligatoria y el valor debe ser mayor a 0.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Vehículos compatibles</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      vehiculosArray.append({
                        marca: "",
                        modelo: "",
                        anio_desde: null,
                        anio_hasta: null,
                      })
                    }
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                )}
              </div>
              {vehiculosArray.fields.length === 0 && readOnly && (
                <p className="text-sm text-muted-foreground">Sin vehículos compatibles.</p>
              )}
              {vehiculosArray.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_4.5rem_4.5rem_auto] items-end gap-2">
                  <Input placeholder="Marca" {...register(`vehiculos_compatibles.${index}.marca`)} />
                  <Input placeholder="Modelo" {...register(`vehiculos_compatibles.${index}.modelo`)} />
                  <Input
                    placeholder="Desde"
                    type="number"
                    {...register(`vehiculos_compatibles.${index}.anio_desde`)}
                  />
                  <Input
                    placeholder="Hasta"
                    type="number"
                    {...register(`vehiculos_compatibles.${index}.anio_hasta`)}
                  />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => vehiculosArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* C3: precios por mayor escalonados con fecha de vigencia */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Precios por mayor</Label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      preciosMayorArray.append({
                        cantidad_minima: 2,
                        precio: 0,
                        vigente_hasta: "",
                      })
                    }
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                )}
              </div>
              {preciosMayorArray.fields.length === 0 && readOnly && (
                <p className="text-sm text-muted-foreground">Sin precios por mayor.</p>
              )}
              {preciosMayorArray.fields.length > 0 && (
                <div className="grid grid-cols-[5.5rem_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
                  <span>Desde (cant.)</span>
                  <span>Precio (Bs)</span>
                  <span>Vigente hasta</span>
                  <span />
                </div>
              )}
              {preciosMayorArray.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[5.5rem_1fr_1fr_auto] items-end gap-2">
                  <Input
                    type="number"
                    min={2}
                    {...register(`precios_mayor.${index}.cantidad_minima`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`precios_mayor.${index}.precio`)}
                  />
                  <Input type="date" {...register(`precios_mayor.${index}.vigente_hasta`)} />
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => preciosMayorArray.remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {errors.precios_mayor && (
                <p className="text-sm text-destructive">
                  Revisá las escalas: cantidad mínima 2 o más y precio no negativo.
                </p>
              )}
            </div>
            </fieldset>

            {!readOnly && (
              <SheetFooter>
                <Button type="submit" disabled={loading || subiendoImagen}>
                  {loading ? "Guardando..." : "Guardar"}
                </Button>
              </SheetFooter>
            )}
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
