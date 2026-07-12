# PLAN — Plan de Implementación para el Agente de IA
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 1.0
**Fecha:** Julio 2026
**Instrucción general:** Este plan debe seguirse en el orden indicado, fase por fase. No se debe avanzar a una fase sin haber completado y verificado la fase anterior. Cada fase corresponde a un módulo funcional (historia de usuario), sin bajar al detalle de implementación línea por línea — las decisiones de código concretas se toman durante el desarrollo respetando TRD.md y BACKEND.md como fuente de verdad técnica.

---

## Fase 0 — Configuración Inicial del Proyecto

**Objetivo:** dejar el entorno base listo antes de escribir cualquier funcionalidad de negocio.

1. Inicializar proyecto Next.js 14 (App Router) + TypeScript + Tailwind.
2. Instalar y configurar shadcn/ui + lucide-react.
3. Crear proyecto en Supabase: base de datos, Auth, Storage.
4. Configurar variables de entorno (`.env.local` y en Vercel): URL y claves de Supabase (anon + service role, esta última solo en servidor).
5. Configurar repositorio en GitHub y conexión con Vercel (CI/CD automático por rama/PR).
6. Crear estructura de carpetas según TRD.md (sección 3).
7. Configurar clientes de Supabase para servidor y cliente (`/lib/supabase`).
8. Verificación: la app debe desplegar en Vercel mostrando una página en blanco funcional, con conexión a Supabase confirmada.

## Fase 1 — Base de Datos y Seguridad

**Objetivo:** tener el esquema completo de datos antes de construir pantallas.

1. Crear todas las tablas descritas en BACKEND.md (sección 2).
2. Crear las secuencias y triggers de numeración correlativa (proformas, ventas).
3. Crear las funciones transaccionales (RPC) descritas en BACKEND.md sección 4.
4. Activar RLS en todas las tablas y crear las políticas base por rol (admin/vendedor).
5. Crear los buckets de Storage (`productos-imagenes`, `logo-empresa`) con sus políticas de acceso.
6. Crear índices recomendados (BACKEND.md sección 7).
7. Verificación: probar inserciones/lecturas de prueba directamente desde el SQL editor de Supabase confirmando que las políticas RLS bloquean/permiten correctamente según rol simulado.

## Fase 2 — Autenticación y Roles

**Objetivo:** control de acceso funcionando de punta a punta.

1. Implementar pantalla de Login (Supabase Auth).
2. Implementar flujo de invitación de usuario por Admin (sin registro público).
3. Implementar tabla/lógica de `perfiles` vinculada a `auth.users`, con asignación de rol.
4. Implementar layout general protegido: Sidebar + Header, con navegación condicionada por rol (según UI_UX.md sección 3).
5. Implementar cierre de sesión.
6. Verificación: un usuario admin ve todas las secciones del sidebar; un usuario vendedor ve solo las permitidas.

## Fase 3 — Catálogo de Productos

**Objetivo:** gestión completa de productos, base de todo lo demás.

1. Implementar CRUD de productos (datos generales).
2. Implementar gestión de códigos equivalentes (múltiples por producto).
3. Implementar gestión de compatibilidad con vehículos (múltiples por producto).
4. Implementar carga de imagen a Supabase Storage.
5. Implementar listado de productos con tabla (paginación, columnas según UI_UX.md 4.3).
6. Implementar buscador avanzado (código, descripción, equivalente, marca, línea, vehículo).
7. Verificación: crear un producto con 2 códigos equivalentes y 2 vehículos compatibles, y encontrarlo por cada uno de esos criterios en el buscador.

## Fase 4 — Inventario y Kardex

**Objetivo:** visibilidad de stock e historial de movimientos.

1. Implementar cálculo/visualización de stock actual por producto (a partir de `kardex_movimientos`).
2. Implementar indicador visual de stock (`<StockBadge />`) en catálogo e inventario.
3. Implementar vista de Kardex por producto (historial cronológico).
4. Implementar ajuste manual de stock (solo admin, con motivo obligatorio).
5. Implementar exportación de Kardex a PDF (`@react-pdf/renderer`) y Excel (SheetJS).
6. Verificación: un ajuste manual de entrada/salida se refleja correctamente en el stock y aparece en el Kardex exportado.

## Fase 5 — Proveedores y Compras

**Objetivo:** flujo completo de abastecimiento con impacto real en inventario.

1. Implementar CRUD de proveedores.
2. Implementar creación de órdenes de compra (selección de proveedor + productos + cantidades + costo).
3. Implementar acción "Recibir mercadería" que ejecuta la función `fn_recibir_orden_compra`.
4. Implementar historial de compras por proveedor.
5. Verificación: al recibir una orden de compra, el stock del producto aumenta y aparece un movimiento `entrada_compra` en el Kardex con el costo correcto (para uso posterior en FIFO).

## Fase 6 — Clientes

**Objetivo:** base de datos de clientes lista para proformas y ventas.

1. Implementar CRUD de clientes (nombre, CI/NIT, teléfono, dirección).
2. Implementar buscador rápido de clientes (usado dentro de Proformas y POS).
3. Implementar vista de historial de compras por cliente (placeholder hasta que existan ventas — se completa en Fase 8).
4. Verificación: crear, editar y buscar un cliente correctamente.

## Fase 7 — Proformas / Cotizaciones

**Objetivo:** flujo comercial formal de cotización, previo a la venta.

1. Implementar formulario de nueva proforma (cliente, tipo de pago, plazo de validez, glosa).
2. Integrar el buscador avanzado de productos para agregar ítems.
3. Implementar lógica de descuento por línea (% o monto fijo) y cálculo de subtotal/total, incluyendo campo de impuesto configurable.
4. Implementar numeración automática (`PRO-0001`).
5. Implementar generación de PDF de proforma.
6. Implementar listado de proformas con filtros (fecha, cliente, estado).
7. Verificación: crear una proforma completa, generar su PDF y confirmar que el número correlativo y los totales son correctos.

## Fase 8 — Ventas (Punto de Venta) y Conversión de Proforma

**Objetivo:** cierre del ciclo comercial con impacto en stock.

1. Implementar interfaz de POS (buscador + carrito) según UI_UX.md 4.8.
2. Implementar registro de venta directa, invocando la función transaccional `fn_registrar_venta` (numeración, descuento de stock FIFO, movimiento de Kardex).
3. Implementar generación de comprobante de venta en PDF.
4. Implementar acción "Convertir a venta" desde una proforma, invocando `fn_convertir_proforma_a_venta`.
5. Completar la vista de historial de compras por cliente (iniciada en Fase 6) con las ventas reales.
6. Verificación: realizar una venta directa y una conversión de proforma a venta; confirmar en ambos casos que el stock se descuenta correctamente según FIFO y que los documentos PDF se generan con el número correcto.

## Fase 9 — Dashboard y Reportes

**Objetivo:** visibilidad ejecutiva del negocio para el administrador.

1. Implementar tarjetas KPI del Dashboard (ventas de hoy, stock bajo, proformas pendientes, compras recientes).
2. Implementar gráfico de ventas de los últimos días (`recharts`).
3. Implementar reporte de ventas por período (diario/semanal/mensual).
4. Implementar reporte de proformas por estado.
5. Implementar reporte de productos más vendidos.
6. Implementar reporte de estado de inventario por categoría/línea.
7. Implementar exportación a PDF y Excel en cada reporte.
8. Verificación: los KPIs y reportes reflejan correctamente los datos generados en las fases anteriores (usar datos de prueba creados durante el desarrollo).

## Fase 10 — Configuración del Sistema

**Objetivo:** administración operativa sin intervención técnica.

1. Implementar gestión de usuarios (invitar, activar/desactivar, asignar rol) desde la interfaz (no solo desde Supabase directamente).
2. Implementar configuración de datos de la empresa (nombre, NIT, dirección, logo) usados en los PDFs.
3. Implementar configuración de stock mínimo por defecto.
4. Verificación: el admin puede invitar un nuevo vendedor y este puede iniciar sesión sin intervención técnica manual en la base de datos.

## Fase 11 — Pruebas Integrales, UAT y Despliegue Final

**Objetivo:** validar el sistema completo con el cliente y publicarlo en producción.

1. Ejecutar pruebas de integración de punta a punta: compra → stock → proforma → venta → reportes.
2. Revisar y ajustar políticas RLS de todas las tablas (auditoría final de seguridad).
3. Configurar dominio propio en Vercel con SSL.
4. Realizar sesión de UAT con el cliente (Rodrigo): recorrer los flujos principales en producción o entorno de staging.
5. Registrar y corregir los errores/observaciones detectados en UAT.
6. Redactar documentación básica de uso (manual de usuario) para admin y vendedor.
7. Despliegue final en producción y entrega de credenciales al cliente.

---

## Reglas de Ejecución para el Agente de IA

- No implementar una fase sin haber verificado (aunque sea manualmente) que la fase anterior funciona.
- No introducir tecnologías fuera de las definidas en TRD.md sin consultarlo explícitamente.
- Toda operación que modifique stock debe pasar por las funciones transaccionales (RPC) definidas en BACKEND.md — nunca actualizar stock directamente desde el cliente o mediante múltiples queries no atómicas.
- Ante cualquier ambigüedad no cubierta por PRD.md, TRD.md, UI_UX.md, FLUJO.md o BACKEND.md, el agente debe señalar la duda explícitamente en lugar de asumir un comportamiento no especificado.
