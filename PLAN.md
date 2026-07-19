# PLAN — Plan de Implementación SISREP

## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 2.0 · **Cliente:** Rodrigo · **Equipo:** Dynamic Coding (2 devs)
**Inicio:** 14 jul 2026 · **Entrega:** 5 sep 2026 · **Metodología:** Scrum (4 sprints × 2 semanas)

> Este archivo está alineado con el **Plan de Proyecto aprobado por el cliente** (`PlanProyecto_DynamicCoding.docx`), organizado por sprints. La columna **Estado** refleja el avance real del código a la fecha de corte. Las decisiones técnicas concretas se toman durante el desarrollo respetando **TRD.md** y **BACKEND.md** como fuente de verdad.

---

## Estado general — corte al 12 jul 2026

**Avance global: ~90%.** Sprint 1 y Sprint 2 prácticamente completos (el backend de toda la app —tablas, funciones RPC, RLS— ya está construido y verificado en Supabase). Sprint 3 (proformas, POS/ventas, clientes) ya está funcional de punta a punta en la interfaz. De Sprint 4, están construidos el dashboard con KPIs, los 4 reportes (con exportación PDF/Excel) y la pantalla de Configuración (datos de empresa, stock mínimo default y gestión de usuarios); quedan la UAT, el manual de usuario y el despliegue. Único pendiente transversal de Sprint 1: **despliegue en Vercel**.

**Leyenda de estado:**
`✅ Hecho` · `⚠️ Parcial` (algo hecho, falta completar) · `⏳ Pendiente`

**Mapa Sprint ↔ Fases técnicas** (referenciadas en el código y CLAUDE.md):
Sprint 1 → Fases 0–4 · Sprint 2 → Fase 5 · Sprint 3 → Fases 6–8 · Sprint 4 → Fases 9–11.

---

## SPRINT 1 — Base del sistema (14–25 jul 2026)

**Objetivo:** autenticación, catálogo de repuestos con búsqueda avanzada e inventario.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| Configuración del entorno (Supabase, Vercel, repositorio Git) | Alta | ⚠️ Parcial — Supabase ✅ y repositorio Git ✅; **Vercel pendiente** |
| Módulo de autenticación: login y cierre de sesión | Alta | ✅ Hecho |
| Gestión de roles: administrador y vendedor | Alta | ✅ Hecho |
| CRUD de categorías y líneas de repuestos | Alta | ⚠️ Divergencia de diseño — `línea/marca` es un **campo de texto** del producto, no un CRUD/tabla aparte (decisión "sin tabla lineas", ver `supabase/README.md`) |
| CRUD de productos: código, descripción, línea/marca, unidad, precio, imagen | Alta | ✅ Hecho (imagen a Storage pendiente de verificar) |
| Gestión de códigos equivalentes por producto (múltiples fabricantes) | Alta | ✅ Hecho |
| Compatibilidad de repuesto con vehículos (marca y modelo) | Media | ✅ Hecho |
| Búsqueda avanzada: código, equivalente, descripción, marca, línea, vehículo | Alta | ✅ Hecho (`09_busqueda_productos.sql` + explorer) |
| Vista de inventario con indicadores de stock por color (rojo/amarillo/verde) | Alta | ✅ Hecho (`<StockBadge />`) |
| Configuración del dominio y despliegue inicial en Vercel | Media | ⏳ Pendiente |

**Entregable Sprint 1:** login funcional, catálogo con búsqueda avanzada por equivalentes y vehículo, e inventario con indicadores de stock, **desplegado en la URL del cliente**.
**Estado del entregable:** ⚠️ Funcional en local; falta el despliegue en Vercel para cerrarlo.

---

## SPRINT 2 — Módulo de compras (28 jul–8 ago 2026)

**Objetivo:** proveedores, órdenes de compra y control de stock.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| CRUD de proveedores (nombre, contacto, RUC, dirección) | Alta | ✅ Hecho |
| Registro de órdenes de compra asociadas a proveedor | Alta | ✅ Hecho |
| Recepción de mercadería: actualización automática de stock | Alta | ✅ Hecho (`fn_recibir_orden_compra`) |
| Historial de compras por proveedor | Media | ✅ Hecho |
| Alertas de stock mínimo (configuración por producto) | Alta | ✅ Hecho (campo `stock_minimo` por producto; el default global se ajusta en pantalla de Configuración → Sprint 4) |
| Registro de movimientos de inventario (entradas/salidas) | Alta | ✅ Hecho (Kardex + ajuste manual) |
| Pruebas de integración Sprint 1 + Sprint 2 | Media | ⚠️ Parcial — verificación SQL (`06`/`08`) existe; falta prueba end-to-end en la UI |

**Entregable Sprint 2:** módulo de compras operativo; el administrador registra proveedores, emite órdenes de compra y el stock se actualiza automáticamente.
**Estado del entregable:** ✅ Cumplido (a falta de la prueba de integración formal en UI).

---

## SPRINT 3 — Proforma, ventas y clientes (11–22 ago 2026)

**Objetivo:** cotización, punto de venta, clientes y comprobantes.
> Nota: **todo el backend de este sprint ya existe** (tablas `clientes`, `proformas`, `ventas` + funciones `fn_registrar_venta`, `fn_convertir_proforma_a_venta` con descuento de stock FIFO). Lo pendiente es la **interfaz**.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| CRUD de clientes (nombre, CI/NIT, teléfono, dirección) | Alta | ✅ Hecho — CRUD con búsqueda (nombre/CI-NIT/teléfono); borrado solo admin |
| Módulo de Proforma: cliente, tipo de pago, plazo de validez, glosa | Alta | ✅ Hecho |
| Agregar productos a proforma con búsqueda avanzada | Alta | ✅ Hecho (reusa `fn_buscar_productos`, prellena precio) |
| Cálculo de subtotal, descuentos y total en proforma | Alta | ✅ Hecho (descuento por línea + global + impuesto; totales calculados en servidor) |
| Generación de PDF de proforma imprimible (NIT, fecha, datos del cliente) | Alta | ✅ Hecho (`/api/pdf/proforma/[id]`, paleta de marca) |
| Lista de proformas con filtro por fecha, cliente y estado | Media | ✅ Hecho (filtros por cliente, estado y **rango de fechas**; estado `vencida` derivado) |
| Módulo de punto de venta (POS): búsqueda y selección de productos | Alta | ✅ Hecho (`app/(dashboard)/ventas/pos.tsx`, layout 2 columnas, reusa `fn_buscar_productos`) |
| Carrito de venta con cálculo de total y descuentos | Alta | ✅ Hecho (misma lógica de cálculo que proformas, `lib/validations/venta.ts`) |
| Emisión de comprobante de venta en PDF | Alta | ✅ Hecho (`/api/pdf/venta/[id]`, `lib/pdf/venta-document.tsx`) |
| Conversión de proforma a venta directa | Media | ✅ Hecho (botón en `proformas-explorer.tsx` invoca `fn_convertir_proforma_a_venta` vía `convertirProformaAVenta`) |
| Historial de compras por cliente | Media | ✅ Hecho (`ClienteHistorial`, dialog con proformas + ventas del cliente) |
| Descuento automático de stock al registrar una venta | Alta | ✅ Hecho (POS y conversión de proforma llaman `fn_registrar_venta`, FIFO) |

**Entregable Sprint 3:** proforma y ventas funcionales; el vendedor genera una cotización en PDF, la convierte a venta, registra la transacción y descuenta el stock automáticamente.
**Estado del entregable:** ✅ Cumplido en código — pendiente probar el flujo de punta a punta contra un proyecto Supabase real (ver "Pruebas de integración" arriba).

---

## SPRINT 4 — Reportes, dashboard y entrega (25 ago–5 sep 2026)

**Objetivo:** reportes, dashboard, pruebas finales y entrega en producción.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| Dashboard principal: KPIs (ventas hoy, stock bajo, proformas pendientes, compras recientes) | Alta | ✅ Hecho (`app/(dashboard)/dashboard/page.tsx`: KPIs + gráfico de ventas 7 días con `recharts` + stock crítico + compras recientes + accesos directos) |
| Reporte de ventas por período (diario, semanal, mensual) | Alta | ✅ Hecho (módulo Reportes: selector de rango + agrupación, gráfico, resumen, exportación PDF/Excel) |
| Reporte de proformas (emitidas, convertidas, vencidas) | Media | ✅ Hecho (mismo módulo Reportes) |
| Reporte de productos más vendidos | Media | ✅ Hecho (mismo módulo Reportes, agrega `venta_items` por producto) |
| Kardex: historial por producto exportable a PDF y Excel | Alta | ✅ Hecho (adelantado — implementado en Fase 4) |
| Reporte de estado de inventario (stock actual por categoría/línea) | Alta | ✅ Hecho (mismo módulo Reportes, agrupa por `linea_marca` con valorización) |
| Pantalla de Configuración: gestión de usuarios, datos de empresa (para PDFs) y stock mínimo por defecto | Alta | ✅ Hecho (datos de empresa + stock mínimo default editables; alta de usuarios vía `service_role` con trigger que crea el perfil; activar/desactivar. **Falta:** subida del logo a Storage para los PDFs) |
| Pruebas de usuario (UAT) con el cliente Rodrigo | Alta | ⏳ Pendiente |
| Corrección de errores detectados en UAT | Alta | ⏳ Pendiente |
| Despliegue final en producción y entrega de credenciales | Alta | ⏳ Pendiente |
| Documentación básica de uso (manual de usuario) | Media | ⏳ Pendiente |

**Entregable Sprint 4 / final:** sistema completo en producción, acceso entregado al cliente, dashboard funcional y manual de uso básico.
**Estado del entregable:** ⚠️ En progreso — dashboard, los 4 reportes y la pantalla de Configuración ya construidos; quedan UAT con el cliente, corrección de hallazgos, despliegue en producción y manual de usuario.

---

## SPRINT 5 — Correcciones y nuevos requerimientos del cliente (15–17 jul 2026)

**Origen:** reunión con el cliente (Rodrigo) del **14 jul 2026**, posterior a la entrega del plan original. Las imágenes y el PDF de referencia provienen del **sistema que el cliente usa hoy ("Velacuss")**: son modelo de estructura/formato — los datos reales son de **JISSACRUZ**.

> ⚠️ **Nota de alcance:** el bloque **multi-sucursal (C2, C4, C5)** re-arquitectura el núcleo de inventario (kardex, cache de stock, FIFO, RPC) y, junto con los **precios por mayor (C3)**, son cambios de fondo respecto al plan original ("una sola sucursal", descuento simple) → **confirmar con el cliente si van como alcance adicional a cotizar** o como trabajo comprometido. **Fecha objetivo del sprint: 17 jul 2026.**

**Objetivo:** sucursales (multi-almacén) con stock por sucursal, precios por mayor con vigencia, traspasos entre sucursales, búsqueda de cliente por código, búsqueda de productos por fragmentos y adecuación de los PDF al formato del cliente.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| **C1 · Búsqueda de cliente por código (= NIT)** en proforma y venta: reemplazar el `<Select>` de cliente por un buscador por código/NIT que autocomplete NIT/CI factura, nombre de factura y complemento (ver campo "Código cliente 🔍" del sistema del cliente). Implica campos nuevos en la proforma (formulario + BD). | Alta | ✅ Hecho (14 jul) — `BuscadorCliente` (código/NIT/nombre) reemplaza el `<Select>` en Proforma y POS; `nombre_factura` y `complemento` viven en la ficha del cliente y se autocompletan al elegirlo. **Requiere correr `supabase/11_cliente_datos_factura.sql`.** Falta probar end-to-end. |
| **C1.1 · Búsqueda anidada de productos por fragmentos**: permitir buscar sin escribir palabras completas, usando combinaciones parciales tipo `PISTON` + `COMPRESOR` + `85` para resolver consultas como `Piston%comp%85`. | Alta | ✅ Hecho (17 jul) — `fn_buscar_productos` parte la consulta por espacios y exige que el campo cumpla **todos** los fragmentos (`ilike all`), conservando `%` como comodín intencional (patrón `Piston%comp%85`); `descripcion` mantiene además su tsquery. Vive entera en la RPC, así que catálogo, compras, POS y proformas la heredan sin cambio de cliente. **Requiere correr `supabase/15_busqueda_anidada.sql`.** Falta probar end-to-end. |
| **C2 · Sucursales / multi-almacén** ⚠️ *re-arquitectura*: los almacenes se manejan como sucursales; el stock deja de ser un número por producto y pasa a ser por **(producto × sucursal)**. Tabla `sucursales`, `sucursal_id` en `kardex_movimientos`, cache de stock por sucursal, FIFO por sucursal y adaptación de **todas** las RPC de movimiento (`fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_ajuste_stock`, conversión). En los listados, mostrar el stock por sucursal (badges `sucursal:cantidad`, `BO` = pendiente/backorder). | Alta | ⚠️ En progreso (4 pasos). **Paso 1 ✅ (14 jul):** tabla `sucursales` + ABM admin (`app/(dashboard)/sucursales/`, script `12_sucursales.sql`, ítem de nav en Administración). Decisiones: stock total derivado (sin dato repetido), sucursales por ABM, vendedor ve solo su sucursal, numeración global. **Paso 2 ✅ (14 jul):** `perfiles.sucursal_id` (script `13_perfil_sucursal.sql` + trigger que lo lee al invitar); selector de sucursal al crear usuario y cambio inline en Configuración (`asignarSucursal`); `getPerfil()` trae la sucursal y el header la muestra. **Paso 3a ✅ (14 jul):** backend de stock por sucursal — tabla `producto_stock_sucursal`, `kardex.sucursal_id`, FIFO y las 4 RPC reescritas por sucursal (usan `fn_mi_sucursal()`), migración a Casa Matriz + verificación (script `14_stock_por_sucursal.sql`). La app sigue igual (total transicional en `productos.stock_actual`). Decisiones: inventario mostrará total + desglose; las operaciones impactan la sucursal del usuario. **Paso 3b ✅ (18 jul, equipo):** `<StockBadge>` extendido con **insignias por sucursal** (`código:cantidad`, **`BO`** cuando la sucursal está en cero — tal como pide esta HU), integrado en **Inventario y Productos** vía embed de `producto_stock_sucursal` en la consulta (reemplazó la versión del 17 jul que era solo Inventario con columna aparte). **Paso 3c ✅ (17 jul):** sucursal en los documentos (ver registro). **Falta del paso 4:** **eliminar el total repetido** (`productos.stock_actual` → vista derivada) y las **operaciones con RLS por sucursal** para el vendedor. |
| **C3 · Precios por mayor escalonados con fecha límite**: por producto, varias escalas de precio según cantidad mínima (p. ej. ≥20, ≥100, ≥400), cada una con su precio y su **fecha de vigencia** (`Lim`); aplicar el precio correcto en proforma/venta según cantidad y fecha, validando contra el precio base. Nueva tabla de precios escalonados (distinto del descuento actual por línea). | Alta | ✅ Hecho (17 jul, 2 pasos). **Paso 1:** tabla `producto_precios_mayor` (única por producto+cantidad mínima, `vigente_hasta` nullable, RLS lectura autenticados / escritura admin — **requiere correr `supabase/18_precios_mayor.sql`**) + ABM en la ficha del producto (sección "Precios por mayor"). **Paso 2:** la búsqueda de productos de Proforma y POS trae las escalas **vigentes** (filtradas por fecha en el servidor) y, al cambiar la cantidad (o al re-clickear el producto en el POS), el precio unitario se ajusta solo vía `precioSegunCantidad()` ([lib/precios-mayor.ts](lib/precios-mayor.ts), probado con 7 casos); sin escala aplicable usa el precio base, y el precio sigue editable a mano. Falta probar end-to-end. |
| **C4 · Módulo de pedido / traspaso entre sucursales**: transferir producto de una sucursal/almacén a otra (salida en origen + entrada en destino) con su documento de pedido. *(Depende de C2.)* | Alta | ✅ Hecho (18 jul, equipo) — tablas `pedidos_traspaso` + `pedido_traspaso_items` y 4 RPC transaccionales (`fn_crear_pedido_traspaso`, `fn_enviar_traspaso` con salida FIFO en origen, `fn_recibir_traspaso` con lote FIFO en destino, `fn_cancelar_traspaso`); tipos de kardex `salida_traspaso`/`entrada_traspaso`. **Requiere correr `supabase/19_pedidos_traspaso.sql`.** UI completa en `/traspasos` (crear, despachar, recibir, cancelar) + ítem de nav. Falta probar end-to-end. |
| **C5 · Sucursal del usuario logueado**: asociar cada usuario (`perfiles`) a una sucursal, mostrarla en la UI (header/sidebar) y usarla por defecto en las operaciones. *(Depende de C2.)* | Media | ⏳ Pendiente |
| **P · Adecuar los PDF de proforma y venta al modelo del cliente** — ver detalle P1–P10 abajo. | Alta | ✅ Hecho (17 jul) — P1–P10 implementados en el PDF de proforma y replicado lo aplicable al de venta (la venta no lleva glosa/validez/tipo de pago). **Requiere correr `supabase/17_tiempo_entrega.sql`** (P10). Falta verificación visual final contra el modelo y probar P10 end-to-end. |

**Detalle de la HU "P" — correcciones al PDF (modelo de proforma del cliente).** Ajustar `lib/pdf/proforma-document.tsx` y aplicar el mismo criterio a `lib/pdf/venta-document.tsx`:

| # | Corrección | ¿Existe hoy? | Estado |
|---|---|---|---|
| P1 | **Encabezado tipo modelo**: a la izquierda EMPRESA / DIRECCIÓN / **SUCURSAL** (etiqueta : valor), logo al centro, a la derecha **FECHA** / **VENDEDOR**. | Parcial (hoy logo a la izq. + meta a la der.; sin sucursal ni vendedor) | ✅ Hecho (17 jul, proforma) — encabezado a 3 columnas: izq. EMPRESA/Dirección/NIT/Tel/Sucursal, logo al centro, der. título + Fecha + Vendedor. Replicado al PDF de venta (17 jul). |
| P2 | Mostrar **SUCURSAL** (número) y **VENDEDOR** (nombre del usuario que emite la proforma). | No | ✅ Hecho (17 jul) — encabezado de proforma **y** venta muestra `Sucursal:` (nombre) y `Vendedor:` (proforma → `creado_por`, venta → `vendido_por`), leídos por embed de PostgREST. Verificado en el PDF de PRO-0005 (Casa Matriz / admin). Nota: es la versión sobre el layout actual; el re-ordenamiento completo del encabezado es P1. |
| P3 | Título **"PROFORMA No. NNNN"** (número correlativo). | Parcial (hoy "PROFORMA {numero}") | ✅ Hecho (17 jul) — "PROFORMA No. 0005" (toma el número sin el prefijo `PRO-`) |
| P4 | Recuadro de cliente con **Señor(es) / Contacto / Dirección / TIPO DE PAGO**. | Parcial (hoy CLIENTE + CI-NIT·Tel·Dir; el pago va en el header) | ✅ Hecho (17 jul, proforma) — recuadro con Señor(es) / CI-NIT / Contacto / Dirección / Tipo de pago (el pago se movió aquí desde el encabezado). Replicado al PDF de venta (17 jul). |
| P5 | **GLOSA** ubicada arriba de la tabla de ítems. | Sí, pero abajo | ✅ Hecho (17 jul) — recuadro "GLOSA" reubicado encima de la tabla |
| P6 | Tabla de ítems con columnas **N° · CANTIDAD · CÓDIGO · LÍNEA · DETALLE · P. UNIT. · IMPORTE** (agregar N° y **LÍNEA** = `linea_marca`, renombrar Descripción→Detalle; el modelo no lleva columna de descuento por línea). | Parcial | ✅ Hecho (17 jul, proforma) — tabla con N°/Cantidad/Código/Línea/Detalle/P.Unit/Importe; se quitó la columna Desc. (el descuento por línea ya está aplicado en el Importe); precios con separador de miles. La ruta trae `linea_marca`. Replicado al PDF de venta (17 jul). |
| P7 | Total como **"TOTAL IMPORTE Bs. X"** con separador de miles. | Parcial (hoy "TOTAL Bs X", sin separador de miles) | ✅ Hecho (17 jul) — "TOTAL IMPORTE Bs. 1.112,40" (helper `bsMiles`, formato es-BO); aplicado también a subtotal/desc./impuesto |
| P8 | **Importe en literal** ("Tres mil sesenta 00/100 Bolivianos") — requiere función número→texto en español. | No | ✅ Hecho (17 jul, proforma) — helper [lib/pdf/numero-a-literal.ts](lib/pdf/numero-a-literal.ts) (`importeALiteral`, hasta millones, con apócopes "veintiún mil" y tildes correctas; probado con 14 casos, incluido el ejemplo del modelo). El PDF muestra "Son: …" bajo el total. Replicado al PDF de venta (17 jul). |
| P9 | Leyenda **"La cotización solo tiene validez por el plazo de N día(s)."** | Parcial (texto distinto en el pie) | ✅ Hecho (17 jul) — leyenda exacta en el pie |
| P10 | **"Tiempo de entrega: N día(s)."** — campo nuevo (agregar a la proforma: formulario + BD, además del PDF). | No | ✅ Hecho (17 jul) — columna `proformas.tiempo_entrega_dias` (**requiere correr `supabase/17_tiempo_entrega.sql`**), campo "Entrega (días)" en el formulario (0 = no indicar → null), la action lo guarda y el PDF muestra "Tiempo de entrega: N día(s)." en el pie. Falta probar end-to-end. |

**Notas de dependencia:** P2 (sucursal/vendedor) se apoya en C2/C5; el resto (P3–P9) se puede hacer directamente sobre el PDF actual. P10 y parte de C1 (nombre de factura / complemento) implican campos nuevos en la proforma (formulario + BD), no solo en el PDF.

**Entregable Sprint 5:** sistema con sucursales y stock por almacén, traspasos entre sucursales, precios por mayor vigentes, búsqueda de cliente por código y PDF (proforma/venta) alineados al formato del cliente.
**Estado del entregable:** ⏳ Pendiente — **fecha objetivo 17 jul 2026**; el alcance del bloque multi-sucursal y precios por mayor queda por confirmar/cotizar con el cliente.

---

## Anexo técnico — Análisis de integración: Sucursales (C2/C5) y Pedidos/Traspasos (C4)

> Diseño para implementar después (Sprint 5). Basado en la arquitectura **real** de stock: el kardex (`kardex_movimientos`) es la fuente de verdad, `productos.stock_actual` es un **cache por trigger** (`trg_kardex_stock` → `fn_kardex_aplica_stock`), la valorización es **FIFO por lotes** vía `fn_fifo_consumir`, y todo movimiento pasa por las 4 RPC `SECURITY DEFINER` (`fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_ajuste_stock`, `fn_convertir_proforma_a_venta`). **Punto de partida hoy: una sola sucursal implícita.**

### 1. El cambio de fondo
Hoy el stock es **un número por producto**. Multi-sucursal exige que el stock sea por **(producto × sucursal)**. Eso obliga a tocar el kardex, el cache de stock, el FIFO y las 4 RPC de movimiento — es **reescribir el núcleo de inventario**, no un agregado aislado.

### 2. Modelo de datos nuevo / modificado
**Tablas nuevas**
- `sucursales`: `id uuid` PK, `numero`/`codigo` UNIQUE (para mostrar "SUCURSAL 2"), `nombre`, `direccion`, `telefono`, `activo`. Semilla con las sucursales reales del cliente.
- `producto_stock_sucursal`: `(producto_id, sucursal_id, stock_actual int)`, PK compuesta `(producto_id, sucursal_id)` — **el nuevo cache de stock, por sucursal**. Solo lo escribe el trigger del kardex; sin políticas de insert/update (mismo criterio que `productos.stock_actual` hoy).

**Columnas nuevas**
- `kardex_movimientos.sucursal_id` NOT NULL (FK) — **cada movimiento pertenece a una sucursal**; los lotes FIFO (`cantidad_restante_lote`) quedan por (producto, sucursal) automáticamente.
- `perfiles.sucursal_id` (FK) — sucursal del usuario (C5).
- `ordenes_compra.sucursal_id` — a qué sucursal entra la mercadería recibida.
- `proformas.sucursal_id` y `ventas.sucursal_id` — sucursal de emisión/venta (también alimenta el PDF, P2).
- `productos.stock_actual` → se conserva como **total global** (suma de sucursales) para no romper reportes/vistas actuales; el detalle por sucursal vive en `producto_stock_sucursal`.

### 3. Lógica a reescribir (SQL)
- **`fn_kardex_aplica_stock`** (trigger): en vez de sumar solo a `productos.stock_actual`, hace **upsert en `producto_stock_sucursal`** por `new.sucursal_id` **y** actualiza el total global.
- **`fn_fifo_consumir(p_producto_id, p_sucursal_id, p_cantidad)`**: bloquea la fila de `producto_stock_sucursal` de esa sucursal (`for update`), valida el stock de **esa** sucursal, y consume lotes `where producto_id = … and sucursal_id = …` ordenados por `creado_en, consecutivo`.
- **`fn_recibir_orden_compra`**: usa `ordenes_compra.sucursal_id` en los inserts de kardex.
- **`fn_registrar_venta`**: recibe la sucursal (del payload o derivada de `perfiles.sucursal_id`), la pasa a `fn_fifo_consumir` y al kardex de salida; guarda `ventas.sucursal_id`.
- **`fn_ajuste_stock`**: agrega `p_sucursal_id`.
- **`fn_convertir_proforma_a_venta`**: propaga `proformas.sucursal_id` a la venta.
- **`fn_productos_before_update`**: se mantiene para el total global; `producto_stock_sucursal` se protege por RLS (sin insert/update para `authenticated`).

### 4. Módulo de Pedidos / Traspaso (C4) — depende de §2–§3
**Tablas nuevas**
- `pedidos_traspaso`: `id`, `numero` PED-XXXX (secuencia + trigger BEFORE INSERT, mismo patrón que proformas/ventas), `sucursal_origen_id`, `sucursal_destino_id` (check `origen <> destino`), `estado` ∈ {`pendiente`,`enviado`,`recibido`,`cancelado`}, `creado_por`, `creado_en`, `fecha_envio`, `fecha_recepcion`, `notas`.
- `pedido_traspaso_items`: `pedido_id`, `producto_id`, `cantidad`, `costo_fifo_unitario`.

**RPC nuevas (SECURITY DEFINER, transaccionales)** — flujo en **dos pasos** (modela el "pedido" real con estado *en tránsito*):
- `fn_enviar_traspaso(p_pedido_id)`: por ítem, `fn_fifo_consumir` en la **sucursal origen** (movimiento `salida_traspaso`), guarda el costo; marca `enviado`.
- `fn_recibir_traspaso(p_pedido_id)`: por ítem, **entrada** en la **sucursal destino** (`entrada_traspaso`) con el costo FIFO del origen como nuevo lote; marca `recibido`.
- Un traspaso **no crea margen**: el costo del lote en destino = costo consumido en origen.
- Kardex: nuevos `tipo_movimiento` `salida_traspaso`/`entrada_traspaso` y `referencia_tipo` `pedido`.
- *Alternativa simple* (si no quieren estado en tránsito): un solo `fn_traspaso` que hace salida+entrada en la misma transacción.

### 5. RLS y visibilidad por rol
- `sucursales`: lectura para todos los autenticados; alta/edición solo admin.
- `producto_stock_sucursal`: lectura para autenticados (todos ven el stock de todas las sucursales, necesario para decidir traspasos); escritura solo vía trigger/RPC.
- `pedidos_traspaso`/items: crear por usuario autenticado (origen = su sucursal); enviar/recibir vía RPC.
- **Decisión abierta:** ¿el vendedor ve solo ventas/proformas/pedidos de su sucursal (RLS filtrada por `sucursal_id`) o ve todo? Afecta las políticas de ventas, proformas y pedidos.

### 6. Migración de datos (la base ya está poblada)
1. Crear `sucursales` e insertar la **sucursal por defecto** (la actual del cliente).
2. `kardex_movimientos.sucursal_id`: agregar **nullable** → backfill de todo el histórico a la sucursal por defecto → `set NOT NULL`.
3. Construir `producto_stock_sucursal` desde `productos.stock_actual` (todo a la sucursal por defecto) o recomputar desde el kardex.
4. Agregar y backfillear `sucursal_id` en `perfiles`, `ordenes_compra`, `proformas`, `ventas`.
5. Scripts nuevos e **idempotentes**: `11_sucursales.sql` (modelo + migración + RPC adaptadas) y `12_pedidos_traspaso.sql` (pedidos + RPC de traspaso). No re-correr `00`.

### 7. Impacto en la app (frontend)
- **Header**: mostrar la sucursal del usuario (C5); para admin, selector de sucursal activa.
- **Inventario/Productos**: badges de stock por sucursal (join a `producto_stock_sucursal`) + total.
- **Compras**: elegir sucursal destino de la orden.
- **POS y Proformas**: operan sobre la sucursal del usuario (selector para admin); pasan `sucursal_id` a las RPC.
- **Nuevo módulo `app/(dashboard)/pedidos/`**: crear/enviar/recibir traspasos; ítem de nav nuevo. Opcional: pantalla admin de **Sucursales**.
- **Reportes/Dashboard**: filtro por sucursal.
- **PDF (P1/P2)**: SUCURSAL y VENDEDOR salen de `ventas/proformas.sucursal_id` y `vendido_por`/`creado_por`.

### 8. Orden de implementación sugerido
1. **Base sucursal** (no rompe stock): `sucursales` + `perfiles.sucursal_id` + UI de sucursal del usuario (C5).
2. **Stock por sucursal** (C2): `kardex.sucursal_id` + `producto_stock_sucursal` + trigger + FIFO + las 4 RPC + migración. *(El más riesgoso — verificar con una versión adaptada de `06_verificacion.sql`.)*
3. UI de stock por sucursal + Compras/POS/Proformas con sucursal.
4. **Pedidos/Traspaso** (C4).
5. **Precios por mayor** (C3) — independiente, se puede intercalar en cualquier momento.

### 9. Decisiones abiertas (definir antes de codear)
- ¿Sucursales fijas por semilla o CRUD administrable?
- ¿Vendedor restringido a su sucursal (RLS) o ve todas?
- Traspaso: ¿dos pasos (envío/recepción con en-tránsito) o uno solo (instantáneo)?
- Numeración de ventas/proformas: ¿global (como hoy) o por sucursal?
- ¿`productos.stock_actual` como total global (recomendado) o se elimina?
- Backfill: ¿qué sucursal por defecto para el histórico?

---

## Hitos y fechas clave (del plan del cliente)

| Hito | Fecha | Estado |
|---|---|---|
| Kickoff del proyecto | 14 jul 2026 | ⏳ |
| Firma de contrato / Pago 1 (50% anticipo) | 14 jul 2026 | ⏳ |
| Entrega Sprint 1 (base en producción) | 25 jul 2026 | ⚠️ Adelantado en local; falta Vercel |
| Entrega Sprint 2 (compras y stock) | 8 ago 2026 | ✅ Funcional (adelantado) |
| Entrega Sprint 3 (ventas y clientes) | 22 ago 2026 | ✅ Funcional (adelantado) |
| UAT con el cliente | 26–29 ago 2026 | ⏳ |
| Entrega final / Pago 2 (50% restante) | 5 sep 2026 | ⏳ |

---

## Reglas de Ejecución para el Agente de IA

- No implementar un sprint sin haber verificado (aunque sea manualmente) que el anterior funciona.
- No introducir tecnologías fuera de las definidas en TRD.md sin consultarlo explícitamente.
- Toda operación que modifique stock debe pasar por las funciones transaccionales (RPC) definidas en BACKEND.md — nunca actualizar stock directamente desde el cliente ni con múltiples queries no atómicas.
- Ante cualquier ambigüedad no cubierta por PRD.md, TRD.md, UI_UX.md, FLUJO.md o BACKEND.md, señalar la duda explícitamente en lugar de asumir un comportamiento no especificado.

## Divergencias y pendientes transversales a vigilar

- **Categorías/líneas:** el plan del cliente menciona "CRUD de categorías y líneas"; el diseño real las maneja como campo de texto `linea_marca` del producto (sin tabla). Si el cliente espera un catálogo administrable de líneas, es un cambio de alcance a cotizar.
- **Despliegue en Vercel:** comprometido desde el entregable del Sprint 1; aún no realizado.
- **Carga de imagen de producto a Storage:** implementada en el formulario; pendiente de verificación end-to-end.
- **Flujo comercial de Sprint 3 (POS, PDF de venta, conversión de proforma, historial por cliente) implementado el 12 jul 2026:** falta correrlo contra un proyecto Supabase real para confirmar que las RPC (`fn_registrar_venta`, `fn_convertir_proforma_a_venta`) y los embeds de PostgREST usados en `/api/pdf/venta/[id]` (desambiguación de FK `ventas_proforma_origen_id_fkey`) funcionan como se espera.
- **Dashboard (Sprint 4) implementado el 12 jul 2026, adelantado:** `npm run build` compila y tipa la página sin errores; falta verificarla logueado como admin contra datos reales (no se probó con credenciales — ver nota de Sprint 3 arriba, mismo motivo).
- **Reportes (Sprint 4) implementados el 12 jul 2026:** los 4 reportes comparten `lib/reportes.ts` (server) y `lib/reportes-tipos.ts` (tipos client-safe); PDF vía ruta genérica `/api/pdf/reporte` que re-ejecuta la consulta, Excel en cliente con el helper `xlsx`. `tsc --noEmit` y `next lint` limpios; la ruta `/reportes` compila y protege por `requireAdmin`. Falta verificarla con sesión admin contra datos reales.
- **Configuración (Sprint 4) implementada el 12 jul 2026:** edición de `configuracion_empresa` (RLS admin) y de `stock_minimo_default`; alta de usuarios con `createAdminClient()` (service_role) — el trigger `on_auth_user_created` crea el perfil desde `user_metadata`; activar/desactivar `perfiles.activo` con guarda para no bloquearse a sí mismo. Requiere `SUPABASE_SERVICE_ROLE_KEY` en el entorno (ya documentado en `.env.local.example`). ~~**Pendiente:** subida del logo de empresa a Storage para usarlo en los PDFs~~ → ✅ resuelto el 13 jul 2026 (el logo se sirve desde `public/` e incrusta en los 4 PDFs; ver registro abajo).

---

## Registro de cambios recientes — 13 jul 2026

Trabajo posterior al núcleo de Sprints 3–4, todo commiteado y subido a `main` (commit `60048f6`).

- ✅ **Sincronización con GitHub:** se integró (fast-forward) el commit `86f2030` del equipo ("pdf corregidos, y reportes"), que agregó el helper `lib/pdf/logo.ts` y el logo de empresa a los 4 PDFs (proforma, venta, kardex, reporte) leyendo un asset de `public/`, más `outputFileTracingIncludes` en `next.config.mjs` para que el logo viaje a Vercel.
- ✅ **Logo transparente definitivo en los PDFs:** se adoptó `public/Logo_transparente_2.png` (logo JISSACRUZ). Venía como RGB con un cuadriculado tenue "quemado" (sin transparencia real); se procesó a 500px y se recortó el fondo casi-blanco a **transparencia real (RGBA)**. Peso final ~163 KB (vs. 1 MB original) → ~217 KB por PDF. `getLogoEmpresa()` y `next.config.mjs` apuntan a ese archivo.
- ✅ **Logo en el sidebar** (`components/shared/sidebar.tsx`): usa `public/logo-empresa.png`, centrado y ampliado; cae al recuadro "S" si el archivo falta.
- ✅ **Optimización de carga (rendimiento):** carga diferida de librerías pesadas para aligerar bundles y compiles de dev:
  - `xlsx` (~1 MB) se importa de forma diferida y solo se descarga al hacer clic en "Exportar Excel" (`lib/excel/export-to-excel.ts`).
  - `recharts` se carga con `next/dynamic` (ssr:false): el gráfico del Dashboard (`ventas-chart.tsx` + `ventas-chart-inner.tsx`) y el de Reportes (`reportes-explorer.tsx`) ya no pesan en el bundle inicial.
  - Confirmado que `@react-pdf/renderer` está aislado en `/api/pdf/*` y no contamina bundles de página.
- 📝 **Nota de rendimiento (no es un bug):** la "lentitud al entrar a una página" que se ve en la consola de dev (`○ Compiling /ruta … ✓ Compiled in Xs`) es la **compilación bajo demanda de Next.js en modo desarrollo**, que ocurre una sola vez por ruta y **no existe en producción** (Vercel / `npm run build`).
- ⛔ **No usar Turbopack** (`next dev --turbo`) en este proyecto: con Next 14.2.35 rompe al no respetar el `turbopackIgnore` del import opcional de `@opentelemetry/api` dentro de `@supabase/supabase-js` ("Module not found: Can't resolve '@opentelemetry/api'"). El modo normal (`npm run dev`, webpack) lo ignora correctamente y funciona.

### Pendientes que siguen abiertos
- ⏳ Despliegue en Vercel (subir `SUPABASE_SERVICE_ROLE_KEY` y demás variables de entorno).
- ⏳ Verificación end-to-end logueado contra el Supabase real (no se pudo probar sin credenciales): PDFs con logo, POS/FIFO, conversión de proforma, alta de usuarios, dashboard y reportes con datos reales.
- ⏳ UAT con el cliente y manual de usuario.
- 🧹 Limpieza opcional: `public/logo_transparente.png` (versión intermedia de 500px) quedó sin uso; se puede borrar.

---

## Registro de cambios recientes — 14 jul 2026

- ✅ **Búsqueda de productos por criterio** (integrada del commit `ed73979` "BUSQUEDA" del equipo): la RPC `fn_buscar_productos` ahora recibe `p_campos text[]`, y el usuario elige por qué campos buscar (código, descripción, equivalente, línea/marca, vehículo) con el componente compartido `components/shared/criterios-busqueda.tsx`, reutilizado en Catálogo, Compras, Proformas y POS. **Requiere** haber corrido `supabase/10_busqueda_por_criterio.sql` en Supabase (ya ejecutado ✅).
- ✅ **Rediseño del sidebar** (`components/shared/sidebar.tsx` + `components/shared/nav-items.ts`):
  - Botones **agrupados por función** en 5 secciones con título: Principal, Inventario, Compras, Ventas y Administración. Cada grupo se oculta si no tiene ítems visibles para el rol (p. ej. un vendedor solo ve Inventario y Ventas).
  - Sidebar **estilo Supabase**: angosto por defecto (solo íconos + separadores entre grupos), se expande al pasar el cursor **flotando sobre el contenido** (panel `fixed` con `z-50`, sin empujar la página), y botón **"Fijar menú"** (`Pin`/`PinOff`) para dejarlo abierto de forma persistente (`localStorage`).
  - Solo visual: sin cambios en navegación, permisos ni páginas. `tsc --noEmit` y `next lint` limpios.

---

## Registro de cambios recientes — 17 jul 2026

- ✅ **C1.1 · Búsqueda anidada de productos por fragmentos** (script `supabase/15_busqueda_anidada.sql`): se reescribió el cuerpo de `fn_buscar_productos(texto, campos[])` — **misma firma**, la app no cambia. Antes, para `codigo`/`linea_marca`/`equivalente`/`vehiculo` se hacía un solo `ilike '%'||p_query||'%'` sobre toda la cadena, así que "piston comp" buscaba literal `%piston comp%` y fallaba. Ahora la consulta se parte en fragmentos por espacio y el campo debe cumplir **todos** (`ilike all(patrones)`); se conserva `%` como comodín intencional para replicar el patrón `Piston%comp%85` del sistema del cliente, y `descripcion` mantiene **además** su tsquery histórico (stemming/plurales) para no regresionar nada. La mejora vive entera en la RPC → catálogo, compras, POS y proformas la heredan sin tocar cliente.
- 📝 Se completó la tabla de migraciones incrementales de `supabase/README.md`, que solo llegaba hasta el script 10 (se agregaron las filas 11–15).
- ✅ **C2 · paso 3b (UI de stock por sucursal — Inventario)**: [app/(dashboard)/inventario/page.tsx](<app/(dashboard)/inventario/page.tsx>) trae el desglose desde `producto_stock_sucursal` (embed a `sucursales`) y [inventario-explorer.tsx](<app/(dashboard)/inventario/inventario-explorer.tsx>) agrega la columna **"Por sucursal"** (etiquetas `S{código}:{stock}`) junto al **Stock total**. Solo aparece con >1 sucursal activa; sin SQL nuevo (reusa el cache del script 14) y sin tocar `productos.stock_actual`. `tsc --noEmit` y `next lint` limpios. Falta: replicarlo en el catálogo de Productos, eliminar el total repetido y la RLS por sucursal del vendedor.

### Pendientes que siguen abiertos
- ⏳ Correr `supabase/15_busqueda_anidada.sql` en Supabase y probar la búsqueda por fragmentos end-to-end (código, descripción, equivalente, línea/marca, vehículo).
- ⏳ Verificar el desglose de Inventario logueado contra un Supabase con >1 sucursal y stock repartido (no probado con datos reales).
- ✅ **C3 · paso 2 — aplicar el precio por mayor en Proforma y POS**: [lib/precios-mayor.ts](lib/precios-mayor.ts) (`precioSegunCantidad`, probado con casos límite) + [lib/precios-mayor-server.ts](lib/precios-mayor-server.ts) (`escalasVigentesPorProducto`, filtra por `vigente_hasta` en el servidor); `buscarProductosParaProforma`/`buscarProductosParaVenta` adjuntan las escalas y los formularios ajustan `precio_unitario` al cambiar la cantidad (en el POS también al re-clickear el producto). El precio sigue editable a mano después del ajuste. `tsc`/`lint` limpios. **C3 completo.**
- ✅ **C3 · paso 1 — precios por mayor (BD + ABM)**: script `supabase/18_precios_mayor.sql` (tabla `producto_precios_mayor` con RLS) + escalas administrables desde la ficha del producto ([producto-form.tsx](<app/(dashboard)/productos/producto-form.tsx>), [actions.ts](<app/(dashboard)/productos/actions.ts>), [lib/validations/producto.ts](lib/validations/producto.ts) — mismo patrón de hijos que códigos equivalentes). `tsc`/`lint` limpios. Paso 2 (aplicar el precio en proforma/POS) pendiente.
- ✅ **Espejo del bloque P al PDF de venta** ([lib/pdf/venta-document.tsx](lib/pdf/venta-document.tsx) + su ruta): encabezado a 3 columnas con Sucursal (P1), título "COMPROBANTE DE VENTA No. NNNN" (P3), recuadro de cliente Señor(es)/CI-NIT/Contacto/Dirección (P4 — la venta no lleva tipo de pago), tabla N°/Cantidad/Código/Línea/Detalle/P.Unit/Importe (P6), "TOTAL IMPORTE Bs." con miles (P7) e importe en literal "Son: …" (P8). Limpieza de `bs`/`etiquetaDescuento` muertos. `tsc` limpio. **Con esto el bloque P (P1–P10) queda completo en ambos PDF.**
- ✅ **P10 — tiempo de entrega en la proforma** (cadena completa del dato): script `supabase/17_tiempo_entrega.sql` (columna nullable con check ≥ 0) → [lib/validations/proforma.ts](lib/validations/proforma.ts) (campo en el schema) → [proforma-form.tsx](<app/(dashboard)/proformas/proforma-form.tsx>) (input "Entrega (días)" junto a Validez) → [actions.ts](<app/(dashboard)/proformas/actions.ts>) (0/vacío ⇒ null) → PDF (leyenda "Tiempo de entrega: N día(s)." en el pie, solo si se indicó). `tsc`/`lint` limpios; falta correr el script y probar end-to-end.
- ✅ **P8 — importe en literal** ([lib/pdf/numero-a-literal.ts](lib/pdf/numero-a-literal.ts), nuevo): `importeALiteral()` convierte el total a texto ("Un mil ciento doce 40/100 Bolivianos"); cubre hasta millones, con apócopes ("veintiún mil", "treinta y un mil") y tildes (veintidós/veintitrés/veintiséis). **Probado ejecutando la función con 14 casos límite** (se detectaron y corrigieron 2 errores de ortografía en la primera versión). El PDF de proforma lo muestra como "Son: …" debajo del TOTAL IMPORTE. `tsc` limpio.
- ✅ **P6 — tabla de ítems del PDF de proforma** ([lib/pdf/proforma-document.tsx](lib/pdf/proforma-document.tsx) + su ruta): columnas **N° · Cantidad · Código · Línea · Detalle · P. Unit. · Importe**; se eliminó la columna de descuento por línea (ya viene aplicado en el Importe) y los montos usan separador de miles. La ruta ahora trae `productos.linea_marca`. Se limpió el código muerto (`bs`, `etiquetaDescuento`). `tsc` limpio.
- ✅ **P1 · P4 — encabezado y recuadro de cliente del PDF de proforma** ([lib/pdf/proforma-document.tsx](lib/pdf/proforma-document.tsx)): encabezado a **3 columnas** (izq. EMPRESA/Dirección/NIT/Tel/Sucursal · logo al centro · der. título + Fecha + Vendedor) (P1) y recuadro de cliente con **Señor(es) / CI-NIT / Contacto / Dirección / Tipo de pago** (P4, el pago se movió del encabezado al recuadro). `tsc` limpio.
- ✅ **P3 · P5 · P7 · P9 — retoques del PDF de proforma** ([lib/pdf/proforma-document.tsx](lib/pdf/proforma-document.tsx)): título **"PROFORMA No. 0005"** (P3), recuadro **GLOSA arriba** de la tabla (P5), **"TOTAL IMPORTE Bs. 1.112,40"** con separador de miles vía helper `bsMiles` (P7, aplicado también a subtotal/desc./impuesto), y la **leyenda de validez exacta** en el pie (P9). `tsc` limpio. Falta del bloque P: P1 (rediseño del encabezado), P4 (recuadro cliente completo), P6 (columnas N°/LÍNEA/DETALLE), P8 (importe en letras) y P10 (tiempo de entrega, campo nuevo); y replicar lo aplicable al PDF de venta.
- ✅ **P2 · SUCURSAL y VENDEDOR en los PDF** — [proforma-document.tsx](lib/pdf/proforma-document.tsx) + su ruta y [venta-document.tsx](lib/pdf/venta-document.tsx) + su ruta muestran `Sucursal:` y `Vendedor:` en el encabezado (embed de `sucursales` y `perfiles` por FK). Verificado en el PDF de PRO-0005. `tsc` limpio. Habilitado por el paso 3c. **Sigue pendiente el resto del bloque P** (P1, P3–P10) para igualar el modelo del cliente.
- ✅ **C2 · paso 3c (sucursal en los documentos)** — script `supabase/16_sucursal_en_documentos.sql` **corrido y verificado en Supabase** (columnas creadas + backfill 0/0/0 + 3 funciones recreadas): `proformas`, `ventas` y `ordenes_compra` tienen `sucursal_id`; `fn_recibir_orden_compra` entra a la sucursal destino de la orden, `fn_registrar_venta` guarda la sucursal, y `fn_convertir_proforma_a_venta` propaga la de la proforma. **App conectada y probada:** [proformas/actions.ts](<app/(dashboard)/proformas/actions.ts>) y [compras/actions.ts](<app/(dashboard)/compras/actions.ts>) guardan la sucursal del usuario al crear (verificado: proforma nueva sale con `sucursal_id`). `tsc`/`lint` limpios. **Con esto el motor de sucursales ya está conectado a los documentos** — habilita mostrar SUCURSAL/VENDEDOR en los PDF (P2) y reportes por sucursal.
- ⏳ *Optimización opcional:* si el catálogo crece, un índice GIN `pg_trgm` sobre `codigo`/`descripcion`/`linea_marca` aceleraría los `ilike '%frag%'` (hoy hacen scan; aceptable para un catálogo de una sola tienda).
- ⏳ Continúa Sprint 5: **C2 pasos 3b–4** (UI de stock por sucursal + RLS del vendedor), **C3** (precios por mayor), **C4** (traspasos), **P** (PDF al formato del cliente).

---

## Registro de cambios recientes — 18 jul 2026 (reconciliación de trabajo en paralelo)

El equipo implementó en paralelo (sobre la base del commit `f6cb63f`, sin el push del 17 jul) sus propias versiones de C1.1, C3, el bloque P, C2 3b **y C4 completo**. Se reconcilió conservando lo mejor de cada lado:

- ✅ **C4 · Traspasos entre sucursales (equipo, adoptado íntegro):** módulo `app/(dashboard)/traspasos/` (crear pedido, despachar con salida FIFO en origen, recibir como lote FIFO en destino, cancelar) + ítem de nav "Traspasos" + script `supabase/19_pedidos_traspaso.sql` (renombrado del 17 del equipo para no chocar con la numeración ya publicada). Autocontenido: compila sin cambios contra el código de main.
- ✅ **C2 · paso 3b (equipo, adoptado — reemplaza la versión del 17 jul):** `<StockBadge>` extendido con insignias por sucursal (`código:cantidad`, **BO** en cero, como pide la HU) aplicado en **Inventario y Productos**.
- ✅ **00_setup_completo.sql (equipo):** actualizado para que las instalaciones nuevas incluyan búsqueda por fragmentos, precios por mayor y traspasos. *Pendiente:* aún no incorpora los scripts 12–14 (sucursales/stock por sucursal) ni el 16 (sucursal en documentos) — una instalación desde cero sigue necesitando correr esos aparte.
- 🔁 **Duplicados descartados (ya existían en main desde el 17 jul):** `15_busqueda_fragmentos.sql` y `16_precios_mayor.sql` del equipo (equivalen a `15_busqueda_anidada.sql` y `18_precios_mayor.sql`; misma tabla/función, compatibles con la BD real corra cual corra), `lib/utils/numero-a-letras.ts` (equivale a `lib/pdf/numero-a-literal.ts`, que además maneja apócopes y tildes) y sus versiones de POS/proformas/PDFs (el bloque P y C3 de main ya cubren lo mismo).
- ✔️ Verificación de la reconciliación: `tsc --noEmit` y `next lint` limpios sobre el árbol combinado.

### Pendientes que siguen abiertos (post-reconciliación)
- ⏳ Correr `supabase/19_pedidos_traspaso.sql` y probar el flujo de traspasos end-to-end (crear → enviar → recibir; verificar stock en ambas sucursales).
- ⏳ C2 paso 4: eliminar el total repetido (`productos.stock_actual`) y RLS por sucursal para el vendedor.
- ⏳ Completar `00_setup_completo.sql` con los scripts 12–14 y 16.
- ⏳ Transversales: despliegue en Vercel, verificación e2e general, UAT y manual de usuario.

