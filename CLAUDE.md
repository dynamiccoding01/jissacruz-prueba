# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

"SISREP": sistema web de inventario, compras y ventas de repuestos para camiones de alto tonelaje (cliente: **JISSACRUZ**, Santa Cruz, Bolivia). Implementación en curso siguiendo [PLAN.md](PLAN.md) fase por fase / sprint por sprint (ver "Estado general" al inicio de ese archivo — avance ~90%: Sprints 1–3 funcionales de punta a punta en la UI y el grueso del Sprint 4 construido —dashboard con KPIs, los 4 reportes con exportación PDF/Excel y la pantalla de Configuración—; quedan el **despliegue en Vercel**, la UAT y el manual de usuario). Todo el dominio, la base de datos y la UI están en español; mantener el español en nombres de tablas, rutas, componentes y textos de interfaz.

## Documentos fuente de verdad

| Documento | Rol |
|---|---|
| [PLAN.md](PLAN.md) | Estado real por sprint/fase + reglas de ejecución para el agente — **leer primero para saber qué falta** |
| [TRD.md](TRD.md) | Stack definitivo, arquitectura, estructura de carpetas (§3), APIs internas |
| [BACKEND.md](BACKEND.md) | Esquema Postgres, funciones RPC, políticas RLS, índices (diseño) |
| [supabase/README.md](supabase/README.md) | Scripts SQL reales, orden de ejecución y decisiones que **amplían/ajustan** BACKEND.md |
| [PRD.md](PRD.md) | Alcance funcional y exclusiones |
| [UI_UX.md](UI_UX.md) | Pantallas, navegación por rol, componentes reutilizables clave (§5) |
| [FLUJO.md](FLUJO.md) | Flujos de negocio de punta a punta; matriz de permisos por rol (§10) |
| [PlanProyecto.md](PlanProyecto.md) | Cronograma Scrum (gestión, no técnico) |

Cuando BACKEND.md y `supabase/README.md` difieran, `supabase/README.md` gana: documenta decisiones tomadas durante la implementación real (p. ej. stock cacheado por trigger en vez de vista, `configuracion_empresa` de fila única, estado `vencida` derivado en `vista_proformas`, `linea_marca` como texto libre en vez de tabla de categorías).

## Comandos

```bash
npm run dev      # servidor de desarrollo (localhost:3000)
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # eslint (next/core-web-vitals + next/typescript)
```

No hay suite de tests configurada. La verificación de backend se hace corriendo los scripts SQL en `supabase/` (ver siguiente sección) directamente en el SQL Editor de Supabase, no con un runner local.

## Base de datos (Supabase)

Scripts en [supabase/](supabase/README.md), pensados para pegarse en el SQL Editor de Supabase — no hay migraciones vía CLI/ORM.

- Proyecto nuevo: correr `00_setup_completo.sql` completo (concatena 01→05 como una transacción implícita).
- Cambios incrementales sobre una base existente: correr solo el script nuevo correspondiente a la fase (p. ej. `09_busqueda_productos.sql`), nunca repetir `00`.
- `06_verificacion.sql` y `08_verificacion_rls_vendedor.sql` son pruebas end-to-end con rollback intencional; requieren primero crear un usuario de prueba `admin` y `vendedor` respectivamente desde Supabase Auth (`user_metadata: { "rol": "admin" | "vendedor" }` — el trigger `on_auth_user_created` crea la fila en `perfiles`).
- `07_fix_fifo_desempate.sql` es un parche histórico; no se corre en instalaciones nuevas.

## Arquitectura

**Server Components por defecto; Server Actions (`"use server"`, en `actions.ts` por módulo) para toda mutación; Route Handlers solo bajo `/api/pdf/*`** para generar PDFs con `@react-pdf/renderer` (no hay API REST pública). Cada módulo de `app/(dashboard)/<modulo>/` sigue el mismo patrón: `page.tsx` (Server Component, carga inicial de datos) + `<modulo>-explorer.tsx` (Client Component, tabla/filtros con `@tanstack/react-table`) + `<modulo>-form.tsx` (react-hook-form + zod) + `actions.ts` (Server Actions, valida con el schema de `lib/validations/<modulo>.ts` antes de tocar Supabase). Módulos existentes: `productos`, `inventario`, `kardex`, `proveedores`, `compras`, `clientes`, `proformas`, `ventas` (POS + historial), `reportes`, `dashboard`, `configuracion`.

**PDF y Excel**: cada documento PDF vive en `lib/pdf/<x>-document.tsx` y se sirve por su Route Handler en `app/api/pdf/<x>/` (`kardex`, `proforma/[id]`, `venta/[id]`, `reporte`). La exportación a Excel es cliente puro vía SheetJS en [lib/excel/export-to-excel.ts](lib/excel/export-to-excel.ts). `dashboard` y `reportes` grafican con `recharts` (cargado en un componente `*-inner`/`*-chart` cliente); la lógica de los 4 reportes está en [lib/reportes.ts](lib/reportes.ts) + [lib/reportes-tipos.ts](lib/reportes-tipos.ts).

**El kardex es la fuente de verdad del stock, pero `productos.stock_actual` es una columna cacheada** mantenida por el trigger `trg_kardex_stock` sobre cada insert en `kardex_movimientos` (no una vista) — un segundo trigger bloquea que un `UPDATE` directo sobre `productos` la modifique. Valorización FIFO por lotes vía `cantidad_restante_lote`, con desempate por la columna `consecutivo` (identity) cuando dos lotes comparten `creado_en`.

**Toda operación que mueva stock pasa por una función Postgres `security definer` vía `supabase.rpc()`** — nunca updates directos ni múltiples queries no atómicas desde el cliente: `fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_convertir_proforma_a_venta`, `fn_ajuste_stock`. `ventas` y `kardex_movimientos` no tienen política RLS de `insert`: solo estas RPC (que corren como `security definer`) pueden escribir ahí. Ver ejemplo de uso en [app/(dashboard)/compras/actions.ts](<app/(dashboard)/compras/actions.ts>): `supabase.rpc("fn_recibir_orden_compra", { p_orden_id })` seguido de `revalidatePath` en cada ruta afectada (compras, inventario, kardex, productos).

Búsqueda avanzada de productos (código, equivalente, descripción, línea/marca, vehículo compatible) va por una sola RPC, `fn_buscar_productos(texto, campos text[])`, reutilizada por catálogo, compras, ventas/POS y proformas — no reimplementar el filtro en el cliente. El usuario elige por qué campos buscar (multi-selección) con el componente compartido [components/shared/criterios-busqueda.tsx](components/shared/criterios-busqueda.tsx); esos criterios (`campos`) se pasan a la RPC, que filtra solo por los marcados (OR entre ellos; arreglo vacío ⇒ busca en todos). Los `id` de los criterios en ese componente deben coincidir con los que evalúa el SQL (`supabase/10_busqueda_por_criterio.sql`).

**Auth y roles**: [lib/auth/session.ts](lib/auth/session.ts) expone `getPerfil()` (cacheado por request con `cache()` de React) y `requireAdmin()` para guardas de página. `app/(dashboard)/layout.tsx` ya valida sesión/`activo` y hace `signOut()` + redirect a `/login` si falla; las páginas exclusivas de admin deben llamar `requireAdmin()` igual, porque el layout no filtra por rol. Roles: `admin` (todo) y `vendedor` (solo Productos/Inventario en lectura, Proformas, Ventas/POS, Clientes — ver [components/shared/nav-items.ts](components/shared/nav-items.ts) para la matriz por ítem de navegación y FLUJO.md §10 para la matriz completa). RLS activo en todas las tablas; sin registro público, usuarios creados por invitación del admin desde Supabase Auth.

**Tres clientes Supabase distintos según contexto** — no mezclarlos: [lib/supabase/server.ts](lib/supabase/server.ts) (`createClient()`, anon key + cookies, Server Components/Actions), [lib/supabase/client.ts](lib/supabase/client.ts) (browser, Client Components) y [lib/supabase/admin.ts](lib/supabase/admin.ts) (`createAdminClient()`, service_role, marcado `import "server-only"` — solo para operaciones que deben saltar RLS deliberadamente, nunca importar desde código que corra en el navegador). `middleware.ts` refresca el token de sesión en cada request via su propio `createServerClient`.

**Numeración correlativa** `PRO-0001` / `VEN-0001` viene de secuencias Postgres + trigger `BEFORE INSERT` (script `02_secuencias_triggers.sql`) — nunca calcular el siguiente número en la aplicación.

**Descuentos**: se guarda tipo (`porcentaje` | `monto_fijo`) + valor aplicado, no solo el resultado. `impuesto_porcentaje` es un campo manual (default 0), sin IVA automático. En proformas, el trigger `fn_proforma_items_validar` recalcula `subtotal_linea` y valida límites de descuento en cada insert/update — las proformas no pasan por RPC porque no tocan stock, así que ese trigger es su única red de integridad (a diferencia de ventas, donde `fn_registrar_venta` hace ese trabajo).

Moneda: Boliviano (Bs). Una sola sucursal.

## Reglas de ejecución (obligatorias)

- Antes de tocar un módulo, revisar su estado real en la columna **Estado** de PLAN.md (no asumir por el nombre de la carpeta ni por que exista un archivo que la funcionalidad esté completa o pulida — a ~90% lo que falta es transversal: despliegue en Vercel, UAT y manual, no la implementación de módulos).
- No introducir tecnologías fuera de las definidas en TRD.md sin consultarlo explícitamente.
- Toda operación que modifique stock debe pasar por las funciones RPC transaccionales — nunca actualizar stock desde el cliente ni con múltiples queries no atómicas.
- Ante ambigüedad no cubierta por los documentos, señalar la duda en lugar de asumir.

## Identidad de marca (JISSACRUZ)

Guía completa en `../SISTEMA INVENTARIO/Brand Guidebook Jissacruz.pdf` (logo en `.ai` en la misma carpeta).

- **Colores**: `#0E3C6D` (azul oscuro primario), `#1D6DB2` (azul secundario), `#212121` (texto oscuro), `#B6B7B4` (gris), `#FFFFFF`. Deben representar ~80% del uso de color; matices adicionales vía opacidad de estos tonos.
- **Tipografía**: League Spartan (Light/Regular/Bold) para títulos, subtítulos, cuerpo y botones.
- UI_UX.md §1.2–1.3 ya está alineado con esta paleta y tipografía: azules corporativos como primario/acento, colores semánticos de stock (rojo/amarillo/verde vía `<StockBadge />`) como excepción funcional, y tokens de marca definidos como variables CSS de shadcn/ui.
