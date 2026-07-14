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
