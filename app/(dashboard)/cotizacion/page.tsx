import { Cotizador } from "./cotizador"

export default function CotizacionPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Cotización de precios</h1>
        <p className="text-sm text-muted-foreground">
          Armá un presupuesto rápido de productos, sin cliente y sin afectar el stock.
        </p>
      </div>
      <Cotizador />
    </div>
  )
}
