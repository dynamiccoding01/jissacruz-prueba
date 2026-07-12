# PRD — Product Requirements Document
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Cliente:** Rodrigo
**Desarrollado por:** Dynamic Coding
**Versión:** 1.0
**Fecha:** Julio 2026

---

## 1. Visión General

Sistema web de gestión integral para una tienda de repuestos para camiones de alto tonelaje en Santa Cruz, Bolivia. Permite controlar el ciclo completo del negocio: catálogo de productos, inventario, compras a proveedores, cotizaciones (proformas), ventas (punto de venta) y reportería, desde cualquier dispositivo con acceso a internet.

El sistema reemplaza procesos manuales (cuadernos, hojas de cálculo) por una plataforma centralizada, con roles diferenciados (administrador / vendedor) y trazabilidad completa de movimientos de stock.

## 2. Problema a Resolver

- No existe control centralizado del stock: se desconoce con precisión qué hay disponible, qué está por agotarse y qué se movió en un período.
- La búsqueda de repuestos es compleja porque un mismo producto puede tener múltiples códigos según el fabricante (códigos equivalentes) y aplicar a distintos vehículos.
- No hay proceso formal de cotización (proforma) ni de conversión de cotización a venta.
- No hay historial de compras a proveedores ni de compras por cliente.
- No existen reportes para tomar decisiones (qué se vende más, cuánto stock queda, cómo evolucionan las ventas).

## 3. Usuarios del Sistema

| Rol | Descripción | Necesidades principales |
|---|---|---|
| **Administrador** | Dueño/gerente del negocio (Rodrigo) | Ver todo el negocio: inventario, compras, ventas, reportes, KPIs. Gestionar usuarios, proveedores, productos. |
| **Vendedor** | Personal de venta en mostrador | Buscar productos rápido, generar proformas, realizar ventas (POS), consultar stock. Acceso limitado a reportes y configuración. |

No hay usuarios "cliente final" con cuenta propia — los clientes son solo registros de datos (para historial y comprobantes), no tienen login.

## 4. Objetivos del Producto

1. Centralizar el catálogo de repuestos con búsqueda avanzada (código, equivalente, marca, vehículo).
2. Mantener el inventario siempre actualizado y visible mediante indicadores de stock por color.
3. Registrar trazabilidad completa de cada movimiento de stock (Kardex).
4. Formalizar el proceso comercial: Proforma → Venta, con documentos PDF profesionales.
5. Dar visibilidad del negocio al administrador mediante un dashboard con KPIs y reportes exportables.
6. Operar 100% en la nube, accesible desde cualquier dispositivo, sin instalación local.

## 5. Funcionalidades (Alcance Incluido)

### 5.1 Autenticación y Roles
- Login seguro vía Supabase Auth.
- Sin registro público: los usuarios (admin/vendedor) son creados/invitados manualmente por el administrador.
- Permisos diferenciados por rol en cada módulo.

### 5.2 Catálogo de Productos
- Registro de repuestos: código de parte, línea/marca, unidad de medida, imagen, precio.
- Códigos equivalentes: un repuesto puede tener múltiples códigos de distintos fabricantes.
- Compatibilidad vehicular: marca y modelo de vehículo asociado a cada producto.
- Búsqueda avanzada combinando código, descripción, equivalente, marca, línea y vehículo.

### 5.3 Inventario
- Stock actual por producto con indicador visual: rojo (sin stock), amarillo (bajo mínimo), verde (disponible).
- Alertas configurables de stock mínimo por producto.
- Kardex: historial completo de movimientos (entradas, salidas, ventas) valorizado con método **FIFO**.
- Exportación de Kardex y reportes de inventario a PDF y Excel.

### 5.4 Compras
- Registro de proveedores (nombre, contacto, RUC, dirección).
- Órdenes de compra asociadas a proveedor.
- Recepción de mercadería con actualización automática de stock (entrada al Kardex).
- Historial de compras por proveedor.

### 5.5 Proformas / Cotizaciones
- Formulario de proforma: cliente, tipo de pago, plazo de validez, glosa.
- Agregado de productos vía búsqueda avanzada.
- Cálculo automático de subtotal, descuentos (% o monto fijo, a elección del vendedor) y total.
- Campo de impuesto configurable en el documento (sin cálculo automático en esta versión).
- Numeración correlativa automática (formato `PRO-0001`, `PRO-0002`...).
- Generación de PDF imprimible.
- Conversión directa de proforma a venta.
- Listado con filtros por fecha, cliente y estado (vigente / convertida / vencida).

### 5.6 Ventas (Punto de Venta)
- Búsqueda avanzada de productos dentro del POS.
- Carrito de venta con cálculo de subtotal, descuentos y total.
- Descuento automático del stock (salida al Kardex, valorizado FIFO) al confirmar la venta.
- Numeración correlativa automática (formato `VEN-0001`, `VEN-0002`...).
- Emisión de comprobante de venta en PDF.
- Registro y consulta de historial de compras por cliente.

### 5.7 Clientes
- CRUD de clientes: nombre, CI/NIT, teléfono, dirección.
- Historial de compras asociado.

### 5.8 Reportes y Dashboard
- Dashboard principal con KPIs: ventas del día, productos con stock bajo, proformas pendientes, compras recientes.
- Reporte de ventas por período (diario / semanal / mensual).
- Reporte de proformas (emitidas, convertidas, vencidas).
- Reporte de productos más vendidos.
- Reporte de estado de inventario por categoría/línea.
- Exportación de reportes a PDF y Excel.

### 5.9 Despliegue
- Publicación en producción sobre Vercel + Supabase, con dominio propio.

## 6. Fuera del Alcance (esta versión)

- Aplicación móvil nativa (iOS / Android).
- Integración con facturación electrónica fiscal (SIN Bolivia).
- Gestión de múltiples sucursales.
- Sistema contable / ERP completo.
- Cálculo automático de impuestos (queda como campo configurable/manual).
- Registro público de clientes con cuenta propia.

## 7. Criterios de Éxito

- El administrador puede ver el estado completo del negocio (stock, ventas, compras) desde el dashboard sin necesidad de reportes externos.
- Un vendedor puede encontrar un repuesto por código, equivalente o vehículo en menos de 3 pasos de búsqueda.
- Toda venta o compra queda reflejada automáticamente en el stock, sin ajustes manuales.
- Toda proforma puede convertirse en venta sin volver a capturar los datos del cliente o los productos.
- El sistema opera de forma estable en producción, accesible desde navegador de escritorio y móvil.

## 8. Supuestos y Restricciones

- El negocio opera en una sola sucursal/ubicación.
- La moneda de trabajo es el Boliviano (Bs).
- Los usuarios administrador y vendedor usan el sistema desde navegador; no se optimiza como app instalable (PWA queda fuera de esta versión salvo que se indique lo contrario).
- El volumen de datos esperado corresponde a una tienda de repuestos de tamaño pequeño/mediano (no se diseña para alta concurrencia masiva).
