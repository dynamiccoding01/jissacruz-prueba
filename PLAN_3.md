# PLAN_3.md — Tercera tanda de tareas (una por una)

> Tareas nuevas del cliente, hechas **de a una**: implementar → probar → confirmar → siguiente.
> Inicio: 2026-08-16.

## T1 — Botón "Sin nombre" en Ventas ✅ COMPLETADO (2026-08-16)

**Qué pide:** en el POS (solo Ventas), un botón **"Sin nombre"** para poder vender sin cliente.
**Decisión (cliente):** usar un cliente genérico **"SIN NOMBRE" con NIT `0000`**; al apretar el botón, la venta se crea con ese cliente.

**Cómo quedó:**
- Server action `obtenerClienteSinNombre()` en `app/(dashboard)/ventas/actions.ts`: **get-or-create** del cliente "SIN NOMBRE" (NIT 0000) — la primera vez lo crea, después lo reutiliza. **Sin script SQL** (la RLS de `clientes` permite `insert` a cualquier autenticado).
- Botón **"Sin nombre"** en el carrito del POS (debajo del buscador de cliente, visible cuando no hay cliente elegido): lo selecciona para la venta.

**Prueba:** Ventas (POS) → agregar un producto → abrir el carrito → apretar **"Sin nombre"** → queda elegido el cliente **SIN NOMBRE (NIT 0000)** → confirmar la venta → la factura sale a nombre de "SIN NOMBRE".

**Nota:** el botón **no** toca la opción Con/Sin factura (eso se sigue eligiendo aparte con el selector "Factura"). Si querés que "Sin nombre" también marque "Sin factura", avisá y lo sumo.

---

## Próximas tareas
(el cliente las va pasando de a una: T2, T3, …)
