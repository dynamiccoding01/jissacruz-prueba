# UI/UX — Diseño de Interfaz y Experiencia de Usuario
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 1.0
**Fecha:** Julio 2026

---

## 1. Estilo Visual General

**Enfoque elegido:** Dashboard clásico tipo admin panel — denso en datos, orientado a tablas, con sidebar de navegación fija. Prioriza velocidad de trabajo sobre estética minimalista, ya que los usuarios (admin/vendedor) usan el sistema de forma intensiva y repetitiva durante el día.

### 1.1 Principios de diseño
- **Densidad de información**: tablas compactas, más filas visibles por pantalla, uso eficiente del espacio.
- **Feedback inmediato**: toasts (`sonner`) para confirmar acciones (guardado, error, venta registrada).
- **Indicadores de color consistentes** para estado de stock en toda la app:
  - 🔴 Rojo → sin stock (cantidad = 0)
  - 🟡 Amarillo → stock bajo (cantidad ≤ mínimo configurado)
  - 🟢 Verde → stock disponible (cantidad > mínimo)
- **Acceso rápido**: el POS y la búsqueda de productos deben minimizar clics; se prioriza el teclado (atajos, autocompletar) sobre el mouse en flujos de venta.

### 1.2 Paleta de color (Brand Guidebook JISSACRUZ)

Fuente: `Brand Guidebook Jissacruz.pdf` (carpeta `SISTEMA INVENTARIO`). La paleta central de la marca debe representar ~80% del uso de color; los matices adicionales se obtienen aplicando opacidad sobre estos mismos tonos.

**Paleta central de la marca:**

| Color | HEX | RGB |
|---|---|---|
| Azul oscuro (primario) | `#0E3C6D` | 14, 60, 109 |
| Azul (secundario) | `#1D6DB2` | 29, 109, 178 |
| Negro | `#212121` | 33, 33, 33 |
| Gris | `#B6B7B4` | 182, 183, 180 |
| Blanco | `#FFFFFF` | 255, 255, 255 |

**Aplicación en la interfaz:**

| Uso | Color |
|---|---|
| Primario (acciones, botones principales) | Azul corporativo `#0E3C6D` |
| Hover / estados activos, enlaces, acentos | Azul secundario `#1D6DB2` |
| Fondo general | `#FFFFFF`, con superficies alternas en `#B6B7B4` a baja opacidad (ej. 10–15%) |
| Sidebar | `#0E3C6D` con texto `#FFFFFF` |
| Texto principal | `#212121` |
| Texto secundario / deshabilitado | `#212121` con opacidad, o `#B6B7B4` |
| Bordes / separadores | `#B6B7B4` (con opacidad para matices más suaves) |
| Éxito / stock disponible | `green-600` |
| Advertencia / stock bajo | `amber-500` |
| Peligro / sin stock, eliminar | `red-600` |

> Los colores semánticos de estado (verde/amarillo/rojo de stock, éxito, error) son una excepción funcional a la paleta de marca: se mantienen por accesibilidad y convención de UI, y no cuentan dentro del 80% de uso de color de marca.

**Implementación:** definir los colores de marca como tokens en la configuración de Tailwind / variables CSS de shadcn/ui (ej. `--primary: #0E3C6D`, `--primary-hover: #1D6DB2`, `--foreground: #212121`, `--muted: #B6B7B4`), de modo que los componentes shadcn/ui los hereden sin sobrescribir clase por clase.

### 1.3 Tipografía
- Fuente: **League Spartan** (Light / Regular / Bold), según el sistema de fuentes del Brand Guidebook (títulos, subtítulos, cuerpo de texto y botones usan la misma familia). Fallback: `system-ui`.
- Cargar vía `next/font/google` (League Spartan está disponible en Google Fonts).
- Tamaños compactos: `text-sm` para tablas, `text-base` para formularios, `text-2xl` para títulos de sección.
- Jerarquía por peso: Bold para títulos y botones, Regular para cuerpo, Light solo en frases de destaque.

## 2. Estructura General de la Interfaz

```
┌───────────┬─────────────────────────────────────────────┐
│           │  Header: nombre de sección + usuario/rol      │
│  Sidebar  ├─────────────────────────────────────────────┤
│  (fijo,   │                                               │
│  colapsable) │           Contenido principal              │
│           │        (tablas, formularios, tarjetas KPI)   │
│           │                                               │
└───────────┴─────────────────────────────────────────────┘
```

- **Sidebar**: navegación principal, iconos + texto, colapsable a solo iconos. Ítems visibles según rol.
- **Header**: breadcrumb o título de la sección actual, buscador global rápido (opcional), avatar/menú de usuario con opción de cerrar sesión.
- **Contenido principal**: cambia según la ruta; en listados usa tablas con filtros arriba; en POS usa layout de 2 columnas (buscador+carrito).

## 3. Navegación (Sidebar) por Rol

| Sección | Ícono sugerido | Administrador | Vendedor |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | ✅ | ❌ (o vista simplificada) |
| Productos | `Package` | ✅ | 👁️ solo lectura |
| Inventario / Kardex | `Boxes` | ✅ | 👁️ solo lectura |
| Proveedores | `Truck` | ✅ | ❌ |
| Compras | `ShoppingCart` | ✅ | ❌ |
| Proformas | `FileText` | ✅ | ✅ |
| Ventas (POS) | `CreditCard` | ✅ | ✅ |
| Clientes | `Users` | ✅ | ✅ (crear/consultar) |
| Reportes | `BarChart3` | ✅ | ❌ |
| Configuración | `Settings` | ✅ | ❌ |

## 4. Pantallas Principales

### 4.1 Login
- Formulario simple: email + contraseña.
- Sin opción de "registrarse" (usuarios creados por invitación del admin).
- Mensaje de error claro si las credenciales son inválidas.

### 4.2 Dashboard (solo Admin)
- Tarjetas KPI superiores: Ventas de hoy, Stock bajo (cantidad de productos), Proformas pendientes, Compras recientes.
- Gráfico de ventas de los últimos 7/30 días (`recharts`).
- Tabla resumen de "Productos con stock crítico".
- Accesos directos a: Nueva venta, Nueva proforma, Nuevo producto.

### 4.3 Productos (Catálogo)
- Tabla con columnas: imagen miniatura, código, descripción, línea/marca, precio, stock (con indicador de color), acciones (editar/ver/eliminar).
- Barra de búsqueda avanzada con filtros: código, equivalente, marca, línea, vehículo.
- Botón "Nuevo producto" → abre formulario/modal con:
  - Datos generales (código, descripción, línea/marca, unidad de medida, precio, imagen)
  - Sección "Códigos equivalentes" (lista editable, agregar/quitar)
  - Sección "Compatibilidad con vehículos" (lista editable de marca/modelo)

### 4.4 Inventario / Kardex
- Vista de stock actual: tabla con indicador de color, cantidad, stock mínimo configurado.
- Botón para ver Kardex de un producto específico: tabla cronológica de movimientos (entrada/salida/venta, cantidad, costo, saldo).
- Botones de exportación: "Exportar PDF" y "Exportar Excel".
- Opción de "Ajuste manual de stock" (con motivo obligatorio) — solo Admin.

### 4.5 Proveedores
- Tabla simple: nombre, contacto, RUC, dirección, acciones.
- Formulario de alta/edición en modal.

### 4.6 Compras (Órdenes de Compra)
- Listado de órdenes de compra con estado (pendiente / recibida).
- Formulario de nueva orden: selección de proveedor + productos + cantidades + costo unitario.
- Acción "Recibir mercadería": marca la orden como recibida y dispara la actualización de stock/Kardex.
- Vista de historial de compras filtrable por proveedor.

### 4.7 Proformas
- Listado con filtros: fecha, cliente, estado (vigente/convertida/vencida).
- Formulario de nueva proforma:
  1. Selección/creación rápida de cliente.
  2. Datos del documento: tipo de pago, plazo de validez, glosa.
  3. Buscador de productos (mismo componente de búsqueda avanzada del catálogo) para agregar ítems.
  4. Tabla de ítems con cantidad, precio, descuento (% o Bs), subtotal por línea.
  5. Totales: subtotal, descuento total, impuesto (si aplica), total.
- Acciones: "Guardar", "Generar PDF", "Convertir a venta".

### 4.8 Ventas (Punto de Venta - POS)
- Layout de 2 columnas:
  - **Izquierda**: buscador de productos (grande, con foco automático) + resultados en tarjetas/lista rápida para agregar al carrito con un clic.
  - **Derecha**: carrito de venta (tabla compacta: producto, cantidad editable, precio, descuento, subtotal), cliente asociado (opcional/rápido), totales, botón "Confirmar venta".
- Al confirmar: genera número correlativo, descuenta stock, muestra confirmación y opción de imprimir/descargar comprobante PDF.

### 4.9 Clientes
- Tabla: nombre, CI/NIT, teléfono, dirección, acciones.
- Vista de detalle de cliente con historial de compras (proformas y ventas asociadas).

### 4.10 Reportes (solo Admin)
- Selector de tipo de reporte (tabs o menú lateral interno): Ventas por período, Proformas, Productos más vendidos, Estado de inventario.
- Filtros de fecha/categoría según el reporte.
- Tabla de resultados + gráfico cuando aplique.
- Botones de exportación PDF/Excel en cada reporte.

### 4.11 Configuración (solo Admin)
- Gestión de usuarios (invitar nuevo vendedor, activar/desactivar).
- Configuración de stock mínimo por defecto.
- Datos de la empresa para los PDFs (nombre, NIT, dirección, logo).

## 5. Componentes Reutilizables Clave

| Componente | Uso |
|---|---|
| `<StockBadge />` | Indicador de color (rojo/amarillo/verde) reutilizado en catálogo, inventario, POS |
| `<BusquedaAvanzadaProductos />` | Buscador con filtros combinados, usado en Catálogo, Proformas y POS |
| `<TablaDatos />` | Wrapper sobre `@tanstack/react-table` con paginación, orden y filtros estándar |
| `<FormularioProducto />` | Formulario compartido para crear/editar producto (incluye equivalentes y vehículos) |
| `<CarritoVenta />` | Componente del POS y de Proformas (comparten lógica de líneas + descuento + totales) |
| `<ExportButtons />` | Botones estándar "Exportar PDF" / "Exportar Excel" |
| `<KPICard />` | Tarjeta de métrica para el Dashboard |
| `<Sidebar />` / `<Header />` | Layout general, filtran opciones según rol |

## 6. Estados y Feedback

- **Carga de datos**: skeletons (shadcn/ui `<Skeleton />`) en tablas y tarjetas mientras se obtienen datos del servidor.
- **Estados vacíos**: mensajes claros ("Aún no hay productos registrados" + botón de acción) en listados vacíos.
- **Confirmaciones destructivas**: modal de confirmación (`<AlertDialog />`) antes de eliminar productos, proveedores o clientes.
- **Errores de validación**: inline, debajo de cada campo, usando mensajes de `zod` + `react-hook-form`.
