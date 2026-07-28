# supabase/ — scripts SQL de SISREP

Ejecutar en el **SQL Editor de Supabase**, en un proyecto nuevo.

## Opción rápida: un solo script

`00_setup_completo.sql` concatena 01→05 en el orden correcto — se pega completo en el SQL Editor y se corre una sola vez. Postgres ejecuta el pegado multi-statement como una transacción implícita: si algo falla a mitad de camino, no queda nada a medias. Los pasos manuales (crear usuarios de prueba y correr 06/08) siguen siendo aparte, ver abajo.

## Opción paso a paso: scripts por separado

Útil si preferís verificar cada capa (tablas, luego triggers, luego RPC, etc.) antes de seguir con la siguiente.

| # | Script | Qué hace |
|---|---|---|
| 1 | `01_tablas.sql` | Crea las 15 tablas + la vista `vista_proformas` |
| 2 | `02_secuencias_triggers.sql` | Numeración correlativa, cache de stock, alta automática de `perfiles` |
| 3 | `03_funciones_rpc.sql` | Funciones transaccionales (`fn_registrar_venta`, `fn_recibir_orden_compra`, etc.) |
| 4 | `04_rls_politicas.sql` | Activa RLS y crea las políticas por rol |
| 5 | `05_indices_storage.sql` | Índices + buckets de Storage (`productos-imagenes`, `logo-empresa`) |
| — | *Crear usuario admin de prueba* | Ver "Prerrequisito" abajo, antes de 06 |
| 6 | `06_verificacion.sql` | Prueba de punta a punta como admin (compra → ajuste → venta → proforma → conversión). Termina con rollback intencional. |
| — | *Crear usuario vendedor de prueba* | Ver "Prerrequisito" abajo, antes de 08 |
| 8 | `08_verificacion_rls_vendedor.sql` | Confirma que RLS bloquea/permite correctamente para el rol vendedor. Termina con rollback intencional. |

**`07_fix_fifo_desempate.sql` NO se ejecuta en instalaciones nuevas.** Es un parche histórico para bases creadas antes de que el desempate por `consecutivo` se integrara en 01 y 03. Se conserva solo como referencia.

### Migraciones incrementales (sobre una base que ya corrió 00 o 01-08)

Si tu base ya está creada y en uso, no vuelvas a correr `00_setup_completo.sql` — solo el script nuevo correspondiente a la fase en curso:

| # | Script | Fase | Qué hace |
|---|---|---|---|
| 9 | `09_busqueda_productos.sql` | 3 — Catálogo | Función `fn_buscar_productos(texto)`: busca por código, descripción, línea/marca, código equivalente o vehículo compatible en una sola llamada. |
| 10 | `10_busqueda_por_criterio.sql` | 3 — Catálogo | **Reemplaza la firma de `fn_buscar_productos`** por `(texto, campos text[])`: la UI ahora manda los criterios que el usuario marca (código, descripción, equivalente, línea/marca, vehículo) y la búsqueda filtra solo por esos (OR entre ellos; vacío ⇒ todos). Elimina la firma vieja de 1 argumento para evitar ambigüedad de sobrecarga. **Obligatorio: la app llama con 2 argumentos, sin este script la búsqueda deja de funcionar.** |
| 11 | `11_cliente_datos_factura.sql` | 5 — C1 | Agrega `clientes.nombre_factura` y `clientes.complemento` (se autocompletan al buscar el cliente por código/NIT en proforma y venta) + índice de búsqueda por `ci_nit`. Idempotente. |
| 12 | `12_sucursales.sql` | 5 — C2 paso 1 | Crea la tabla `sucursales` (código único, nombre, dirección, teléfono, activo) y su ABM. **No toca el stock todavía.** Idempotente. |
| 13 | `13_perfil_sucursal.sql` | 5 — C2 paso 2 | Agrega `perfiles.sucursal_id` (FK a `sucursales`) + backfill a la sucursal por defecto y el trigger que la lee al invitar usuarios. Requiere haber corrido 12. Idempotente. |
| 14 | `14_stock_por_sucursal.sql` | 5 — C2 paso 3a | **Reescribe el núcleo de inventario**: stock por `(producto × sucursal)` vía `producto_stock_sucursal`, `kardex_movimientos.sucursal_id`, FIFO por sucursal y las 4 RPC de movimiento reescritas (usan `fn_mi_sucursal()`) + migración a Casa Matriz. **Transición:** mantiene `productos.stock_actual` como total. Requiere 12 y 13. Idempotente. |
| 15 | `15_busqueda_anidada.sql` | 5 — C1.1 | **Búsqueda anidada por fragmentos**: `fn_buscar_productos` parte la consulta por espacios y exige que el campo cumpla todos los trozos (`ilike all`), conservando `%` como comodín (patrón `Piston%comp%85`). Misma firma que 10, la app no cambia. Idempotente; correr después de 10. ⚠️ **Esta NO es la versión que corre hoy en la BD real:** la viva es la de `00_setup_completo.sql` (ILIKE puro, **cross-field**, sin tsvector) y el script `26` se construyó sobre ESA. Verificar siempre con `select prosrc from pg_proc where proname='fn_buscar_productos'` antes de tocarla. |
| 16 | `16_sucursal_en_documentos.sql` | 5 — C2 paso 3c | Agrega `sucursal_id` (nullable + backfill a la sucursal por defecto) a **`proformas`**, **`ventas`** y **`ordenes_compra`**, e integra las 3 RPC: recepción de compra entra a la sucursal **destino de la orden**, la venta **guarda su sucursal** y la conversión de proforma **propaga la sucursal de la proforma**. Con fallback a `fn_mi_sucursal()`, así que no rompe la app. Requiere 12–14. Idempotente. |
| 17 | `17_tiempo_entrega.sql` | 5 — P10 | Columna `proformas.tiempo_entrega_dias` (nullable, check ≥ 0) para la leyenda "Tiempo de entrega: N día(s)." del PDF. **Obligatorio antes de crear proformas con la app actualizada** (la action lo inserta). Idempotente. |
| 18 | `18_precios_mayor.sql` | 5 — C3 | Tabla `producto_precios_mayor`: escalas de precio por cantidad mínima con `vigente_hasta` opcional, única por (producto, cantidad mínima); RLS lectura autenticados / escritura admin. Se administra desde la ficha del producto. Idempotente. |
| 19 | `19_pedidos_traspaso.sql` | 5 — C4 | Traspasos entre sucursales: tablas `pedidos_traspaso` + `pedido_traspaso_items`, numeración `PED-XXXXXX`, tipos de kardex `salida_traspaso`/`entrada_traspaso` y 4 RPC transaccionales (`fn_crear_pedido_traspaso`, `fn_enviar_traspaso` con salida FIFO en origen, `fn_recibir_traspaso` con lote FIFO en destino, `fn_cancelar_traspaso`). **Obligatorio para usar el módulo `/traspasos`.** Requiere 12–14. |
| 20 | `20_fix_trigger_traspasos.sql` | 5 — C4 fix | **FIX crítico del 19:** el trigger `fn_kardex_aplica_stock` no conocía `entrada_traspaso` y al **recibir** un traspaso restaba el stock del destino en vez de sumarlo. Corrige el trigger, **recomputa el cache de stock desde el kardex** (repara recepciones hechas con el bug) y agrega el `UNIQUE (producto_id, cantidad_minima)` que faltaba en `producto_precios_mayor`. **Correr inmediatamente después del 19, antes de usar `/traspasos`.** Idempotente. |
| 21 | `21_fix_fifo_traspaso.sql` | 5 — C4 fix | **FIX crítico (contraparte del 20):** `fn_fifo_consumir` (script 14) solo consumía lotes `entrada_compra`/`ajuste_entrada`, nunca `entrada_traspaso`. El 20 hizo que el traspaso recibido **sumara** al cache (se ve "Disponible"), pero ese stock **no se podía vender/ajustar/re-traspasar**: el FIFO no hallaba lotes → `Inconsistencia FIFO en producto % / sucursal %`. Agrega `entrada_traspaso` a los tipos que consume el FIFO. **Correr después del 20 si se usa `/traspasos`.** Idempotente. |
| 26 | `26_busqueda_unaccent.sql` | 6 — F1 | **Búsqueda ignorando acentos**: instala la extensión `unaccent` (en el esquema `extensions`) y reescribe `fn_buscar_productos` envolviendo cada campo y cada token con `extensions.unaccent(...)`, en **todos** los campos de texto. Parte de la **versión VIVA** (la de `00_setup_completo.sql`: ILIKE puro, cross-field), **no** del script 15. Conserva la lógica cross-field y **no** recupera stemming. Arregla que `valvula` sin tilde no encontrara el 61% del catálogo. Idempotente. *(Los números 22–25 quedan reservados para la Parte I del Sprint 6; el 26 es de la Parte II · F1.)* **✅ Corrido y verificado en la BD real el 27 jul 2026:** `valvula` pasó de 1 a ~113 resultados. |
| 27 | `27_proformas_vigencia.sql` | 6 — Parte IV | **Vigencia de proformas en 3 estados**: agrega `proformas.revalidada_en`, pone `plazo_validez_dias` en default **3** (+ update retroactivo de las existentes) y recrea `vista_proformas` con `estado_efectivo` de tres valores — `convertida`, `vencida` (tope duro de **3 meses** desde `creado_en`, se evalúa primero), `vigente` (dentro del plazo desde `coalesce(revalidada_en, creado_en)`) y `pendiente` (pasó el plazo corto pero no los 3 meses). Además **`fn_convertir_proforma_a_venta` ahora rechaza pendientes y vencidas** — antes ese bloqueo vivía solo en el frontend y la RPC convertía una proforma vencida sin protestar. La vista se **dropea y recrea** (no `create or replace`) porque `p.*` trae una columna nueva. Idempotente. **✅ Corrido y verificado en la BD real el 27 jul 2026.** |
| 28 | `28_pedidos_flujo.sql` | 6 — Parte III | **Invierte el flujo de traspasos**: el pedido lo crea la sucursal que **necesita** el producto (destino/solicitante) y elige a qué sucursal se lo pide (origen). `sucursal_origen_id`/`sucursal_destino_id` **no cambian de significado** (origen = de donde sale el stock), así que los pedidos históricos siguen válidos sin migración. Agrega `pedido_traspaso_items.cantidad_solicitada` (lo pedido) frente a `cantidad` (lo realmente despachado), relaja el check a `cantidad >= 0` (0 = no despacho ese ítem, y `fn_enviar_traspaso` lo saltea), y `fn_enviar_traspaso` pasa a aceptar `p_items` con las cantidades ajustadas por el origen (despacho en **un solo paso**, sin estado intermedio). Cierra H7/H8: las 4 RPC validan usuario activo y sucursal según la matriz (crear = cualquiera activo; despachar = origen o admin; recibir = destino o admin; cancelar = creador o admin). Requiere 19, 20 y 21. Idempotente. **✅ Corrido y verificado en la BD real el 27 jul 2026.** |
| 29 | `29_fn_guardar_producto.sql` | 6 — R8/Q4 | **Guardado transaccional del producto**: crea la RPC `fn_guardar_producto(p_id, p_producto, p_equivalentes, p_vehiculos, p_precios_mayor)` (SECURITY DEFINER, chequea admin) que hace cabecera + reemplazo de los 3 hijos (equivalentes, vehículos, precios por mayor) en **una sola transacción atómica**. Reemplaza el guardado por múltiples HTTP sin transacción que podía dejar un producto sin sus hijos (riesgo R8). `p_id` NULL crea, con valor edita. `createProducto`/`updateProducto` la llaman. **Obligatorio: sin este script, guardar un producto da error de función inexistente.** Maneja el esquema actual (con `fabricante`); extender al hacer la Parte I. Idempotente. |

### Prerrequisito antes de 06 y 08: usuarios de prueba

Antes de `06_verificacion.sql` necesitas al menos un usuario con `rol = 'admin'` en `perfiles`, y antes de `08_verificacion_rls_vendedor.sql` uno con `rol = 'vendedor'`. Se crean invitando/creando el usuario desde Supabase Auth con `user_metadata: { "rol": "admin" }` (o `"vendedor"`) — el trigger `on_auth_user_created` (script 02) crea automáticamente la fila en `perfiles` con ese rol.

## Decisiones que amplían BACKEND.md

BACKEND.md deja algunas decisiones abiertas para el momento de implementación (sección 2.2 y 4). Estas son las que se tomaron:

- **Stock cacheado, no vista**: `productos.stock_actual` es una columna mantenida por el trigger `trg_kardex_stock` (02) sobre cada insert en `kardex_movimientos`. El kardex sigue siendo la fuente de verdad; la columna es solo cache de lectura. Un segundo trigger (`trg_productos_update` / `fn_productos_before_update`) impide que un `UPDATE` directo sobre `productos` modifique `stock_actual` — solo el trigger del kardex puede (se distingue por `pg_trigger_depth()`).
- **`configuracion_empresa`**: tabla de fila única (`id smallint check (id = 1)`) con los datos de la empresa usados en los PDFs y el stock mínimo por defecto (Fase 10).
- **Estado `vencida` derivado, no persistido**: la vista `vista_proformas` calcula `estado_efectivo` comparando `creado_en + plazo_validez_dias` contra `now()`, en vez de un job que actualice `proformas.estado`. La columna `estado` en la tabla solo distingue `vigente`/`convertida`.
- **Desempate FIFO por `consecutivo`**: columna `bigint generated always as identity` en `kardex_movimientos`, para que dos lotes con el mismo `creado_en` (misma transacción) se consuman en el orden real de inserción y no en un orden dependiente del UUID.
- **`proveedores.nit` en vez de `ruc`**: Bolivia usa NIT (Número de Identificación Tributaria), no RUC. Consistente con `clientes.ci_nit`.
- **Catálogo `vehiculos` normalizado**: `producto_vehiculos_compatibles` ya no guarda `marca_vehiculo`/`modelo_vehiculo` como texto libre; referencia `vehiculos.id` (marca+modelo únicos). Evita inconsistencias de escritura entre productos que comparten el mismo vehículo compatible.
- **`proforma_items.subtotal_linea` server-side**: trigger `fn_proforma_items_validar` (02) recalcula la línea y valida límites de descuento en cada insert/update, igual de estricto que `fn_registrar_venta` para `venta_items`. Las proformas no pasan por RPC (no tocan stock), así que este trigger es su única red de seguridad de integridad.

## Notas de seguridad

- Todas las funciones RPC y los helpers de rol (`fn_es_admin`, `fn_es_usuario_activo`) son `security definer` con `set search_path = public` fijo, para evitar tanto la recursión de RLS al consultar `perfiles` como el hijacking de `search_path`.
- `ventas` y `kardex_movimientos` no tienen políticas RLS de `insert`: solo se escriben a través de las funciones RPC (que sí pueden porque son `security definer`), nunca desde el cliente directamente.
