# PLAN — Plan de Implementación SISREP

## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 2.0 · **Cliente:** Rodrigo · **Equipo:** Dynamic Coding (2 devs)
**Inicio:** 14 jul 2026 · **Entrega:** 5 sep 2026 · **Metodología:** Scrum (4 sprints × 2 semanas)

> Este archivo está alineado con el **Plan de Proyecto aprobado por el cliente** (`PlanProyecto_DynamicCoding.docx`), organizado por sprints. La columna **Estado** refleja el avance real del código a la fecha de corte. Las decisiones técnicas concretas se toman durante el desarrollo respetando **TRD.md** y **BACKEND.md** como fuente de verdad.

---

## Estado general — corte al 12 jul 2026

**Avance global: ~50%.** Sprint 1 y Sprint 2 prácticamente completos (el backend de toda la app —tablas, funciones RPC, RLS— ya está construido y verificado en Supabase, incluso el que da soporte a ventas/proformas). Sprint 3 y Sprint 4 pendientes en la interfaz. Único pendiente transversal de Sprint 1: **despliegue en Vercel**.

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
| Lista de proformas con filtro por fecha, cliente y estado | Media | ✅ Hecho (filtros por cliente y estado; estado `vencida` derivado. Falta filtro por fecha) |
| Módulo de punto de venta (POS): búsqueda y selección de productos | Alta | ⏳ Pendiente |
| Carrito de venta con cálculo de total y descuentos | Alta | ⏳ Pendiente |
| Emisión de comprobante de venta en PDF | Alta | ⏳ Pendiente (falta ruta `/api/pdf/venta/[id]`) |
| Conversión de proforma a venta directa | Media | ⏳ Pendiente (RPC `fn_convertir_proforma_a_venta` lista; falta UI) |
| Historial de compras por cliente | Media | ⏳ Pendiente |
| Descuento automático de stock al registrar una venta | Alta | ⚠️ Backend listo (`fn_registrar_venta`, FIFO); falta la UI que lo invoque |

**Entregable Sprint 3:** proforma y ventas funcionales; el vendedor genera una cotización en PDF, la convierte a venta, registra la transacción y descuenta el stock automáticamente.
**Estado del entregable:** ⏳ Pendiente (núcleo comercial por construir en la UI).

---

## SPRINT 4 — Reportes, dashboard y entrega (25 ago–5 sep 2026)

**Objetivo:** reportes, dashboard, pruebas finales y entrega en producción.

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| Dashboard principal: KPIs (ventas hoy, stock bajo, proformas pendientes, compras recientes) | Alta | ⏳ Pendiente |
| Reporte de ventas por período (diario, semanal, mensual) | Alta | ⏳ Pendiente |
| Reporte de proformas (emitidas, convertidas, vencidas) | Media | ⏳ Pendiente |
| Reporte de productos más vendidos | Media | ⏳ Pendiente |
| Kardex: historial por producto exportable a PDF y Excel | Alta | ✅ Hecho (adelantado — implementado en Fase 4) |
| Reporte de estado de inventario (stock actual por categoría/línea) | Alta | ⏳ Pendiente |
| Pruebas de usuario (UAT) con el cliente Rodrigo | Alta | ⏳ Pendiente |
| Corrección de errores detectados en UAT | Alta | ⏳ Pendiente |
| Despliegue final en producción y entrega de credenciales | Alta | ⏳ Pendiente |
| Documentación básica de uso (manual de usuario) | Media | ⏳ Pendiente |

**Entregable Sprint 4 / final:** sistema completo en producción, acceso entregado al cliente, dashboard funcional y manual de uso básico.
**Estado del entregable:** ⏳ Pendiente.

---

## Hitos y fechas clave (del plan del cliente)

| Hito | Fecha | Estado |
|---|---|---|
| Kickoff del proyecto | 14 jul 2026 | ⏳ |
| Firma de contrato / Pago 1 (50% anticipo) | 14 jul 2026 | ⏳ |
| Entrega Sprint 1 (base en producción) | 25 jul 2026 | ⚠️ Adelantado en local; falta Vercel |
| Entrega Sprint 2 (compras y stock) | 8 ago 2026 | ✅ Funcional (adelantado) |
| Entrega Sprint 3 (ventas y clientes) | 22 ago 2026 | ⏳ |
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
- **Ruta PDF de venta** (`/api/pdf/venta/[id]`): aún no existe (la de proforma y la de Kardex ya están); necesaria para Sprint 3 (POS/ventas).
- **Carga de imagen de producto a Storage:** implementada en el formulario; pendiente de verificación end-to-end.
