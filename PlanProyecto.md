# DYNAMIC CODING
### Desarrollo de Software a Medida

# PLAN DE PROYECTO
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

| | |
|---|---|
| **Cliente:** Rodrigo | **Inicio:** 14 de julio de 2026 |
| **Proyecto:** Sistema de Inventario de Repuestos | **Entrega:** 5 de septiembre de 2026 |
| **Equipo:** 2 desarrolladores — Dynamic Coding | **Metodología:** Scrum (4 sprints × 2 semanas) |

*Versión 1.0 \| 24 de junio de 2026*

---

> ⚠️ **Documento base firmado — NO EDITAR.** Es la línea base contractual acordada con el cliente (alcance, cronograma, pagos y firmas). Se conserva como foto del arranque del proyecto. Para el **avance real y el estado de cada tarea**, ver [PLAN.md](PLAN.md).

---

## 1. Resumen Ejecutivo

Dynamic Coding desarrollará para el cliente Rodrigo un sistema web de gestión de inventario, compras y ventas para su nueva tienda de repuestos de automóviles en Santa Cruz, Bolivia. El sistema permitirá llevar el control completo del negocio: desde el stock de productos hasta las ventas diarias, con acceso desde cualquier dispositivo conectado a internet.

El proyecto se ejecuta bajo metodología Scrum en 4 sprints de 2 semanas cada uno, con una duración total aproximada de 8 semanas (14 de julio al 5 de septiembre de 2026).

## 2. Objetivos del Proyecto

### Objetivo General

Entregar un sistema de inventario y compra-venta web, funcional, seguro y desplegado en producción, adaptado a las necesidades operativas de una tienda de repuestos de automóviles.

### Objetivos Específicos

1. Implementar catálogo de repuestos con búsqueda avanzada por código, equivalente, marca y vehículo.
2. Implementar control de inventario con Kardex, alertas de stock mínimo e indicadores visuales.
3. Desarrollar el módulo de compras con gestión de proveedores y órdenes de compra.
4. Crear el módulo de Proforma/Cotización con generación de PDF imprimible.
5. Crear el módulo de ventas con punto de venta, comprobantes y gestión de clientes.
6. Construir un dashboard con reportes de ventas, proformas, inventario y Kardex exportable.
7. Desplegar el sistema en producción (Vercel + Supabase) con dominio propio.

## 3. Alcance del Sistema

### Incluido en el proyecto

- Módulo de autenticación: login seguro, roles (administrador / vendedor)
- Catálogo de productos: código de parte, línea/marca, unidad de medida, imagen, precio
- Gestión de códigos equivalentes: cada repuesto puede tener múltiples códigos de distintos fabricantes
- Compatibilidad de repuesto con vehículos: marca y modelo de vehículo por producto
- Búsqueda avanzada de productos: por código, descripción, equivalente, marca, línea y vehículo
- Control de inventario: stock actual con indicadores por color (rojo=sin stock, amarillo=bajo, verde=disponible), movimientos, alertas de mínimo
- Kardex: historial completo de movimientos por producto (entradas/salidas/ventas), exportable a PDF y Excel
- Módulo de compras: registro de proveedores, órdenes de compra, recepción de mercadería
- Módulo de Proforma/Cotización: generación de proformas con PDF imprimible, plazo de validez, tipo de pago, conversión a venta
- Módulo de ventas: punto de venta con búsqueda avanzada, descuentos, emisión de comprobante en PDF
- Gestión de clientes: registro con CI/NIT, historial de compras
- Reportes: ventas por período, productos más vendidos, stock actual, movimientos de inventario
- Dashboard principal con KPIs del negocio
- Despliegue en producción con dominio propio (1 año incluido)

### Fuera del alcance (no incluido)

- Aplicación móvil nativa (iOS / Android)
- Integración con facturación electrónica fiscal (SIN Bolivia)
- Gestión de múltiples sucursales
- Sistema contable / ERP

## 4. Equipo del Proyecto

| Rol | Responsable | Responsabilidades |
|---|---|---|
| **Scrum Master / Dev Lead** | Desarrollador 1 (Dynamic Coding) | Gestión del proyecto, arquitectura del sistema, backend, despliegue |
| **Developer / QA** | Desarrollador 2 (Dynamic Coding) | Frontend, pruebas, integración de módulos, documentación |
| **Product Owner** | Rodrigo (Cliente) | Validar funcionalidades, aprobar sprints, proveer información del negocio |

## 5. Metodología: Scrum

Se utiliza la metodología ágil Scrum con ciclos de desarrollo de 2 semanas (sprints). Al final de cada sprint se entrega una versión funcional del sistema para revisión del cliente.

### Ceremonias Scrum

| Ceremonia | Frecuencia | Descripción |
|---|---|---|
| **Sprint Planning** | Inicio de cada sprint | Definir las tareas del sprint y asignar responsabilidades |
| **Daily Standup** | Diaria (15 min) | Sincronización del equipo: qué se hizo, qué sigue, bloqueos |
| **Sprint Review** | Fin de cada sprint | Demostración al cliente de las funcionalidades completadas |
| **Sprint Retrospective** | Fin de cada sprint | Evaluación interna del equipo para mejorar el proceso |

## 6. Cronograma de Sprints

El proyecto inicia el 14 de julio de 2026 con una sesión de kickoff con el cliente, y concluye el 5 de septiembre de 2026 con la entrega en producción.

| Kickoff 14 jul | Sprint 1 (14–25 jul) | Sprint 2 (28 jul–8 ago) | Sprint 3 (11–22 ago) | Sprint 4 (25 ago–5 sep) | Entrega 5 sep | Soporte post-entrega |
|---|---|---|---|---|---|---|

---

### SPRINT 1
**Período:** 14 de julio – 25 de julio de 2026
**Objetivo:** Base del sistema: autenticación, catálogo de repuestos con búsqueda avanzada e inventario

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| Configuración del entorno (Supabase, Vercel, repositorio Git) | Alta | Pendiente |
| Módulo de autenticación: registro, login, cierre de sesión | Alta | Pendiente |
| Gestión de roles: administrador y vendedor | Alta | Pendiente |
| CRUD de categorías y líneas de repuestos | Alta | Pendiente |
| CRUD de productos: código, descripción, línea/marca, unidad de medida, precio, imagen | Alta | Pendiente |
| Gestión de códigos equivalentes por producto (múltiples códigos de distintos fabricantes) | Alta | Pendiente |
| Compatibilidad de repuesto con vehículos (marca y modelo) | Media | Pendiente |
| Búsqueda avanzada: por código, equivalente, descripción, marca, línea y vehículo | Alta | Pendiente |
| Vista de inventario con indicadores de stock por color (rojo/amarillo/verde) | Alta | Pendiente |
| Configuración del dominio y despliegue inicial en Vercel | Media | Pendiente |

**Entregable Sprint 1:** Sistema con login funcional, catálogo de repuestos con búsqueda avanzada por equivalentes y vehículo, e inventario con indicadores de stock. Desplegado en la URL del cliente.

---

### SPRINT 2
**Período:** 28 de julio – 8 de agosto de 2026
**Objetivo:** Módulo de compras: proveedores, órdenes de compra y control de stock

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| CRUD de proveedores (nombre, contacto, RUC, dirección) | Alta | Pendiente |
| Registro de órdenes de compra asociadas a proveedor | Alta | Pendiente |
| Recepción de mercadería: actualización automática de stock | Alta | Pendiente |
| Historial de compras por proveedor | Media | Pendiente |
| Alertas de stock mínimo (configuración por producto) | Alta | Pendiente |
| Registro de movimientos de inventario (entradas/salidas) | Alta | Pendiente |
| Pruebas de integración Sprint 1 + Sprint 2 | Media | Pendiente |

**Entregable Sprint 2:** Módulo de compras operativo. El administrador puede registrar proveedores, emitir órdenes de compra y el stock se actualiza automáticamente.

---

### SPRINT 3
**Período:** 11 de agosto – 22 de agosto de 2026
**Objetivo:** Proforma/Cotización, módulo de ventas, clientes y comprobantes

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| CRUD de clientes (nombre, CI/NIT, teléfono, dirección) | Alta | Pendiente |
| Módulo de Proforma: formulario con cliente, tipo de pago, plazo de validez, glosa | Alta | Pendiente |
| Agregar productos a proforma con búsqueda avanzada (código/equivalente/vehículo) | Alta | Pendiente |
| Cálculo de subtotal, descuentos y total en proforma | Alta | Pendiente |
| Generación de PDF de proforma imprimible (con NIT, fecha, datos del cliente) | Alta | Pendiente |
| Lista de proformas con filtro por fecha, cliente y estado | Media | Pendiente |
| Módulo de punto de venta (POS): búsqueda y selección de productos | Alta | Pendiente |
| Carrito de venta con cálculo de total y descuentos | Alta | Pendiente |
| Emisión de comprobante de venta en PDF | Alta | Pendiente |
| Conversión de proforma a venta directa | Media | Pendiente |
| Historial de compras por cliente | Media | Pendiente |
| Descuento automático de stock al registrar una venta | Alta | Pendiente |

**Entregable Sprint 3:** Módulo de Proforma y Ventas funcionales. El vendedor puede generar una cotización en PDF, convertirla a venta, registrar la transacción y descontar el stock automáticamente.

---

### SPRINT 4
**Período:** 25 de agosto – 5 de septiembre de 2026
**Objetivo:** Reportes, dashboard, pruebas finales y entrega en producción

| Historia de Usuario / Tarea | Prioridad | Estado |
|---|---|---|
| Dashboard principal: KPIs (ventas hoy, stock bajo, proformas pendientes, compras recientes) | Alta | Pendiente |
| Reporte de ventas por período (diario, semanal, mensual) | Alta | Pendiente |
| Reporte de proformas (emitidas, convertidas a venta, vencidas) | Media | Pendiente |
| Reporte de productos más vendidos | Media | Pendiente |
| Kardex: historial de movimientos por producto exportable a PDF y Excel | Alta | Pendiente |
| Reporte de estado de inventario (stock actual por categoría/línea) | Alta | Pendiente |
| Pruebas de usuario (UAT) con el cliente Rodrigo | Alta | Pendiente |
| Corrección de errores detectados en UAT | Alta | Pendiente |
| Despliegue final en producción y entrega de credenciales | Alta | Pendiente |
| Documentación básica de uso del sistema (manual de usuario) | Media | Pendiente |

**Entregable Sprint 4 / Entrega final:** Sistema completo en producción, con acceso entregado al cliente, dashboard funcional y manual de uso básico.

---

## 7. Hitos y Fechas Clave

| Hito | Fecha | Descripción |
|---|---|---|
| **Kickoff del proyecto** | 14 jul 2026 | Reunión inicial con el cliente, revisión de requisitos |
| **Firma de contrato / Pago 1** | 14 jul 2026 | 50% anticipo (Bs. 3,500) y firma del acuerdo |
| **Entrega Sprint 1** | 25 jul 2026 | Base del sistema en producción para revisión |
| **Entrega Sprint 2** | 8 ago 2026 | Módulo de compras y stock funcionando |
| **Entrega Sprint 3** | 22 ago 2026 | Módulo de ventas y clientes completo |
| **UAT con el cliente** | 26–29 ago 2026 | Pruebas con el cliente y correcciones finales |
| **Entrega final / Pago 2** | 5 sep 2026 | Sistema en producción + Bs. 3,500 (50% restante) |

## 8. Gestión de Riesgos

| Riesgo | Impacto | Plan de Mitigación |
|---|---|---|
| Cambios de alcance solicitados por el cliente | Alto | Documentar y cotizar cambios fuera del alcance original |
| Retrasos en entrega de información por el cliente | Medio | Establecer fechas límite de entrega de datos en el contrato |
| Problemas con servicios externos (Supabase, Vercel) | Bajo | Backup periódico y plan de contingencia documentado |
| Subestimación de tiempos en algún módulo | Medio | Priorización del backlog al inicio de cada sprint |

## 9. Herramientas del Proyecto

| Categoría | Herramienta | Uso |
|---|---|---|
| **Control de versiones** | GitHub | Repositorio del código fuente |
| **Gestión de tareas** | GitHub Projects / Trello | Tablero Scrum, backlog y sprints |
| **Comunicación** | WhatsApp / Meet | Coordinación del equipo y con el cliente |
| **Desarrollo frontend** | Next.js / React | Interfaz de usuario |
| **Base de datos** | Supabase Pro | BD, autenticación y almacenamiento |
| **Hosting** | Vercel | Despliegue y CI/CD automático |

## 10. Aprobación del Documento

Los firmantes declaran haber revisado y aprobado el presente Plan de Proyecto.

| Dynamic Coding — Representante | Cliente: Rodrigo |
|---|---|
| Fecha: ______________ | Fecha: ______________ |
