# BACKEND — Esquema de Base de Datos

## Sistema de Inventario, Compras y Ventas de Repuestos (SISREP · JISSACRUZ)

**Motor:** PostgreSQL (Supabase)
**Versión:** 2.0 — **reescrito el 29 jul 2026 leyendo el esquema real de la base** (`information_schema`, `pg_proc`, `pg_constraint`, `pg_policies`), no el diseño original.
**Cubre hasta:** script `32_precio_venta_en_compra.sql`

> **Cómo usar este documento.** Antes era un documento de *diseño* (lo que se pensaba construir) y quedó desfasado del Sprint 5 en adelante. Ahora describe **lo que realmente existe en la base**. Aun así, la referencia operativa sigue siendo **[supabase/README.md](supabase/README.md)**: ahí está el orden de ejecución de los scripts, qué se corrió y cuándo. Si los dos difieren, gana `supabase/README.md`.
>
> ⚠️ **Regla que este proyecto aprendió a la mala:** antes de reescribir cualquier función, confirmá qué está corriendo de verdad con `select prosrc from pg_proc where proname = '...'`. Hubo un caso real de una función pisada en la base mientras el repo declaraba otra versión.

---

## 1. Diagrama de relaciones

```
auth.users ──1:1── perfiles ──> sucursales        (sucursal asignada al usuario)

sucursales ──< producto_stock_sucursal >── productos     (stock por par producto × sucursal)
sucursales ──< kardex_movimientos
sucursales ──< ventas · proformas · ordenes_compra
sucursales ──< pedidos_traspaso  (como origen Y como destino)

unidades_medida ──< productos                     (FK opcional; sin conversión)

productos ──< producto_codigos_originales         (OEM del fabricante, N)
productos ──< producto_codigos_equivalentes       (de otro fabricante, N)
productos ──< producto_medidas                    (A: 45,40MM · B: 17,00MM)
productos ──< producto_precios_mayor              (escalas por cantidad, con vigencia)
productos ──< producto_vehiculos_compatibles >── vehiculos
productos ──< kardex_movimientos
productos ──< orden_compra_items · proforma_items · venta_items · pedido_traspaso_items

proveedores ──< ordenes_compra ──< orden_compra_items
clientes ──< proformas ──< proforma_items
clientes ──< ventas ──< venta_items
proformas ──(0..1)── ventas                       (una venta puede nacer de una proforma)
pedidos_traspaso ──< pedido_traspaso_items

configuracion_empresa                             (fila única, id smallint)
vista_proformas                                   (vista sobre proformas + estado_efectivo)
```

---

## 2. Los tres conceptos que hay que entender antes de tocar nada

### 2.1 El kardex es la fuente de verdad; el stock son caches

`kardex_movimientos` registra **todo** movimiento. El stock **no se deriva con una consulta en tiempo real**: se mantiene en dos columnas cacheadas, ambas por trigger.

| Cache | Alcance | Mantenido por |
|---|---|---|
| `producto_stock_sucursal.stock_actual` | por (producto × sucursal) — **el que importa** | trigger `fn_kardex_aplica_stock` en cada insert al kardex |
| `productos.stock_actual` | total del producto (todas las sucursales) | el mismo trigger |

`productos.stock_actual` es un **total repetido** que se decidió **conservar** (Sprint 5 · C2 paso 4 parte A): el trigger lo mantiene correcto y eliminarlo es alto riesgo / bajo valor. Un segundo trigger (`fn_productos_before_update`) **bloquea cualquier `UPDATE` directo** que intente modificarlo.

**Nunca actualizar stock desde la aplicación.** Toda operación que mueva stock pasa por una RPC `security definer` (sección 5).

### 2.2 FIFO por sucursal

`fn_fifo_consumir(producto_id, sucursal_id, cantidad)` recorre los lotes de entrada **de esa sucursal** con `cantidad_restante_lote > 0`, ordenados por `creado_en` y **desempatados por `consecutivo`** (columna identity — sin ella, dos lotes creados en el mismo instante consumían en orden indeterminado).

Tipos de lote que el FIFO consume: `entrada_compra`, `ajuste_entrada` y **`entrada_traspaso`**. Este último se agregó en el script `21` y fue un bug crítico real: el stock recibido por traspaso figuraba como disponible pero **no se podía vender**, porque el FIFO no encontraba lotes.

### 2.3 Unidades de medida: sin conversión

Un producto se vende **solo** en su unidad. No hay factor de conversión, y **el kardex y el FIFO no miran la unidad para nada**. Es un atributo de presentación. Decisión explícita del cliente — no reintroducir conversión.

---

## 3. Tablas

Convención: todas las PK son `uuid` con `default gen_random_uuid()` salvo donde se indique; `creado_en` es `timestamptz not null default now()`.

### 3.1 `perfiles`
Extiende `auth.users`. La fila la crea el trigger `on_auth_user_created` → `fn_crear_perfil_nuevo_usuario()`, leyendo `user_metadata`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` |
| `nombre_completo` | `text` | not null |
| `rol` | `text` | not null, `check in ('admin','vendedor')` |
| `activo` | `boolean` | not null, default `true` |
| `sucursal_id` | `uuid` | FK → `sucursales.id`, **not null** (desde el script `31`) |
| `creado_en` | `timestamptz` | not null |

> **`sucursal_id` es obligatoria desde el script `31`**, y no por prolijidad: con la RLS del script `30`, un perfil sin sucursal **dejaba de ver ventas, proformas y pedidos sin ningún mensaje de error** (ver 6.3). El trigger de alta resuelve una sucursal por defecto si el `user_metadata` no trae una, y si no hay ninguna activa falla con un mensaje claro.

### 3.2 `sucursales`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `codigo` | `text` | not null, unique |
| `nombre` | `text` | not null |
| `direccion` · `telefono` | `text` | nullable |
| `activo` | `boolean` | not null, default `true` |

### 3.3 `unidades_medida`
Catálogo administrable desde `/unidades-medida` (solo admin). **Se creó vacío** por decisión del cliente.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `codigo` | `text` | not null, unique (`PZA`, `DOC`, `JGO`…) |
| `nombre` | `text` | not null (`Pieza`, `Docena`) |
| `abreviatura` | `text` | nullable |
| `activo` | `boolean` | not null, default `true` |

### 3.4 `productos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `codigo` | `text` | not null, unique — **el código de la tienda** |
| `descripcion` | `text` | not null |
| `linea_marca` | `text` | nullable — **texto libre, no hay tabla de líneas/categorías** |
| `unidad_medida` | `text` | not null, default `'unidad'` — columna de texto **histórica** |
| `unidad_medida_id` | `uuid` | FK → `unidades_medida.id`, nullable — **la nueva** |
| `precio` | `numeric(12,2)` | not null, default `0` — precio de **venta**; ver nota abajo |
| `stock_minimo` | `integer` | not null, default `0` |
| `stock_actual` | `integer` | not null — **cache por trigger**, ver 2.1 |
| `imagen_url` | `text` | nullable |
| `activo` | `boolean` | not null, default `true` (soft delete) |
| `creado_por` | `uuid` | FK → `perfiles.id` |
| `creado_en` · `actualizado_en` | `timestamptz` | `actualizado_en` por trigger `fn_touch_actualizado_en` |

> **`productos` no tiene columna de costo.** El costo vive solo en los lotes del kardex (`kardex_movimientos.costo_unitario` de las entradas de compra). El "último costo" que muestran la orden de compra y la ficha del producto se deriva de ahí ([lib/costos-server.ts](lib/costos-server.ts)).
>
> **`precio` se actualiza al RECIBIR una orden de compra** que traiga `precio_venta` (script `32`, ver 3.11). Fuera de eso se edita a mano en la ficha, donde la Server Action **rechaza guardar si el precio no supera el último costo de compra**.

> **Transición pendiente:** `unidad_medida` (texto) y `unidad_medida_id` (FK) **conviven**. La UI lee `id ?? texto`. Al 29 jul los 239 productos tienen `unidad_medida_id` en null. La columna de texto se elimina recién cuando el catálogo esté cargado y asignado.

### 3.5 `producto_stock_sucursal`

| Columna | Tipo | Notas |
|---|---|---|
| `producto_id` | `uuid` | PK compuesta, FK → `productos.id` |
| `sucursal_id` | `uuid` | PK compuesta, FK → `sucursales.id` |
| `stock_actual` | `integer` | not null — **cache por trigger** |

### 3.6 Los tres niveles de código

`productos.codigo` es el de la tienda. Además:

**`producto_codigos_originales`** — códigos **OEM del fabricante**, N por producto.

| Columna | Tipo | Notas |
|---|---|---|
| `producto_id` | `uuid` | FK, `on delete cascade` |
| `codigo_original` | `text` | not null |
| — | — | `unique (producto_id, codigo_original)`; índice en `codigo_original` |

**`producto_codigos_equivalentes`** — códigos del **mismo repuesto en otro fabricante**, N por producto. Mismas columnas con `codigo_equivalente`, mismo unique.

> **Ninguna de las dos guarda `fabricante`** — la columna se eliminó en el script `22` (decisión del cliente). Ese mismo script migró **810 filas** que estaban en equivalentes con `fabricante = 'OEM'` (mal clasificadas) a la tabla de originales.

### 3.7 `producto_medidas`
Un producto puede tener varias medidas: `A: 45,40MM  B: 17,00MM`.

| Columna | Tipo | Notas |
|---|---|---|
| `producto_id` | `uuid` | FK, `on delete cascade` |
| `etiqueta` | `text` | not null — la letra o nombre (`A`, `B`, `DIÁMETRO`) la escribe el usuario |
| `valor` | `numeric(12,2)` | not null, `check (valor > 0)` |
| `unidad` | `text` | not null, default `'MM'` |
| `orden` | `smallint` | not null, default `0` — para renderizar A antes que B |

El formateo de presentación está centralizado en [lib/medidas.ts](lib/medidas.ts) — no duplicarlo por pantalla.

### 3.8 `producto_precios_mayor`
Escalas de precio por cantidad mínima, con vigencia opcional.

| Columna | Tipo | Notas |
|---|---|---|
| `producto_id` | `uuid` | FK, `on delete cascade` |
| `cantidad_minima` | `integer` | not null |
| `precio` | `numeric(12,2)` | not null |
| `vigente_hasta` | `date` | nullable (sin fecha = sin vencimiento) |
| — | — | `unique (producto_id, cantidad_minima)` |

### 3.9 `vehiculos` y `producto_vehiculos_compatibles`

`vehiculos`: `marca` + `modelo`, ambos not null, con `unique (marca, modelo)`.
`producto_vehiculos_compatibles`: `producto_id` + `vehiculo_id` + `anio_desde` / `anio_hasta` (nullable).

### 3.10 `kardex_movimientos`
Registro histórico de **todo** movimiento de stock.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `consecutivo` | `bigint` | **identity** — desempate del FIFO |
| `producto_id` | `uuid` | FK, not null |
| `sucursal_id` | `uuid` | FK, **not null** |
| `tipo_movimiento` | `text` | not null, `check in ('entrada_compra','salida_venta','ajuste_entrada','ajuste_salida','salida_traspaso','entrada_traspaso')` |
| `cantidad` | `integer` | not null, `check (cantidad > 0)` — **siempre positivo**, el signo lo da el tipo |
| `costo_unitario` | `numeric(12,2)` | not null — costo del lote en entradas; costo FIFO consumido en salidas |
| `cantidad_restante_lote` | `integer` | nullable — solo en entradas, para el FIFO |
| `referencia_tipo` | `text` | not null, `check in ('orden_compra','venta','ajuste_manual','traspaso')` |
| `referencia_id` | `uuid` | id del documento que originó el movimiento |
| `motivo` | `text` | `check`: **obligatorio** si el tipo es `ajuste_entrada` / `ajuste_salida` |
| `creado_por` | `uuid` | FK → `perfiles.id` |

### 3.11 `proveedores`, `ordenes_compra`, `orden_compra_items`

`proveedores`: `nombre` (not null), `contacto`, `nit`, `direccion`, `activo`.

`ordenes_compra`: `proveedor_id` (not null), `estado` (`check in ('pendiente','recibida','cancelada')`), `fecha_orden`, `fecha_recepcion`, `sucursal_id` (**destino de la recepción**), `creado_por`, `notas`.

`orden_compra_items`: `orden_compra_id`, `producto_id`, `cantidad`, `costo_unitario` y **`precio_venta`** (nullable).

> **`precio_venta` es la regla de precios del negocio, hecha cumplir por la base** (script `32`): `check (precio_venta is null or precio_venta > costo_unitario)`. El precio de venta se define **al armar la orden de compra**, no en la ficha del producto, y **no puede quedar por debajo del costo**. Nació de un caso real: se compraba a Bs 800 lo que se vendía a Bs 324, y nada avisaba.
>
> Es **nullable** solo por las órdenes anteriores al script 32; a esas no se les toca el precio al recibirlas (sin efecto retroactivo).

### 3.12 `clientes`

| Columna | Tipo | Notas |
|---|---|---|
| `nombre` | `text` | not null |
| `ci_nit` · `telefono` · `direccion` | `text` | nullable |
| `nombre_factura` · `complemento` | `text` | nullable — datos de facturación (script `11`) |

### 3.13 `proformas`

| Columna | Tipo | Notas |
|---|---|---|
| `numero` | `text` | not null, unique — `PRO-0001` por secuencia + trigger |
| `cliente_id` | `uuid` | FK, not null |
| `sucursal_id` | `uuid` | FK |
| `tipo_pago` · `glosa` | `text` | nullable |
| `plazo_validez_dias` | `integer` | not null, **default `3`** (era 15 hasta el script `27`) |
| `tiempo_entrega_dias` | `integer` | nullable, `check (>= 0)` — leyenda del PDF |
| `subtotal` · `total` | `numeric(12,2)` | not null |
| `descuento_tipo` | `text` | nullable, `check in ('porcentaje','monto_fijo')` |
| `descuento_valor` | `numeric(12,2)` | not null, default `0` |
| `impuesto_porcentaje` | `numeric(5,2)` | not null, default `0` — **campo manual, no hay IVA automático** |
| `estado` | `text` | not null, `check in ('vigente','convertida','vencida')` |
| `revalidada_en` | `timestamptz` | nullable — reinicia el plazo al revisar precios |
| `venta_id` | `uuid` | FK → `ventas.id`, se llena al convertir |
| `creado_por` | `uuid` | FK → `perfiles.id` |

> **El descuento por porcentaje salió de la UI** (Sprint 6 · F4) pero **el `check` de la base lo sigue aceptando a propósito**: hay 12 registros históricos con `'porcentaje'` y endurecer la restricción haría fallar el `alter`. La rama `'porcentaje'` de `fn_registrar_venta` también se conserva.

### 3.14 `vista_proformas` — el estado real de una proforma

La columna `proformas.estado` **solo distingue `vigente` / `convertida`**. El vencimiento **no se persiste**: se deriva en esta vista (`security_invoker = true`, o sea que respeta la RLS de quien consulta).

```sql
case
  when estado = 'convertida' then 'convertida'
  -- tope duro: 3 meses desde la creación. Se evalúa PRIMERO: gana sobre todo.
  when creado_en + interval '3 months' < now() then 'vencida'
  when coalesce(revalidada_en, creado_en)
       + make_interval(days => plazo_validez_dias) >= now() then 'vigente'
  else 'pendiente'
end as estado_efectivo
```

| Estado efectivo | Significado | ¿Convertible? |
|---|---|---|
| `vigente` | dentro del plazo desde la creación o la última revalidación | ✅ |
| `pendiente` | pasó el plazo corto (3 días) pero no los 3 meses — hay que revisar precios | ❌ |
| `vencida` | más de 3 meses desde la creación | ❌ solo lectura |
| `convertida` | ya se convirtió en venta | ❌ |

**`revalidada_en` es lo que hace posible el ciclo.** Sin esa columna, una proforma vencida no podría volver a convertirse nunca: el vencimiento se mide desde `creado_en`, que no cambia al editar, así que quedaba trabada para siempre.

> Al agregar columnas a `proformas` hay que **dropear y recrear** la vista, no `create or replace`: `p.*` cambia la posición de `estado_efectivo` y `replace` no admite cambios de tipo de retorno.

### 3.15 `proforma_items`

`proforma_id` (cascade), `producto_id`, `cantidad` (`> 0`), `precio_unitario`, `descuento_tipo` / `descuento_valor`, `subtotal_linea`.

> **`subtotal_linea` lo recalcula el trigger `fn_proforma_items_validar` en cada insert/update** — no confía en el valor que manda el cliente, y valida los límites de descuento. **Las proformas no pasan por RPC** (no tocan stock), así que **ese trigger es su única red de integridad**, a diferencia de las ventas, donde ese trabajo lo hace `fn_registrar_venta`.

### 3.16 `ventas` y `venta_items`

`ventas`: `numero` (`VEN-0001`), `cliente_id` (**nullable** — venta sin cliente registrado), `proforma_origen_id` (nullable), `sucursal_id`, `subtotal` / `descuento_*` / `impuesto_porcentaje` / `total`, `vendido_por`.

`venta_items`: además de lo esperable, guarda **`costo_fifo_unitario`** — el costo realmente consumido, para calcular margen en los reportes.

### 3.17 `pedidos_traspaso` y `pedido_traspaso_items`
El módulo se llama **"Pedido"** en la interfaz.

| Columna | Tipo | Notas |
|---|---|---|
| `numero` | `text` | not null, unique — `PED-XXXXXX` |
| `sucursal_origen_id` | `uuid` | not null — **de dónde sale el stock** |
| `sucursal_destino_id` | `uuid` | not null — quién lo pide y lo recibe |
| `estado` | `text` | `check in ('pendiente','enviado','recibido','cancelado')` |
| `fecha_envio` · `fecha_recepcion` | `timestamptz` | nullable |
| — | — | `check (sucursal_origen_id <> sucursal_destino_id)` |

**Ítems:** `cantidad_solicitada` (not null, `> 0`) es lo que **pidió** el destino; `cantidad` (`>= 0`) es lo que el origen **realmente despacha** — puede recortarlo, y **0 significa "no mando este ítem"**. Así el solicitante ve *"pedí 80, me mandaron 50"*.

> **El flujo se invirtió en el script `28`:** ahora el pedido lo crea **la sucursal que necesita el producto** (destino) y elige a quién se lo pide. Las columnas **no cambiaron de significado**, así que los pedidos históricos siguen siendo válidos sin migración.

### 3.18 `configuracion_empresa`
**Fila única** (`id smallint`): `nombre` (not null), `nit`, `direccion`, `telefono`, `logo_url`, `stock_minimo_default`, `actualizado_en`.

---

## 4. Numeración correlativa

Secuencias nativas de Postgres + trigger `BEFORE INSERT` (`02_secuencias_triggers.sql`):

```sql
numero := 'PRO-' || lpad(nextval('proformas_numero_seq')::text, 4, '0');
```

Aplica a `PRO-` (proformas), `VEN-` (ventas) y `PED-` (pedidos de traspaso). Garantiza atomicidad bajo concurrencia, a diferencia de calcular `max(numero) + 1` en la aplicación. **Nunca calcular el siguiente número en la app.**

---

## 5. Funciones (`pg_proc`, esquema `public`)

### 5.1 RPC de movimiento de stock — `security definer`

Se invocan con `supabase.rpc()` desde Server Actions. **Toda operación que mueva stock pasa por acá.**

| Función | Qué hace |
|---|---|
| `fn_recibir_orden_compra(p_orden_id)` | Inserta `entrada_compra` por cada ítem en la **sucursal destino de la orden**, **aplica `precio_venta` a `productos.precio`** y marca la orden recibida |
| `fn_registrar_venta(p_venta jsonb)` | Venta + ítems + consumo FIFO + `salida_venta`. Recalcula totales en el servidor |
| `fn_convertir_proforma_a_venta(p_proforma_id)` | Valida vigencia, llama a `fn_registrar_venta` y marca la proforma como convertida |
| `fn_ajuste_stock(p_producto_id, p_cantidad, p_tipo, p_motivo, p_costo_unitario, p_sucursal_id)` | Movimiento de ajuste (requiere admin) |
| `fn_crear_pedido_traspaso(p_sucursal_origen_id, p_items, p_notas, p_sucursal_destino_id)` | Crea el pedido; destino por defecto = `fn_mi_sucursal()` |
| `fn_enviar_traspaso(p_pedido_id, p_items)` | El origen ajusta cantidades y despacha **en un solo paso**; consume FIFO y saltea los ítems en 0 |
| `fn_recibir_traspaso(p_pedido_id)` | Entra como lote FIFO en el destino, **con el costo del origen** |
| `fn_cancelar_traspaso(p_pedido_id)` | Solo en estado `pendiente`, solo el creador o un admin |
| `fn_fifo_consumir(p_producto_id, p_sucursal_id, p_cantidad)` | Motor FIFO; devuelve el costo unitario ponderado |
| `fn_guardar_producto(p_id, p_producto, p_equivalentes, p_originales, p_vehiculos, p_precios_mayor, p_medidas)` | **Crear y editar producto**: cabecera + reemplazo de **todos** los hijos en una sola transacción |

> **Sobre `fn_guardar_producto`:** existe porque el patrón anterior (`delete` de los hijos + `insert`, en llamadas HTTP sueltas desde la Server Action) **no era transaccional** — si el insert fallaba, el producto quedaba sin sus códigos, vehículos ni precios. **No volver a ese patrón.** Incluye la guarda **R1**: no se puede cambiar la unidad de un producto que ya tiene movimientos de kardex.
>
> ⚠️ Su firma **creció de 5 a 7 argumentos** a lo largo de los scripts 29 → 22 → 23 → 24, y cada paso **dropea la versión anterior**. Si quedaran dos overloads convivendo, PostgREST no podría elegir candidato y las llamadas fallarían. Al extenderla, mantener el `drop function` de la firma vieja.

### 5.2 Búsqueda

**`fn_buscar_productos(p_query text, p_campos text[]) returns setof productos`** — una sola función reutilizada por catálogo, compras, POS y proformas. **No reimplementar el filtro en el cliente.**

- Parte la consulta en tokens por espacios y `%`; un producto entra si **todos** los tokens matchean **en algún campo habilitado** (lógica *cross-field*).
- Criterios válidos: `codigo`, `descripcion`, `linea_marca`, `equivalente`, **`original`**, `vehiculo`, **`medida`**. Arreglo vacío o null ⇒ busca en **todos** (los siete están en el arreglo por defecto).
- **Ignora acentos**: envuelve campo y token con `extensions.unaccent(...)`. Buscar `valvula` encuentra `VÁLVULA` — sin esto devolvía 1 producto de 113.
- Usa **`EXISTS`** para las tablas hijas, sin `LEFT JOIN` ni `DISTINCT` (no multiplica filas).
- En `medida` normaliza la coma decimal del usuario (`45,40` → `45.40`).

Los `id` de los criterios en [components/shared/criterios-busqueda.tsx](components/shared/criterios-busqueda.tsx) **deben coincidir** con los que evalúa el SQL.

**`fn_obtener_precio_escalonado(p_producto_id, p_cantidad, p_fecha)`** — devuelve el precio por mayor aplicable según cantidad y vigencia.

### 5.3 Helpers de autorización — `security definer`

Son `security definer` **a propósito**: al consultar `perfiles` desde una política de `perfiles` habría recursión de RLS.

| Función | Devuelve |
|---|---|
| `fn_es_admin()` | `boolean` — el usuario actual es admin |
| `fn_es_usuario_activo()` | `boolean` — existe y tiene `activo = true` |
| `fn_mi_sucursal()` | `uuid` — la sucursal del usuario actual (**puede ser null**) |

### 5.4 Triggers

| Función | Cuándo |
|---|---|
| `fn_kardex_aplica_stock()` | insert en kardex → mantiene **los dos** caches de stock |
| `fn_productos_before_update()` | bloquea el `UPDATE` directo de `productos.stock_actual` |
| `fn_proforma_items_validar()` | recalcula `subtotal_linea` y valida descuentos |
| `fn_asignar_numero_proforma()` · `fn_asignar_numero_venta()` · `fn_pedidos_traspaso_numero()` | `BEFORE INSERT` → numeración correlativa |
| `fn_crear_perfil_nuevo_usuario()` | alta en `auth.users` → crea la fila en `perfiles` leyendo `user_metadata` |
| `fn_touch_actualizado_en()` | `actualizado_en` de productos |

---

## 6. Row Level Security

RLS **activa en todas las tablas**. No hay registro público: los usuarios los crea el admin por invitación desde Supabase Auth.

### 6.1 Patrón general

- **Lectura:** autenticados (con la excepción por sucursal de 6.3).
- **Escritura de catálogo** (productos, códigos, medidas, unidades, precios por mayor, sucursales): solo `fn_es_admin()`.
- **`ventas` y `kardex_movimientos` NO tienen política de `insert`.** Es deliberado: **solo las RPC `security definer` pueden escribir ahí**. Cualquier intento de insertar directo falla, y así debe seguir.

### 6.2 Proformas

`insert` para cualquier autenticado; `update` mientras `estado = 'vigente'` o sea admin; `delete` solo admin.

### 6.3 Vendedor restringido por sucursal (script `30`)

El **vendedor ve solo las ventas, proformas y pedidos de su sucursal**; el admin ve todo:

```sql
using (public.fn_es_admin() or sucursal_id = public.fn_mi_sucursal())
```

Aplica a `ventas`, `proformas` y `pedidos_traspaso` (aquí, como origen **o** destino) más sus tablas de ítems vía `exists`. **El catálogo, `producto_stock_sucursal` y el kardex NO se restringen** — todos los ven, para poder decidir traspasos.

**Verificado el 29 jul 2026** simulando la sesión (`set local role authenticated` + `request.jwt.claims`, dentro de una transacción con `rollback`):

| Usuario | Ventas | Proformas | Pedidos | Productos | Proveedores |
|---|---|---|---|---|---|
| Vendedor · Casa Matriz | 12 | 5 | 10 | 239 | 0 |
| Vendedor · Almacén Centro | 2 | 0 | 10 | 239 | 0 |
| Admin | 14 | 5 | 10 | 239 | 7 |

Coincide con lo esperado. Los 10 pedidos los ven ambos vendedores porque **solo hay 2 sucursales**: todo traspaso es 1↔2, así que ambas participan siempre.

> ⚠️ **El modo de fallo silencioso que tenía esta política:** con `perfiles.sucursal_id` en null, `fn_mi_sucursal()` devuelve null, la comparación da null (no `true`) y el usuario **veía 0 ventas, 0 proformas y 0 pedidos, sin ningún error** — pero sí los 239 productos, así que la app parecía funcionar. Se comprobó en la práctica y **lo cierra el script `31`**, que hace la columna `not null`. Si alguna vez se revierte esa restricción, el agujero vuelve.

Las RPC de movimiento son `security definer` y **saltan RLS**, así que crear, convertir y despachar siguen funcionando igual: lo único que cambia es **qué filas ve cada quien al listar**.

---

## 7. Storage

| Bucket | Contenido | Público | Escritura |
|---|---|---|---|
| `productos-imagenes` | Imágenes de productos | ✅ | admin |
| `logo-empresa` | Logo para los PDF | ✅ | admin |

> El bucket `logo-empresa` **existe pero los PDF no lo usan**: el logo se sirve desde `public/` y se incrusta vía `lib/pdf/logo.ts`, con `outputFileTracingIncludes` en `next.config.mjs` para que el asset viaje al despliegue. `configuracion_empresa.logo_url` quedó como el gancho para volver a Storage si algún día se quiere logo configurable.

---

## 8. Índices

Además de los que crean las PK y los `unique`:

```sql
idx_productos_codigo                on productos (codigo)
idx_productos_descripcion           on productos using gin (to_tsvector('spanish', descripcion))
idx_codigos_equivalentes_codigo     on producto_codigos_equivalentes (codigo_equivalente)
idx_codigos_originales_codigo       on producto_codigos_originales (codigo_original)
idx_pvc_vehiculo                    on producto_vehiculos_compatibles (vehiculo_id)
idx_kardex_producto_fecha           on kardex_movimientos (producto_id, creado_en)
idx_ventas_numero                   on ventas (numero)
idx_proformas_numero                on proformas (numero)
idx_proformas_estado                on proformas (estado)
```

> **Optimización opcional pendiente:** la búsqueda hace `ilike '%frag%'`, que no usa el índice GIN de tsvector y produce scan. Para un catálogo de una tienda es aceptable; si crece, un índice **GIN `pg_trgm`** sobre `codigo` / `descripcion` / `linea_marca` lo aceleraría. Ojo: `unaccent()` es `STABLE`, no `IMMUTABLE`, así que **no se puede indexar directo** — haría falta un wrapper `IMMUTABLE` o una columna generada.

---

## 9. Deuda conocida

- **`00_setup_completo.sql` ya no sirve para instalar desde cero:** le faltan los scripts 12–14, 16 y 20–30. Una base nueva necesita correr `00` y después toda la secuencia incremental.
- **`productos.stock_actual`** es un total repetido que se decidió conservar (ver 2.1).
- **`productos.unidad_medida`** (texto) convive con `unidad_medida_id` (FK) hasta terminar la migración.
- ~~La política por sucursal del script `30` no se probó.~~ ✅ Verificada el 29 jul simulando sesiones de vendedor (ver 6.3); el hueco del `sucursal_id` null lo cerró el script `31`.
