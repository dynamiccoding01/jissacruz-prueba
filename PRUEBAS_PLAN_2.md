# PRUEBAS_PLAN_2.md — Pruebas de fuego (UAT) del PLAN_2

> Checklist para verificar a mano que cada tarea del [PLAN_2.md](PLAN_2.md) quedó funcionando.
> Hacerlo en `localhost:3000` (dev) con la base al día (scripts 35→38 corridos).
> Si todos los ✅ de una tarea se cumplen, esa tarea está OK.

## ✅ Tareas terminadas (probar estas)

### T1 — Unidades Kilo/Litro
- [ ] Productos → editar cualquiera → abrir el selector **"Unidad"** → aparecen **Kilogramo (KG)** y **Litro (LT)**.

### T3 — Historial de ventas movido a Reportes
- [ ] En **Ventas (POS)**: abajo **ya NO** está el "Historial de ventas".
- [ ] En **Reportes**: al final aparece **"Historial de ventas"** con las ventas y un botón para descargar el PDF de cada una.

### T5 — Renombres en Clientes
- [ ] Clientes → Nuevo cliente → el primer campo dice **"Razón social"** y el otro dice **"Contacto"**.
- [ ] En la tabla de clientes, la columna dice **"Razón social"**.

### T6 — Con/Sin factura (S/F) en producto
- [ ] Productos → editar uno → **destildar** "Se vende con factura" → Guardar.
- [ ] Ese producto muestra el badge amarillo **"S/F"** al lado del código (en el listado).
- [ ] El mismo producto en **Ventas (POS)** y en **Cotización** también muestra **"S/F"**.

### T7 — Estadística de ventas Sin factura
- [ ] Hacer 2 ventas: una normal y otra marcando **"Sin factura"** en el selector del carrito.
- [ ] Reportes → **Ventas por período** → arriba se ven los KPIs **"Con factura"** y **"Sin factura (S/F)"** con montos separados.

### T8 — Tipo de pago como selector
- [ ] Proformas → Nueva proforma → **"Tipo de pago"** es un **selector** (Efectivo, QR, Transferencia, Tarjeta, Crédito).
- [ ] Ventas (POS) → carrito → hay un selector **"Tipo de pago"**.
- [ ] Hacer una venta eligiendo un tipo de pago → abrir el **PDF de la factura** → dice **"Tipo de pago: …"**.

### T10 — S/F en Cotización
- [ ] Cotización → buscar el producto marcado S/F → su tarjeta muestra el badge **"S/F"**.

### T12 — Rol Cajero
- [ ] Como admin: Configuración → Usuarios → **Nuevo usuario** → Rol **"Cajero"** + asignar **sucursal** → crear.
- [ ] Entrar con ese **cajero** → en el menú ve **solo**: Productos, Inventario, Clientes, Cotización y **Ventas (POS)** (no ve Dashboard, Compras, Proformas ni Reportes).
- [ ] Con el cajero, hacer una **venta** en el POS → se registra bien.
- [ ] (Si hay un **vendedor**) → **ya NO** ve "Ventas (POS)"; si escribe `/ventas` en la URL, lo manda a Proformas.

## 🔥 Prueba general (que nada se rompió)
- [ ] Hacer **una venta completa** con 2 productos → se genera la factura PDF y el **stock baja** (verificar en Inventario/Kardex).
- [ ] Crear **una proforma** y convertirla a venta → funciona igual que antes.

## ⏳ Tareas pendientes (todavía NO hay nada que probar)
**T2, T4, T9, T11** — sin implementar; esperan los ejemplos/confirmación del cliente.
