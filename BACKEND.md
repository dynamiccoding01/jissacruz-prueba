# BACKEND — Esquema de Base de Datos
## Sistema de Inventario, Compras y Ventas de Repuestos de Automóviles

**Motor:** PostgreSQL (Supabase)
**Versión:** 1.0
**Fecha:** Julio 2026

---

## 1. Diagrama de Relaciones (resumen textual)

```
perfiles ──< (creado_por) todas las tablas relevantes

productos ──< producto_codigos_equivalentes
productos ──< producto_vehiculos_compatibles
productos ──< kardex_movimientos
productos ──< orden_compra_items
productos ──< proforma_items
productos ──< venta_items

proveedores ──< ordenes_compra ──< orden_compra_items

clientes ──< proformas ──< proforma_items
clientes ──< ventas ──< venta_items

proformas ──(0..1)── ventas   (una venta puede originarse de una proforma)
```

## 2. Tablas

### 2.1 `perfiles`
Extiende `auth.users` de Supabase con rol y datos del usuario interno.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` |
| `nombre_completo` | `text` | not null |
| `rol` | `text` | `check (rol in ('admin','vendedor'))`, not null |
| `activo` | `boolean` | default `true` |
| `creado_en` | `timestamptz` | default `now()` |

### 2.2 `productos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `codigo` | `text` | unique, not null |
| `descripcion` | `text` | not null |
| `linea_marca` | `text` | |
| `unidad_medida` | `text` | default `'unidad'` |
| `precio` | `numeric(12,2)` | not null, default `0` |
| `imagen_url` | `text` | nullable |
| `stock_minimo` | `integer` | default `0` |
| `activo` | `boolean` | default `true` (soft delete) |
| `creado_por` | `uuid` | FK → `perfiles.id` |
| `creado_en` | `timestamptz` | default `now()` |
| `actualizado_en` | `timestamptz` | default `now()` |

> El **stock actual** no se guarda como columna fija; se calcula (o se mantiene sincronizado vía trigger) a partir de `kardex_movimientos`. Ver sección 4.

### 2.3 `producto_codigos_equivalentes`
Códigos de otros fabricantes para el mismo repuesto.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `producto_id` | `uuid` | FK → `productos.id`, `on delete cascade` |
| `codigo_equivalente` | `text` | not null |
| `fabricante` | `text` | nullable |

### 2.4 `vehiculos`
Catálogo normalizado de marca/modelo de vehículo, para evitar texto libre repetido e inconsistente en las compatibilidades (un mismo modelo aplica a decenas de productos).

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `marca` | `text` | not null |
| `modelo` | `text` | not null |
| | | `unique (marca, modelo)` |

### 2.4bis `producto_vehiculos_compatibles`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `producto_id` | `uuid` | FK → `productos.id`, `on delete cascade` |
| `vehiculo_id` | `uuid` | FK → `vehiculos.id` |
| `anio_desde` | `integer` | nullable — rango específico de esta compatibilidad, no del vehículo en general |
| `anio_hasta` | `integer` | nullable |

### 2.5 `proveedores`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `nombre` | `text` | not null |
| `contacto` | `text` | nullable |
| `nit` | `text` | nullable (Bolivia usa NIT, no RUC) |
| `direccion` | `text` | nullable |
| `activo` | `boolean` | default `true` |
| `creado_en` | `timestamptz` | default `now()` |

### 2.6 `ordenes_compra`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `proveedor_id` | `uuid` | FK → `proveedores.id` |
| `estado` | `text` | `check (estado in ('pendiente','recibida','cancelada'))`, default `'pendiente'` |
| `fecha_orden` | `timestamptz` | default `now()` |
| `fecha_recepcion` | `timestamptz` | nullable |
| `creado_por` | `uuid` | FK → `perfiles.id` |
| `notas` | `text` | nullable |

### 2.7 `orden_compra_items`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `orden_compra_id` | `uuid` | FK → `ordenes_compra.id`, `on delete cascade` |
| `producto_id` | `uuid` | FK → `productos.id` |
| `cantidad` | `integer` | not null, `check (cantidad > 0)` |
| `costo_unitario` | `numeric(12,2)` | not null |

### 2.8 `kardex_movimientos`
Registro histórico de todo movimiento de stock. Es la fuente de verdad para el stock actual y la valorización FIFO.

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `producto_id` | `uuid` | FK → `productos.id` |
| `tipo_movimiento` | `text` | `check (tipo_movimiento in ('entrada_compra','salida_venta','ajuste_entrada','ajuste_salida'))` |
| `cantidad` | `integer` | not null, siempre positivo (el signo lo da `tipo_movimiento`) |
| `costo_unitario` | `numeric(12,2)` | costo del lote (relevante en entradas; en salidas se registra el costo FIFO consumido) |
| `cantidad_restante_lote` | `integer` | usado solo en entradas, para el algoritmo FIFO (cuánto queda disponible de ese lote) |
| `referencia_tipo` | `text` | `check (referencia_tipo in ('orden_compra','venta','ajuste_manual'))` |
| `referencia_id` | `uuid` | id de la orden de compra, venta o ajuste que originó el movimiento |
| `motivo` | `text` | obligatorio si `tipo_movimiento` es ajuste |
| `creado_por` | `uuid` | FK → `perfiles.id` |
| `creado_en` | `timestamptz` | default `now()` |

**Cálculo de stock actual de un producto:**
```sql
SUM(cantidad) WHERE tipo_movimiento IN ('entrada_compra','ajuste_entrada')
  MINUS
SUM(cantidad) WHERE tipo_movimiento IN ('salida_venta','ajuste_salida')
```
(Implementado como vista `vista_stock_actual` o mantenido en una columna cacheada `productos.stock_actual` actualizada por trigger, según se decida en implementación — ver sección 5).

**Algoritmo FIFO (resumen):**
Al registrar una salida, se recorren las entradas del producto ordenadas por `creado_en ASC` con `cantidad_restante_lote > 0`, consumiendo cantidades hasta cubrir la salida y registrando el costo ponderado resultante en el movimiento de salida.

### 2.9 `clientes`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `nombre` | `text` | not null |
| `ci_nit` | `text` | nullable |
| `telefono` | `text` | nullable |
| `direccion` | `text` | nullable |
| `creado_en` | `timestamptz` | default `now()` |

### 2.10 `proformas`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `numero` | `text` | unique, generado automáticamente (`PRO-0001`) |
| `cliente_id` | `uuid` | FK → `clientes.id` |
| `tipo_pago` | `text` | nullable |
| `plazo_validez_dias` | `integer` | default `15` |
| `glosa` | `text` | nullable |
| `subtotal` | `numeric(12,2)` | not null |
| `descuento_tipo` | `text` | `check (descuento_tipo in ('porcentaje','monto_fijo', null))` |
| `descuento_valor` | `numeric(12,2)` | default `0` |
| `impuesto_porcentaje` | `numeric(5,2)` | default `0` |
| `total` | `numeric(12,2)` | not null |
| `estado` | `text` | `check (estado in ('vigente','convertida','vencida'))`, default `'vigente'` |
| `venta_id` | `uuid` | FK → `ventas.id`, nullable (se llena al convertir) |
| `creado_por` | `uuid` | FK → `perfiles.id` |
| `creado_en` | `timestamptz` | default `now()` |

### 2.11 `proforma_items`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `proforma_id` | `uuid` | FK → `proformas.id`, `on delete cascade` |
| `producto_id` | `uuid` | FK → `productos.id` |
| `cantidad` | `integer` | not null |
| `precio_unitario` | `numeric(12,2)` | not null |
| `descuento_tipo` | `text` | `check (descuento_tipo in ('porcentaje','monto_fijo', null))` |
| `descuento_valor` | `numeric(12,2)` | default `0` |
| `subtotal_linea` | `numeric(12,2)` | not null, calculado y validado por trigger `BEFORE INSERT/UPDATE` en servidor (no confía en el valor enviado por el cliente); rechaza descuento porcentual > 100% o que supere el importe de la línea |

### 2.12 `ventas`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `numero` | `text` | unique, generado automáticamente (`VEN-0001`) |
| `cliente_id` | `uuid` | FK → `clientes.id`, nullable (venta sin cliente registrado) |
| `proforma_origen_id` | `uuid` | FK → `proformas.id`, nullable |
| `subtotal` | `numeric(12,2)` | not null |
| `descuento_tipo` | `text` | `check (descuento_tipo in ('porcentaje','monto_fijo', null))` |
| `descuento_valor` | `numeric(12,2)` | default `0` |
| `impuesto_porcentaje` | `numeric(5,2)` | default `0` |
| `total` | `numeric(12,2)` | not null |
| `vendido_por` | `uuid` | FK → `perfiles.id` |
| `creado_en` | `timestamptz` | default `now()` |

### 2.13 `venta_items`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `uuid` | PK |
| `venta_id` | `uuid` | FK → `ventas.id`, `on delete cascade` |
| `producto_id` | `uuid` | FK → `productos.id` |
| `cantidad` | `integer` | not null |
| `precio_unitario` | `numeric(12,2)` | not null |
| `descuento_tipo` | `text` | `check (descuento_tipo in ('porcentaje','monto_fijo', null))` |
| `descuento_valor` | `numeric(12,2)` | default `0` |
| `costo_fifo_unitario` | `numeric(12,2)` | costo consumido según FIFO, para margen/reportes |
| `subtotal_linea` | `numeric(12,2)` | not null |

## 3. Numeración Correlativa

Se implementa con secuencias nativas de Postgres:

```sql
CREATE SEQUENCE proformas_numero_seq START 1;
CREATE SEQUENCE ventas_numero_seq START 1;
```

Y una función que formatea el número al insertar (vía trigger `BEFORE INSERT`):

```sql
-- ejemplo conceptual
numero := 'PRO-' || LPAD(nextval('proformas_numero_seq')::text, 4, '0');
```

Esto garantiza atomicidad y ausencia de duplicados bajo concurrencia (a diferencia de calcular `MAX(numero) + 1` en la aplicación).

## 4. Funciones Transaccionales (RPC)

Estas funciones se ejecutan como funciones de Postgres (`plpgsql`) e invocan vía `supabase.rpc()` desde Server Actions, garantizando atomicidad:

| Función | Qué hace |
|---|---|
| `fn_recibir_orden_compra(orden_id)` | Inserta movimientos `entrada_compra` en Kardex por cada ítem, actualiza `fecha_recepcion` y `estado` de la orden |
| `fn_registrar_venta(payload_json)` | Genera número correlativo, inserta venta + ítems, consume stock por FIFO, inserta movimientos `salida_venta` en Kardex |
| `fn_convertir_proforma_a_venta(proforma_id)` | Llama internamente a `fn_registrar_venta` con los datos de la proforma, actualiza `proformas.estado = 'convertida'` y `proformas.venta_id` |
| `fn_ajuste_stock(producto_id, cantidad, tipo, motivo)` | Inserta movimiento de ajuste en Kardex (requiere rol admin) |

## 5. Row Level Security (RLS) — Lineamientos

- RLS **activo en todas las tablas** desde el primer sprint.
- Política base: solo usuarios autenticados (`auth.role() = 'authenticated'`) pueden leer.
- Política de escritura diferenciada por rol, ejemplo conceptual:

```sql
-- Solo admin puede eliminar/desactivar productos
CREATE POLICY "admin_delete_productos" ON productos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
  );

-- Admin y vendedor pueden insertar ventas
CREATE POLICY "admin_vendedor_insert_ventas" ON ventas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol IN ('admin','vendedor')
    )
  );

-- Solo admin accede a reportes/tablas de compras
CREATE POLICY "admin_only_compras" ON ordenes_compra
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
  );
```

## 6. Storage (Supabase)

| Bucket | Contenido | Acceso |
|---|---|---|
| `productos-imagenes` | Imágenes de productos | Lectura pública, escritura solo autenticados con rol admin |
| `logo-empresa` | Logo usado en PDFs | Lectura pública, escritura solo admin |

## 7. Índices Recomendados

```sql
CREATE INDEX idx_productos_codigo ON productos (codigo);
CREATE INDEX idx_productos_descripcion ON productos USING gin (to_tsvector('spanish', descripcion));
CREATE INDEX idx_codigos_equivalentes_codigo ON producto_codigos_equivalentes (codigo_equivalente);
-- vehiculos(marca, modelo) ya queda indexado por su UNIQUE constraint
CREATE INDEX idx_pvc_vehiculo ON producto_vehiculos_compatibles (vehiculo_id);
CREATE INDEX idx_kardex_producto_fecha ON kardex_movimientos (producto_id, creado_en);
CREATE INDEX idx_ventas_numero ON ventas (numero);
CREATE INDEX idx_proformas_numero ON proformas (numero);
CREATE INDEX idx_proformas_estado ON proformas (estado);
```
