"use client"

import { useMemo, useRef, useState } from "react"
import { Plus, Printer, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatearMedidas } from "@/lib/medidas"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import { precioSegunCantidad } from "@/lib/precios-mayor"
import { buscarProductosParaCotizacion, type ProductoCotizacion } from "./actions"

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

type ItemCotizacion = {
  producto_id: string
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
}

export function Cotizador() {
  const [busqueda, setBusqueda] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [resultados, setResultados] = useState<ProductoCotizacion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [items, setItems] = useState<ItemCotizacion[]>([])
  // precio base + escalas por producto agregado, para ajustar el precio al cambiar
  // la cantidad (igual que el POS). No se persiste nada.
  const preciosRef = useRef(new Map<string, { base: number; escalas: ProductoCotizacion["escalas"] }>())
  const buscadorRef = useRef<HTMLInputElement>(null)

  const total = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0),
    [items]
  )

  async function onBuscar(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    setBusqueda(texto)
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaCotizacion(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (busqueda.trim()) onBuscar(busqueda, next)
  }

  function precioParaCantidad(productoId: string, cantidad: number, fallback: number) {
    const info = preciosRef.current.get(productoId)
    if (!info || info.escalas.length === 0) return fallback
    return precioSegunCantidad(info.base, info.escalas, cantidad)
  }

  function agregarProducto(p: ProductoCotizacion) {
    preciosRef.current.set(p.id, { base: p.precio, escalas: p.escalas })
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto_id === p.id)
      if (idx >= 0) {
        // ya está: suma 1 y reajusta el precio según la nueva cantidad
        return prev.map((i, k) => {
          if (k !== idx) return i
          const cantidad = (Number(i.cantidad) || 0) + 1
          return { ...i, cantidad, precio_unitario: precioParaCantidad(p.id, cantidad, i.precio_unitario) }
        })
      }
      return [
        ...prev,
        {
          producto_id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          unidad: p.unidad,
          cantidad: 1,
          precio_unitario: p.precio,
        },
      ]
    })
    setBusqueda("")
    setResultados([])
    buscadorRef.current?.focus()
  }

  function cambiarCantidad(index: number, raw: string) {
    const cantidad = Math.max(0, Number(raw) || 0)
    setItems((prev) =>
      prev.map((i, k) =>
        k === index
          ? { ...i, cantidad, precio_unitario: precioParaCantidad(i.producto_id, cantidad, i.precio_unitario) }
          : i
      )
    )
  }

  function cambiarPrecio(index: number, raw: string) {
    const precio = Math.max(0, Number(raw) || 0)
    setItems((prev) => prev.map((i, k) => (k === index ? { ...i, precio_unitario: precio } : i)))
  }

  function quitar(index: number) {
    setItems((prev) => prev.filter((_, k) => k !== index))
  }

  function limpiar() {
    setItems([])
    setBusqueda("")
    setResultados([])
    preciosRef.current.clear()
    buscadorRef.current?.focus()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_30rem]">
      {/* Buscador + resultados (se ocultan al imprimir) */}
      <div className="space-y-3 print:hidden">
        <Label className="text-base">Buscar producto para cotizar</Label>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {resultados.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => agregarProducto(r)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{r.codigo}</span>
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
                <span className="flex shrink-0 flex-col items-end text-base font-semibold text-primary">
                  <span className="flex items-center gap-2">
                    {bs(r.precio)}
                    <Plus className="size-5" />
                  </span>
                  {r.unidad && r.unidad !== "unidad" && (
                    <span className="text-[11px] font-normal text-muted-foreground">/ {r.unidad}</span>
                  )}
                </span>
              </div>
            </button>
          ))}
          {!buscando && busqueda.trim() && resultados.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Sin resultados para &quot;{busqueda}&quot;.
            </p>
          )}
          {!busqueda.trim() && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Buscá productos para armar la cotización. No se descuenta stock ni se guarda nada.
            </p>
          )}
        </div>
      </div>

      {/* Carrito de cotización */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cotización</h2>
          <div className="flex gap-2 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} disabled={items.length === 0}>
              <Printer className="size-4" /> Imprimir
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={limpiar} disabled={items.length === 0}>
              Limpiar
            </Button>
          </div>
        </div>

        <div className="max-h-[30rem] space-y-2.5 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-12 text-center text-base text-muted-foreground">
              Todavía no agregaste productos.
            </p>
          ) : (
            items.map((it, index) => {
              const subtotal = (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0)
              return (
                <div key={it.producto_id} className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{it.codigo}</p>
                      <p className="text-sm text-muted-foreground">{it.descripcion}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive print:hidden"
                      onClick={() => quitar(index)}
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[4.5rem_1fr_auto] items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-11 text-base font-medium"
                        value={it.cantidad}
                        onChange={(e) => cambiarCantidad(index, e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio {it.unidad && it.unidad !== "unidad" ? `/ ${it.unidad}` : ""}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="h-11 text-base"
                        value={it.precio_unitario}
                        onChange={(e) => cambiarPrecio(index, e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 text-right">
                      <Label className="text-xs">Subtotal</Label>
                      <p className="whitespace-nowrap pb-2 text-lg font-bold text-primary">{bs(subtotal)}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-lg font-semibold uppercase tracking-wide">Total</span>
          <span className="text-3xl font-bold tabular-nums">{bs(total)}</span>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Cotización referencial · no descuenta stock ni genera venta.
        </p>
      </div>
    </div>
  )
}
