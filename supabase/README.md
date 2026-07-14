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
