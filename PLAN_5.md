# PLAN_5.md — Quinta tanda de tareas (una por una)

> Tareas nuevas del cliente. Hechas **de a una**: implementar → probar → confirmar → siguiente.
> Inicio: 2026-09-11.
> Repo de trabajo: `origin` (jissacruz-prueba). `produccion` recibe lo ya probado, cuando se pida.

---

## Decisiones cerradas (con el cliente, 2026-09-11)

- **T1 (Proforma) tope de cantidad por stock:** **aviso, no bloqueo** — avisa (amarillo/toast) si la cantidad supera el stock disponible, pero **deja guardar** (una proforma puede ser de algo a pedir/reponer).
- **T2 (Cotización) tope de cantidad por stock:** **tope duro**, igual que el POS (no deja pasar del stock de la sucursal).
- **Stock de referencia:** el de **la sucursal del que arma el documento** (misma lógica que el POS; al convertir/confirmar se descuenta de esa sucursal).
- **T3/T4 productos sin precio (precio = 0):** bloquear agregarlos en **Proforma, Cotización y también el POS** (botón "Agregar" deshabilitado + etiqueta "sin precio" + aviso).
- **T5 roles:** el **vendedor crea** el pedido en el POS; el **cajero confirma/cobra** en CAJA; el **admin** puede ambas.
- **T5 flujo:** **siempre dos pasos** — el POS solo **crea** el pedido (no cobra), CAJA lo **confirma**. No hay venta directa.
- **T5 al confirmar:** el **cajero** elige **tipo de pago** y **con/sin factura**; el stock se **revalida** (puede fallar si se agotó); la **factura PDF se genera al confirmar** (en CAJA, no en el POS).
- **T5 cancelar:** el pendiente **se puede cancelar/rechazar** en CAJA.
- **Usuarios cajero:** ya se crean hoy (rol `cajero` desde el script 38, Configuración → Usuarios). Es operativo, no desarrollo.

### Orden de ejecución
1. **T1–T4 (+ sin precio en POS):** validaciones rápidas, agrupadas por módulo (Proforma: T1+T4; Cotización: T2+T3; POS: sin precio). Sin cambios de BD.
2. **T5 (CAJA):** mini-etapa aparte — tablas + RPCs + módulo + permisos + factura al confirmar.

---

## T1 — Proforma: aviso de cantidad vs stock ✅ COMPLETADO (2026-09-11)

**Qué pide:** que no se pueda meter una cantidad "abismal" sin relación con el stock.
**Decisión:** **aviso** (no bloqueo) — la proforma puede exceder el stock.

**Cómo quedará:**
- Extender `buscarProductosParaProforma` para traer el **stock de la sucursal** del usuario (como `buscarProductosParaVenta`, leyendo `producto_stock_sucursal`).
- En `proforma-form.tsx`, al subir la cantidad, si supera el stock disponible mostrar un **toast amarillo** ("Hay N en stock; estás proformando M") pero **dejar** el valor.

**SQL:** ninguno.

---

## T4 — Proforma: solo productos con precio ✅ COMPLETADO (2026-09-11)

**Qué pide:** que no se pueda agregar un producto sin precio.
**Cómo quedará:** en los resultados de proforma, si `precio <= 0` → botón "Agregar" deshabilitado + etiqueta **"sin precio"**; `agregarProducto` bloquea con aviso. La búsqueda ya trae el precio.

**SQL:** ninguno.

---

## T2 — Cotización: tope duro de cantidad vs stock ✅ COMPLETADO (2026-09-11)

**Qué pide:** cantidad máxima = stock disponible, como en ventas.
**Decisión:** **tope duro** (no deja pasar del stock).

**Cómo quedará:**
- Extender `buscarProductosParaCotizacion` para traer el **stock de la sucursal** (S/F igual tiene stock).
- En `cotizador.tsx`, capar la cantidad al stock (como el POS: `onCantidadChange` limita y avisa) y bloquear "Agregar" si el stock es 0.

**SQL:** ninguno.

---

## T3 — Nueva cotización: solo productos con precio ✅ COMPLETADO (2026-09-11)

**Qué pide:** que no se pueda seleccionar un producto sin precio.
**Cómo quedará:** igual que T4 pero en `cotizador.tsx` (botón deshabilitado + "sin precio" + aviso).

**SQL:** ninguno.

---

## T3/T4-bis — POS: solo productos con precio ✅ COMPLETADO (2026-09-11)

**Qué pide (extra, decidido):** parejo con proforma/cotización, el POS tampoco deja agregar productos a precio 0.
**Cómo quedará:** en `pos.tsx`, el resultado con `precio <= 0` queda deshabilitado + "sin precio"; `agregarProducto` bloquea con aviso (se suma a la validación de stock que ya tiene).

**SQL:** ninguno.

---

## T5 — Nuevo módulo CAJA: confirmar ventas ✅ CÓDIGO LISTO (2026-09-11) — ⚠️ falta correr `40_ventas_pendientes.sql` en dev+prod

**Qué pide:** separar el flujo de ventas en dos pasos. El **vendedor crea** un pedido en el POS (sin cobrar, sin mover stock) y el **cajero confirma/cobra** en un módulo nuevo **CAJA**, que lista los pedidos pendientes de otros usuarios.

**Patrón que se reusa:** es análogo a **Proforma → Venta**. El pedido pendiente no toca stock; **confirmar = correr `fn_registrar_venta`** (que ya es atómica y valida stock vía `fn_fifo_consumir`). No se rompe la atomicidad: se **agrega** una capa de pendientes encima.

**Cómo quedará (diseño):**
- **BD (script `40_ventas_pendientes.sql`):**
  - Tablas `ventas_pendientes` (numero p. ej. `PDV-0001`, cliente_id opcional, descuentos, sucursal_id, creado_por, estado `pendiente|confirmada|cancelada`, venta_id) y `venta_pendiente_items` (cantidad, precio_unitario, descuentos).
  - Numeración por secuencia + trigger (patrón script `02`).
  - Trigger de validación de línea (recalcula subtotal_linea), como proforma_items — **no** toca stock.
  - RPC `fn_crear_venta_pendiente(payload)` (vendedor/cajero/admin): inserta cabecera + ítems. Sin stock.
  - RPC `fn_confirmar_venta_pendiente(id, tipo_pago, con_factura)` (**cajero/admin**): corre la lógica de `fn_registrar_venta` con los ítems del pendiente (revalida stock, FIFO, kardex, VEN-xxxx), marca el pendiente `confirmada` y guarda `venta_id`. Reusa `fn_registrar_venta` como hace `fn_convertir_proforma_a_venta`.
  - RPC `fn_cancelar_venta_pendiente(id)` (cajero/admin): marca `cancelada`.
  - RLS: crear (autenticados con rol permitido), ver (por sucursal), confirmar/cancelar (cajero/admin).
- **POS (`ventas/pos.tsx`):** deja de cobrar. El botón pasa a **"Enviar a caja"** → crea el pendiente. Ya no elige tipo de pago ni factura (eso es del cajero). El vendedor pasa a poder abrir el POS (permiso).
- **Módulo CAJA (`app/(dashboard)/caja/`):** lista de pendientes (número, vendedor, cliente, total, fecha) con **"Confirmar/Cobrar"** (dialog: tipo de pago + con/sin factura → confirma → factura PDF) y **"Cancelar"**. Ítem de sidebar "Caja" para cajero + admin.
- **Factura PDF:** se genera **al confirmar** (en CAJA), no en el POS.
- **Permisos:** POS crear = vendedor + cajero + admin; CAJA confirmar/cancelar = cajero + admin.

**SQL pendiente:** ⚠️ correr `40_ventas_pendientes.sql` en dev + prod y reflejar en `produccion_setup.sql`.

**Nota:** esto cambia la invariante que hoy documenta CLAUDE.md ("no hay bandeja de ventas pendientes; fn_registrar_venta atómica"). Al cerrar T5 hay que **actualizar CLAUDE.md** con el nuevo flujo.
