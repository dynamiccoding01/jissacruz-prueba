# SISREP

Sistema web de inventario, compras y ventas de repuestos para camiones de alto tonelaje — **JISSACRUZ** (Santa Cruz, Bolivia).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui (Radix UI) · Supabase (Postgres, Auth, Storage) · `react-hook-form` + `zod` · `@tanstack/react-table` · `@react-pdf/renderer` · SheetJS (`xlsx`)

Detalle completo en [TRD.md](TRD.md).

## Documentos fuente de verdad

| Documento | Rol |
|---|---|
| [PLAN.md](PLAN.md) | Orden de implementación por fases |
| [TRD.md](TRD.md) | Stack, arquitectura, estructura de carpetas |
| [BACKEND.md](BACKEND.md) | Esquema de base de datos, funciones RPC, RLS |
| [PRD.md](PRD.md) | Alcance funcional |
| [UI_UX.md](UI_UX.md) | Pantallas y navegación por rol |
| [FLUJO.md](FLUJO.md) | Flujos de negocio de punta a punta |
| [supabase/README.md](supabase/README.md) | Scripts SQL: orden de ejecución y decisiones de diseño |

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar con las claves del proyecto de Supabase
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Base de datos

Los scripts SQL viven en [supabase/](supabase/README.md). Para un proyecto de Supabase nuevo, correr `supabase/00_setup_completo.sql` completo en el SQL Editor; para migraciones incrementales sobre una base ya existente, ver la tabla de scripts en ese mismo README.
