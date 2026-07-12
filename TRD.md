# TRD — Technical Requirements Document
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 1.0
**Fecha:** Julio 2026

---

## 1. Stack Tecnológico (Definitivo)

| Capa | Tecnología | Notas |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Server Components por defecto; Client Components solo donde se requiera interactividad |
| **Lenguaje** | TypeScript | Tipado estricto (`strict: true`) |
| **Estilos** | Tailwind CSS | Utility-first |
| **Componentes UI** | shadcn/ui | Componentes accesibles sobre Radix UI, personalizables |
| **Iconos** | lucide-react | Consistente con shadcn/ui |
| **Base de datos** | Supabase (Postgres) | Base de datos relacional gestionada |
| **Autenticación** | Supabase Auth | Invitación manual por admin, sin registro público |
| **Storage de archivos** | Supabase Storage | Imágenes de productos |
| **Acceso a datos** | `@supabase/supabase-js` (cliente directo) | Sin ORM adicional (sin Prisma/Drizzle) |
| **Generación de PDF** | `@react-pdf/renderer` | Proformas, comprobantes de venta, Kardex en PDF |
| **Exportación Excel** | SheetJS (`xlsx`) | Ejecutado en cliente |
| **Hosting / CI-CD** | Vercel | Despliegue automático desde GitHub |
| **Control de versiones** | GitHub | Repositorio privado |
| **Gestión de tareas** | GitHub Projects / Trello | Tablero Scrum |

### 1.1 Librerías adicionales recomendadas

| Necesidad | Librería |
|---|---|
| Formularios | `react-hook-form` + `zod` (validación de esquemas) |
| Tablas de datos | `@tanstack/react-table` (sobre componentes shadcn/ui) |
| Gráficos del dashboard | `recharts` |
| Manejo de fechas | `date-fns` |
| Notificaciones (toast) | `sonner` (integrado con shadcn/ui) |
| Estado de servidor / caché | Funciones nativas de Next.js (Server Actions + `revalidatePath`) — sin librería adicional de data-fetching salvo que se justifique |

## 2. Arquitectura General (Blueprint)

```
┌─────────────────────────────────────────────────────────┐
│                     Cliente (Navegador)                  │
│         Next.js App Router — Client Components           │
└───────────────────────┬───────────────────────────────────┘
                         │ Server Actions / fetch
┌───────────────────────▼───────────────────────────────────┐
│              Next.js Server (Vercel Functions)            │
│  - Server Components (render inicial)                    │
│  - Server Actions (mutaciones: crear venta, proforma...)  │
│  - Route Handlers /api (PDF generation, exportaciones)    │
└───────────────────────┬───────────────────────────────────┘
                         │ supabase-js (service role / anon key)
┌───────────────────────▼───────────────────────────────────┐
│                        Supabase                            │
│  - Postgres (tablas + RLS policies)                        │
│  - Auth (usuarios, roles vía tabla `perfiles`)              │
│  - Storage (bucket `productos-imagenes`)                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Principios de arquitectura

- **Server Components por defecto**: la carga inicial de listados (productos, ventas, proformas) se hace en el servidor.
- **Server Actions para mutaciones**: crear/editar producto, registrar venta, registrar compra, etc. Evita exponer lógica de negocio en el cliente.
- **Row Level Security (RLS)** activo en todas las tablas de Supabase: las políticas validan el rol del usuario autenticado (admin/vendedor) antes de permitir lectura/escritura.
- **Transacciones atómicas** para operaciones críticas (ej. registrar venta + descontar stock + insertar movimiento de Kardex) implementadas como funciones de Postgres (`plpgsql`) invocadas vía `supabase.rpc()`, para evitar inconsistencias si falla un paso.
- **Generación de PDF en servidor**: los Route Handlers (`/api/pdf/proforma/[id]`, `/api/pdf/venta/[id]`, `/api/pdf/kardex`) renderizan el documento con `@react-pdf/renderer` y lo devuelven como stream descargable.
- **Exportación a Excel en cliente**: se arma el JSON de datos en servidor y se construye el archivo `.xlsx` en el navegador con SheetJS, evitando carga de cómputo en el servidor.

## 3. Estructura de Carpetas (Next.js App Router)

```
/app
  /(auth)
    /login
  /(dashboard)
    /dashboard
    /productos
    /inventario
    /kardex
    /proveedores
    /compras
    /proformas
    /ventas
    /clientes
    /reportes
    /configuracion
  /api
    /pdf
      /proforma/[id]
      /venta/[id]
      /kardex
    /export
      /excel
/components
  /ui              → componentes shadcn/ui
  /productos
  /inventario
  /ventas
  /proformas
  /shared          → sidebar, header, indicadores de stock, etc.
/lib
  /supabase        → clientes (server/client/admin)
  /pdf             → plantillas react-pdf
  /excel           → helpers de exportación
  /validations     → esquemas zod
  /utils
/types             → tipos TypeScript generados desde el esquema de Supabase
```

## 4. Módulos / "APIs" internas (Server Actions y Route Handlers)

> El sistema no expone una API REST pública; la comunicación es interna vía Server Actions. Se documentan como "endpoints funcionales" para claridad del agente de desarrollo.

### 4.1 Autenticación
- `signIn(email, password)` — Server Action, usa Supabase Auth.
- `signOut()` — Server Action.
- `getSessionRole()` — obtiene el rol del usuario autenticado desde la tabla `perfiles`.

### 4.2 Productos
- `createProducto(data)`
- `updateProducto(id, data)`
- `deleteProducto(id)` (soft delete: campo `activo = false`)
- `addCodigoEquivalente(productoId, data)`
- `addCompatibilidadVehiculo(productoId, data)`
- `searchProductos(query)` — búsqueda avanzada por código/equivalente/descripción/marca/vehículo

### 4.3 Inventario
- `getStockActual(productoId?)`
- `getKardex(productoId, rangoFechas)`
- `registrarAjusteManual(productoId, cantidad, motivo)` (entrada/salida manual, ej. mermas)

### 4.4 Compras
- `createProveedor(data)` / `updateProveedor(id, data)`
- `createOrdenCompra(data)`
- `recibirMercaderia(ordenCompraId, items)` → dispara función RPC que inserta movimiento de entrada en Kardex y actualiza stock

### 4.5 Proformas
- `createProforma(data)` → genera número correlativo `PRO-XXXX`
- `addItemProforma(proformaId, producto, cantidad, descuento)`
- `convertirProformaAVenta(proformaId)` → crea venta ligada, marca proforma como "convertida"
- `getProformaPDF(id)` (route handler)

### 4.6 Ventas (POS)
- `createVenta(data)` → genera número correlativo `VEN-XXXX`, ejecuta RPC transaccional: inserta venta + items + descuenta stock (FIFO) + inserta movimientos de salida en Kardex
- `getVentaPDF(id)` (route handler)
- `getHistorialComprasCliente(clienteId)`

### 4.7 Clientes
- `createCliente(data)` / `updateCliente(id, data)`
- `searchClientes(query)`

### 4.8 Reportes / Dashboard
- `getDashboardKPIs()` — ventas del día, stock bajo, proformas pendientes, compras recientes
- `getReporteVentas(rangoFechas, agrupacion)`
- `getReporteProformas(estado?)`
- `getReporteProductosMasVendidos(rangoFechas)`
- `getReporteInventario(categoria?)`
- `exportToExcel(dataset, tipo)` (helper de cliente)

## 5. Reglas Técnicas de Negocio

- **Valorización de inventario:** método FIFO. Cada entrada de stock (compra) se registra como un "lote" con costo y fecha; las salidas (ventas) consumen lotes en orden de antigüedad para calcular el costo de venta.
- **Numeración correlativa:** se implementa mediante una secuencia de Postgres por tipo de documento (`proformas_seq`, `ventas_seq`), formateada como `PRO-0001` / `VEN-0001`. Debe garantizarse que no haya saltos ni duplicados bajo concurrencia (uso de `SERIAL`/secuencia atómica, no cálculo en el cliente).
- **Descuentos:** cada línea o el total del documento admite descuento en `%` o en monto fijo (`Bs`); se almacena el tipo y el valor aplicado, no solo el resultado, para trazabilidad.
- **Impuestos:** campo `impuesto_porcentaje` configurable a nivel de documento (proforma/venta), por defecto en `0`, mostrado en el PDF si es mayor a 0. No hay cálculo automático de IVA en esta versión.
- **Roles y RLS:** todas las políticas de Postgres verifican `auth.uid()` contra la tabla `perfiles` para determinar si el usuario es `admin` o `vendedor`, y restringen operaciones sensibles (ej. eliminar productos, ver reportes financieros completos) solo a `admin`.
- **Imágenes de producto:** se almacenan en Supabase Storage (bucket público de solo lectura), y solo la URL se guarda en la tabla `productos`.

## 6. Requisitos No Funcionales

| Aspecto | Requisito |
|---|---|
| **Disponibilidad** | Sistema accesible 24/7 vía Vercel (SLA estándar de la plataforma) |
| **Seguridad** | RLS activo en todas las tablas; claves de servicio (`service_role`) nunca expuestas al cliente |
| **Rendimiento** | Listados con paginación server-side; búsquedas con índices en Postgres sobre campos de código/descripción |
| **Responsive** | Interfaz utilizable en escritorio y tablet como mínimo; POS optimizado para uso rápido en mostrador |
| **Backups** | Backups automáticos de Supabase (plan Pro) como plan de contingencia |
| **Dominio** | Dominio propio configurado sobre Vercel, con certificado SSL automático |
