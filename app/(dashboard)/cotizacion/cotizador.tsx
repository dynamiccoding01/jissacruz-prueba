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
import { avisarBusqueda } from "@/lib/avisar-busqueda"
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0),
    [items]
  )

  // Consulta real al servidor.
  async function ejecutarBusqueda(texto: string, camposBusqueda: CampoBusqueda[] = campos) {
    if (!texto.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const data = await buscarProductosParaCotizacion(texto, camposBusqueda)
    setBuscando(false)
    setResultados(data)
    avisarBusqueda(data.length)
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
    // T3: los resultados quedan a la vista para agregar varios seguidos.
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setItems([])
    setBusqueda("")
    setResultados([])
    preciosRef.current.clear()
    buscadorRef.current?.focus()
  }

  return (
    <div className="space-y-4">
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

        {resultados.length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {resultados.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{r.codigo}</span>
                    {!r.con_factura && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        S/F
                      </span>
                    )}
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
                  title="Agregar a la cotización"
                >
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>
            ))}
          </div>
        )}
        {!buscando && busqueda.trim() && resultados.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin resultados para &quot;{busqueda}&quot;.</p>
        )}
        {!busqueda.trim() && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Buscá productos para armar la cotización. No se descuenta stock ni se guarda nada.
          </p>
        )}
      </div>

      {/* Cotización (pedido + total) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cotización</h2>
          <div className="flex gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={items.length === 0}
            >
              <Printer className="size-4" /> Imprimir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={limpiar}
              disabled={items.length === 0}
            >
              Limpiar
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-base text-muted-foreground">
            Todavía no agregaste productos. Buscá arriba y apretá &quot;Agregar&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[40rem] overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[2rem_6rem_1fr_8rem_8rem_2rem] items-center gap-2 bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                <span className="text-center">N°</span>
                <span className="text-center">Cant.</span>
                <span>Código / Detalle</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              {items.map((it, index) => {
                const subtotal = (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0)
                return (
                  <div
                    key={it.producto_id}
                    className="grid grid-cols-[2rem_6rem_1fr_8rem_8rem_2rem] items-center gap-2 border-t border-border px-3 py-2"
                  >
                    <span className="text-center text-sm text-muted-foreground">{index + 1}</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-9 text-center text-sm font-medium"
                      value={it.cantidad}
                      onChange={(e) => cambiarCantidad(index, e.target.value)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{it.codigo}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.descripcion}</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-9 text-right text-sm"
                      value={it.precio_unitario}
                      onChange={(e) => cambiarPrecio(index, e.target.value)}
                    />
                    <span className="whitespace-nowrap text-right text-sm font-bold text-primary">
                      {bs(subtotal)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive print:hidden"
                      onClick={() => quitar(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground sm:max-w-sm sm:ml-auto">
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
