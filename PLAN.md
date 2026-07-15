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

**Objetivo:** sucursales (multi-almacén) con stock por sucursal, precios por mayor con vigencia, traspasos entre sucursales, búsqueda de cliente por código y adecuación de los PDF al formato del cliente.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| **C1 · Búsqueda de cliente por código (= NIT)** en proforma y venta: reemplazar el `<Select>` de cliente por un buscador por código/NIT que autocomplete NIT/CI factura, nombre de factura y complemento (ver campo "Código cliente 🔍" del sistema del cliente). Implica campos nuevos en la proforma (formulario + BD). | Alta | ⏳ Pendiente |
| **C2 · Sucursales / multi-almacén** ⚠️ *re-arquitectura*: los almacenes se manejan como sucursales; el stock deja de ser un número por producto y pasa a ser por **(producto × sucursal)**. Tabla `sucursales`, `sucursal_id` en `kardex_movimientos`, cache de stock por sucursal, FIFO por sucursal y adaptación de **todas** las RPC de movimiento (`fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_ajuste_stock`, conversión). En los listados, mostrar el stock por sucursal (badges `sucursal:cantidad`, `BO` = pendiente/backorder). | Alta | ⏳ Pendiente |
| **C3 · Precios por mayor escalonados con fecha límite**: por producto, varias escalas de precio según cantidad mínima (p. ej. ≥20, ≥100, ≥400), cada una con su precio y su **fecha de vigencia** (`Lim`); aplicar el precio correcto en proforma/venta según cantidad y fecha, validando contra el precio base. Nueva tabla de precios escalonados (distinto del descuento actual por línea). | Alta | ⏳ Pendiente |
| **C4 · Módulo de pedido / traspaso entre sucursales**: transferir producto de una sucursal/almacén a otra (salida en origen + entrada en destino) con su documento de pedido. *(Depende de C2.)* | Alta | ⏳ Pendiente |
| **C5 · Sucursal del usuario logueado**: asociar cada usuario (`perfiles`) a una sucursal, mostrarla en la UI (header/sidebar) y usarla por defecto en las operaciones. *(Depende de C2.)* | Media | ⏳ Pendiente |
| **P · Adecuar los PDF de proforma y venta al modelo del cliente** — ver detalle P1–P10 abajo. | Alta | ⏳ Pendiente |

**Detalle de la HU "P" — correcciones al PDF (modelo de proforma del cliente).** Ajustar `lib/pdf/proforma-document.tsx` y aplicar el mismo criterio a `lib/pdf/venta-document.tsx`:

| # | Corrección | ¿Existe hoy? | Estado |
|---|---|---|---|
| P1 | **Encabezado tipo modelo**: a la izquierda EMPRESA / DIRECCIÓN / **SUCURSAL** (etiqueta : valor), logo al centro, a la derecha **FECHA** / **VENDEDOR**. | Parcial (hoy logo a la izq. + meta a la der.; sin sucursal ni vendedor) | ⏳ |
| P2 | Mostrar **SUCURSAL** (número) y **VENDEDOR** (nombre del usuario que emite la proforma). | No | ⏳ (se apoya en C2/C5) |
| P3 | Título **"PROFORMA No. NNNN"** (número correlativo). | Parcial (hoy "PROFORMA {numero}") | ⏳ |
| P4 | Recuadro de cliente con **Señor(es) / Contacto / Dirección / TIPO DE PAGO**. | Parcial (hoy CLIENTE + CI-NIT·Tel·Dir; el pago va en el header) | ⏳ |
| P5 | **GLOSA** ubicada arriba de la tabla de ítems. | Sí, pero abajo | ⏳ |
| P6 | Tabla de ítems con columnas **N° · CANTIDAD · CÓDIGO · LÍNEA · DETALLE · P. UNIT. · IMPORTE** (agregar N° y **LÍNEA** = `linea_marca`, renombrar Descripción→Detalle; el modelo no lleva columna de descuento por línea). | Parcial | ⏳ |
| P7 | Total como **"TOTAL IMPORTE Bs. X"** con separador de miles. | Parcial (hoy "TOTAL Bs X", sin separador de miles) | ⏳ |
| P8 | **Importe en literal** ("Tres mil sesenta 00/100 Bolivianos") — requiere función número→texto en español. | No | ⏳ |
| P9 | Leyenda **"La cotización solo tiene validez por el plazo de N día(s)."** | Parcial (texto distinto en el pie) | ⏳ |
| P10 | **"Tiempo de entrega: N día(s)."** — campo nuevo (agregar a la proforma: formulario + BD, además del PDF). | No | ⏳ |

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
