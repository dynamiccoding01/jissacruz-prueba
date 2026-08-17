import { toast } from "sonner"

// T2 (PLAN_3): aviso breve arriba cuando una búsqueda de productos encuentra
// resultados. Usa un id fijo para que sea UN solo toast que se actualiza (no se
// apila al tipear en vivo) y position "top-center" para que salga arriba sin
// mover el resto de los toasts (que quedan abajo-derecha).
export function avisarBusqueda(cantidad: number) {
  if (cantidad <= 0) return
  toast.success(
    cantidad === 1 ? "1 producto encontrado" : `${cantidad} productos encontrados`,
    { id: "busqueda-productos", position: "top-center", duration: 1500 }
  )
}
