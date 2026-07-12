# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

**Todavía no hay código.** Este directorio contiene la especificación completa de "SISREP": un sistema web de inventario, compras y ventas de repuestos para camiones de alto tonelaje (marca del cliente: **JISSACRUZ**, Santa Cruz, Bolivia). La implementación se hará aquí siguiendo [PLAN.md](PLAN.md) fase por fase — la Fase 0 define el scaffolding (Next.js 14 + TypeScript + Tailwind + shadcn/ui). Todo el dominio, la base de datos y la UI están en español; mantener el español en nombres de tablas, rutas y textos de interfaz.

## Documentos fuente de verdad

| Documento | Rol |
|---|---|
| [PLAN.md](PLAN.md) | Orden de implementación por fases + reglas de ejecución para el agente |
| [TRD.md](TRD.md) | Stack definitivo, arquitectura, estructura de carpetas (§3), APIs internas |
| [BACKEND.md](BACKEND.md) | Esquema Postgres completo, funciones RPC, políticas RLS, índices |
| [PRD.md](PRD.md) | Alcance funcional y exclusiones |
| [UI_UX.md](UI_UX.md) | Pantallas, navegación por rol, componentes reutilizables clave (§5) |
| [FLUJO.md](FLUJO.md) | Flujos de negocio de punta a punta |
| [PlanProyecto.md](PlanProyecto.md) | Cronograma Scrum (gestión, no técnico) |

## Reglas de ejecución (de PLAN.md — obligatorias)

- Seguir las fases en orden; no avanzar sin verificar que la fase anterior funciona.
- No introducir tecnologías fuera de las definidas en TRD.md sin consultarlo explícitamente.
- **Toda operación que modifique stock debe pasar por las funciones RPC transaccionales** — nunca actualizar stock desde el cliente ni con múltiples queries no atómicas.
- Ante ambigüedad no cubierta por los documentos, señalar la duda en lugar de asumir.

## Stack

Next.js 14 (App Router) · TypeScript `strict` · Tailwind CSS · shadcn/ui + lucide-react · Supabase (Postgres, Auth, Storage) con `@supabase/supabase-js` directo (**sin ORM**) · `react-hook-form` + `zod` · `@tanstack/react-table` · `recharts` · `date-fns` · `sonner` · `@react-pdf/renderer` (PDF en servidor) · SheetJS `xlsx` (Excel en cliente) · Vercel.

## Arquitectura (lo esencial)

- **Server Components por defecto**; Server Actions para todas las mutaciones; Route Handlers solo para PDFs (`/api/pdf/proforma/[id]`, `/api/pdf/venta/[id]`, `/api/pdf/kardex`). No hay API REST pública.
- **`kardex_movimientos` es la fuente de verdad del stock**: el stock actual se calcula (o se cachea vía trigger) desde ahí, nunca se edita directamente. Valorización **FIFO** por lotes usando `cantidad_restante_lote` en las entradas.
- **Operaciones críticas = funciones Postgres (`plpgsql`) vía `supabase.rpc()`**: `fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_convertir_proforma_a_venta`, `fn_ajuste_stock` (detalle en BACKEND.md §4).
- **Numeración correlativa** `PRO-0001` / `VEN-0001` con secuencias Postgres + trigger `BEFORE INSERT` — nunca `MAX(numero)+1` en la aplicación.
- **Descuentos**: se almacena el tipo (`porcentaje` | `monto_fijo`) y el valor aplicado, no solo el resultado. Impuesto = campo `impuesto_porcentaje` manual (default 0), sin cálculo automático de IVA.
- **RLS activo en todas las tablas** desde el primer sprint; roles `admin` / `vendedor` en la tabla `perfiles` (extiende `auth.users`). Sin registro público: usuarios creados por invitación del admin.
- **Roles**: el vendedor solo opera Proformas, POS y Clientes, con lectura de Productos/Inventario; todo lo demás (Dashboard, Compras, Proveedores, Reportes, Configuración, ajustes de stock) es solo admin. Matriz completa en FLUJO.md §10.
- Moneda: Boliviano (Bs). Una sola sucursal.
- **Base de datos ya definida**: los scripts SQL viven en [supabase/](supabase/README.md) (ejecutar 01→05 en orden en el SQL Editor; 06 es la verificación con rollback). Ese README documenta las decisiones de diseño que complementan BACKEND.md (stock cacheado, `configuracion_empresa`, estado `vencida` derivado, etc.).

## Identidad de marca (JISSACRUZ)

Guía completa en `../SISTEMA INVENTARIO/Brand Guidebook Jissacruz.pdf` (logo en `.ai` en la misma carpeta).

- **Colores**: `#0E3C6D` (azul oscuro primario), `#1D6DB2` (azul secundario), `#212121` (texto oscuro), `#B6B7B4` (gris), `#FFFFFF`. Deben representar ~80% del uso de color; matices adicionales vía opacidad de estos tonos.
- **Tipografía**: League Spartan (Light/Regular/Bold) para títulos, subtítulos, cuerpo y botones.
- UI_UX.md §1.2–1.3 ya está alineado con esta paleta y tipografía: azules corporativos como primario/acento, colores semánticos de stock (rojo/amarillo/verde) como excepción funcional, y tokens de marca definidos como variables CSS de shadcn/ui.
