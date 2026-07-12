# FLUJO — Flujo del Sistema
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Versión:** 1.0
**Fecha:** Julio 2026

---

## 1. Flujo General de Acceso

```
[Usuario recibe invitación por email del Admin]
                │
                ▼
     [Configura contraseña / accede]
                │
                ▼
            [Login]
                │
        ┌───────┴────────┐
        ▼                ▼
     Rol: Admin      Rol: Vendedor
        │                │
        ▼                ▼
   [Dashboard]      [Ventas / POS]
   (vista completa)  (vista operativa)
```

## 2. Flujo: Alta de Producto (Admin)

1. Admin entra a **Productos** → clic en "Nuevo producto".
2. Completa datos generales: código, descripción, línea/marca, unidad de medida, precio, imagen.
3. Agrega (opcional) uno o más **códigos equivalentes** de otros fabricantes.
4. Agrega (opcional) una o más **compatibilidades de vehículo** (marca/modelo).
5. Define **stock mínimo** para alertas.
6. Guarda → el producto queda visible en el catálogo con stock inicial en 0 (rojo) hasta que ingrese por compra.

## 3. Flujo: Compra a Proveedor → Actualización de Stock

```
[Admin registra Proveedor]
        │
        ▼
[Admin crea Orden de Compra]
   (selecciona proveedor + productos + cantidades + costo)
        │
        ▼
[Mercadería llega físicamente a la tienda]
        │
        ▼
[Admin marca "Recibir mercadería" en la orden]
        │
        ▼
[Sistema ejecuta función transaccional]
   - Inserta lote de entrada en Kardex (cantidad + costo + fecha)
   - Actualiza stock actual del producto
   - Recalcula indicador de color si corresponde
        │
        ▼
[Producto queda disponible para venta/proforma]
```

**Regla clave:** el stock **nunca se edita directamente** desde el catálogo; solo cambia por: recepción de compra, venta, conversión de proforma a venta, o ajuste manual justificado (Admin).

## 4. Flujo: Búsqueda Avanzada de Producto

Usado en: Catálogo, Proformas, POS.

```
[Usuario escribe en el buscador]
        │
        ▼
[Sistema busca coincidencias en paralelo sobre:]
   - Código de parte
   - Descripción
   - Códigos equivalentes
   - Marca / línea
   - Vehículo compatible (marca/modelo)
        │
        ▼
[Resultados combinados, ordenados por relevancia]
        │
        ▼
[Usuario selecciona producto → se agrega a la proforma/carrito
 o se abre el detalle en el catálogo]
```

## 5. Flujo: Proforma → Conversión a Venta

```
[Vendedor/Admin crea nueva Proforma]
        │
        ▼
[Selecciona o crea Cliente]
        │
        ▼
[Define tipo de pago, plazo de validez, glosa]
        │
        ▼
[Agrega productos vía búsqueda avanzada]
   - Define cantidad y descuento (% o Bs) por línea
        │
        ▼
[Sistema calcula subtotal, descuento total, impuesto (si aplica), total]
        │
        ▼
[Guarda proforma → numeración automática PRO-000X]
        │
        ▼
[Genera PDF imprimible para entregar/enviar al cliente]
        │
        ├──► [Cliente acepta] ──► [Convertir a venta]
        │                              │
        │                              ▼
        │                  [Sistema crea Venta ligada a la proforma]
        │                  - Copia cliente, ítems, descuentos
        │                  - Genera número VEN-000X
        │                  - Descuenta stock (FIFO) y registra Kardex
        │                  - Marca proforma como "Convertida"
        │
        └──► [Cliente no responde / vence plazo] ──► [Estado: "Vencida"]
```

## 6. Flujo: Venta Directa (Punto de Venta - POS)

```
[Vendedor abre módulo Ventas/POS]
        │
        ▼
[Busca producto(s) con buscador avanzado]
        │
        ▼
[Agrega al carrito: cantidad, precio, descuento opcional]
        │
        ▼
[(Opcional) Asocia un Cliente existente o registra uno rápido]
        │
        ▼
[Revisa totales: subtotal, descuento, impuesto (si aplica), total]
        │
        ▼
[Confirma venta]
        │
        ▼
[Sistema ejecuta función transaccional]
   - Genera número correlativo VEN-000X
   - Inserta venta + ítems
   - Descuenta stock por método FIFO (consume lotes más antiguos primero)
   - Inserta movimientos de salida en Kardex
        │
        ▼
[Genera comprobante de venta en PDF]
        │
        ▼
[Venta queda registrada en historial del cliente y en reportes]
```

## 7. Flujo: Alertas de Stock

```
[Cada movimiento de salida de stock (venta o ajuste)]
        │
        ▼
[Sistema recalcula stock actual del producto]
        │
        ▼
   ┌────────────┬─────────────────┬──────────────┐
   │ stock = 0  │ stock ≤ mínimo  │ stock > mínimo│
   ▼            ▼                 ▼
 🔴 Rojo      🟡 Amarillo        🟢 Verde
   │
   ▼
[Aparece en listado de "Stock crítico" del Dashboard]
```

## 8. Flujo: Reportes y Exportación

```
[Admin entra a Reportes]
        │
        ▼
[Selecciona tipo de reporte + filtros (fecha, categoría, etc.)]
        │
        ▼
[Sistema consulta datos vía Server Action]
        │
        ▼
[Muestra tabla + gráfico en pantalla]
        │
   ┌────┴─────┐
   ▼          ▼
[Exportar PDF]  [Exportar Excel]
   │                  │
   ▼                  ▼
[Route Handler   [SheetJS genera
 genera PDF con   archivo .xlsx
 react-pdf]        en el navegador]
```

## 9. Flujo: Gestión de Usuarios (Configuración, solo Admin)

```
[Admin va a Configuración → Usuarios]
        │
        ▼
[Invita nuevo usuario por email + asigna rol (admin/vendedor)]
        │
        ▼
[Supabase Auth envía invitación]
        │
        ▼
[Usuario define su contraseña y accede]
        │
        ▼
[Admin puede desactivar usuarios en cualquier momento]
   (desactivar ≠ eliminar: se conserva historial de acciones)
```

## 10. Mapa de Recorrido por Rol

| Acción | Administrador | Vendedor |
|---|---|---|
| Ver Dashboard con KPIs | ✅ | ❌ |
| Crear/editar productos | ✅ | ❌ (solo consulta) |
| Ver inventario / Kardex | ✅ | 👁️ solo lectura |
| Ajustar stock manualmente | ✅ | ❌ |
| Gestionar proveedores y compras | ✅ | ❌ |
| Crear proformas | ✅ | ✅ |
| Convertir proforma a venta | ✅ | ✅ |
| Operar POS (ventas) | ✅ | ✅ |
| Gestionar clientes | ✅ | ✅ |
| Ver reportes | ✅ | ❌ |
| Configurar sistema / usuarios | ✅ | ❌ |
