# PLAN_7.md — Séptima tanda de tareas (una por una)

> Tareas nuevas del cliente. Se hacen **de a una**: implementar → probar → confirmar → siguiente.
> Armado: 2026-10-06. **Estado: T1, T2 y T3 (paso 1) implementadas en código el 2026-10-06. Falta correr los scripts `44`/`45`, probar en `localhost`, confirmar, subir y desplegar. T4 sigue bloqueada (falta la imagen).**
> **Todo va a los dos entornos:** código a `origin` (jissacruz-prueba) **y** `produccion` (JissaCruz_Project); cada script SQL en la base de **desarrollo y en la de producción**.
> **Una sola rama:** todo el trabajo va directo en `main`. No se crean ramas ni worktrees.

---

## Resumen

| Tarea | Qué pide el cliente | SQL | Estado |
|---|---|---|---|
| **T1** | Mostrar la unidad de medida en Proforma | No | ✅ Código listo — falta probar y confirmar |
| **T2** | En el formulario de Productos, que en "Medidas" quede solo el campo Etiqueta | Sí — `44` y `45` | ✅ Código listo — ⚠️ **falta correr `44` (antes de usar) y `45` (después de desplegar) en dev + prod** |
| **T3** | Separar Inventario de Kardex: módulos independientes | Paso 1: no | ✅ Paso 1 listo — falta probar y confirmar. Paso 2 (filtros) queda para después |
| **T4** | Diseño de Ventas y Proformas según la imagen de referencia | No se espera | 🔴 **Bloqueada: la imagen todavía no llegó** |

Verificado el 2026-10-06 con `tsc --noEmit`, `next lint` y `next build` (los tres sin errores). **No se probó en pantalla ni se ejecutaron los scripts SQL** (no hay acceso a la base desde la sesión): esa parte es la prueba en `localhost` de abajo.

---

## Lo que falta para cerrar T1–T3 (en orden)

1. **Correr `supabase/44_medidas_solo_etiqueta.sql` en la base de desarrollo.** Sin él, guardar un producto que tenga medidas da error.
2. **Probar en `localhost:3000`** con la lista de "Prueba" de cada tarea.
3. Confirmar.
4. Correr el `44` en **producción** → push de `main` a los dos remotos → `vercel --prod`.
5. Recién después de desplegar, correr `supabase/45_medidas_a_texto.sql` en dev y en prod.
6. Anotar acá `✅ corrido en dev + prod`.

---

## Decisiones

Cerradas el 2026-10-06. P3 con una captura del formulario; el resto con "hacé todo lo recomendado".

| # | Tarea | Pregunta | Decisión |
|---|---|---|---|
| **P1** | T1 | ¿La unidad va en la pantalla, en el PDF o en los dos? | ✅ En los dos. |
| **P2** | T1 | ¿Nombre ("Pieza") o código corto ("PZA")? | ✅ Código corto. |
| **P3** | T2 | ¿Qué significa "solo Etiquetas"? | ✅ Queda solo el campo **Etiqueta**, texto libre (ejemplo del cliente: `110X140X12/2…`). Se quitan Valor y Unidad. |
| **P4** | T2 | ¿Qué se hace con las medidas ya cargadas? | ✅ Se convierten a texto (`A: 45,40MM`). No se borra ninguna. |
| **P4b** | T2 | ¿El bloque se sigue llamando "Medidas"? | ✅ Sí. |
| **P5** | T3 | ¿Qué se ve al entrar a Kardex? | ✅ Buscador de producto y sus movimientos. Los filtros por fecha, tipo y sucursal quedan para un paso 2. |
| **P6** | T3 | ¿Quién ve el Kardex y el costo? | ✅ Los tres roles ven el Kardex; **el costo, solo el admin**. |
| **P7** | T3 | ¿Inventario conserva el botón "Ver Kardex"? | ✅ Sí, como atajo. |
| **P8** | T4 | Falta la imagen de referencia. | ⏳ Abierta. |
| **P9** | T4 | ¿El rediseño es de las pantallas o de los PDF? ¿Incluye Cotización S/F y Caja? | ⏳ Abierta: se define al ver la imagen. |

**Queda abierta de T1 (datos, no código):** los productos cargados desde los catálogos tienen la unidad genérica `unidad`. Por ahora se muestra así. Ver el diagnóstico en T1.

### Scripts SQL de esta tanda

La base está en el **43** (✅ corrido en dev + prod el 2026-09-27). Lo nuevo, **ya reflejado en `supabase/produccion_setup.sql`**:

- `44_medidas_solo_etiqueta.sql` — T2. **⏳ falta correr en dev + prod.** Va **antes** de desplegar.
- `45_medidas_a_texto.sql` — T2. **⏳ falta correr en dev + prod.** Va **después** de desplegar.
- `46_kardex_consulta.sql` — T3 paso 2. No escrito: solo si se aprueba ese paso.

---

## T1 — Unidad de medida en Proforma ✅ código listo (2026-10-06) — sin SQL

**Qué pide:** mostrar la unidad de medida en "Proforma".

**Cómo quedó**

- **Alta** (`proformas/proforma-form.tsx`): la unidad se ve **siempre** en los resultados de búsqueda (antes se escondía si era la genérica) y hay una **columna "Unidad"** nueva en la tabla de ítems, al lado de la cantidad.
- **Edición** (`proformas/[id]/proforma-detalle.tsx`): la unidad aparece en los resultados y en cada ítem (`Unidad: PZA`).
- **Lectura** (proforma convertida o vencida): la línea dice `5 PZA × Bs 10.00`.
- **PDF** (`lib/pdf/proforma-document.tsx`): la unidad va siempre junto a la cantidad (`5 PZA`). El documento es compartido con la **Cotización S/F**, así que su PDF también cambia.
- **Código corto:** `resolverUnidadCorta()` en `lib/unidades-server.ts` (nuevo). Busca el código en el catálogo de unidades por el id del producto; si el producto no tiene unidad del catálogo, por el nombre guardado en el texto; si tampoco coincide, muestra el texto tal cual.
- La unidad viaja en el ítem del formulario solo para mostrarla (`proformaItemSchema`); **no se guarda** en `proforma_items`. Siempre se ve la unidad actual del producto.

**No cambia:** POS, Cotización (pantalla) y el PDF de venta siguen como estaban.

**⚠️ Dato a revisar.** La carga de catálogos crea los productos con `unidad_medida = 'unidad'`. Esos productos van a mostrar `unidad` (o el código de la unidad del catálogo que se llame "Unidad", si existe). Además, `fn_guardar_producto` **no deja cambiar la unidad de un producto que ya tiene movimientos de stock** (guarda R1 del script 24), así que no se corrige desde el formulario. Diagnóstico para prod:

```sql
select coalesce(u.codigo, '(sin unidad del catálogo)') as unidad,
       p.unidad_medida as texto,
       count(*) as productos
from public.productos p
left join public.unidades_medida u on u.id = p.unidad_medida_id
where p.activo
group by 1, 2
order by 3 desc;
```

Si la mayoría sale sin unidad del catálogo, hay que definir con el cliente qué unidad lleva cada línea y cargarla con un script aparte.

**Prueba:** Nueva proforma → buscar un producto → se ve su unidad en el resultado y en la columna "Unidad" al agregarlo. Abrir una proforma vigente → se ve en cada ítem. Abrir una convertida → se ve en la línea. PDF de proforma y de cotización → cada línea trae la unidad junto a la cantidad. Probar un producto en KG y uno con la unidad genérica.

---

## T2 — En "Medidas" queda solo el campo Etiqueta ✅ código listo (2026-10-06) — ⚠️ falta correr `44` y `45`

**Qué pide:** en el formulario del CRUD de productos, que el dato "Medidas" quede solo con la Etiqueta.

**Decisión (con captura del formulario):** de las tres columnas del bloque Medidas (Etiqueta, Valor, Unidad) queda solo **Etiqueta**, como texto libre. El cliente escribe ahí la medida completa (`110X140X12/2…`). Antes el formulario exigía un Valor mayor a 0 y una Unidad, y con el Valor en 0 no dejaba guardar.

**Cómo quedó**

*Aplicación*

- `productos/producto-form.tsx`: cada fila del bloque **Medidas** es un solo campo de texto, más el botón de borrar.
- `lib/validations/producto.ts`: `medidaSchema` tiene solo `etiqueta`.
- `lib/medidas.ts`: `textoMedida()` y `formatearMedidas()` muestran la etiqueta; para una medida vieja que todavía tiene valor, muestran `A: 45,40MM` como antes. Las medidas se separan con ` · `. Todas las pantallas y los PDF que muestran `Medidas: …` usan ese helper, así que cambiaron solos.
- `productos/actions.ts`: al abrir un producto con medidas viejas, el formulario las recibe ya como texto, para que **editar y guardar no las pierda**.
- `lib/producto-busqueda-server.ts` y las rutas PDF de proforma, venta y cotización aceptan medidas sin valor.

*Base de datos*

- **`44_medidas_solo_etiqueta.sql`**: `producto_medidas.valor` acepta `null`, y el criterio `medida` de `fn_buscar_productos` busca en el texto de la etiqueta (las medidas viejas se siguen encontrando). La función es idéntica a la del script 34 salvo ese criterio. **`fn_guardar_producto` no se tocó:** ya guarda `null` cuando el valor no llega.
  - Arranca con una comprobación: si la función que corre en la base no es la del script 34, corta con un mensaje y **no cambia nada**.
- **`45_medidas_a_texto.sql`**: pasa las medidas viejas a texto (`A: 45,40MM`) y deja `valor` en `null`.
- La tabla y las columnas no se renombran ni se borran. El id del criterio de búsqueda sigue siendo `medida`.

**Orden al desplegar (importante)**

1. `44` **antes** de desplegar: es compatible con la versión publicada. Sin él, la app nueva no puede guardar un producto con medidas.
2. Desplegar el código.
3. `45` **después** de desplegar: la versión anterior mostraría mal las medidas ya convertidas. No es urgente: la app nueva las muestra bien con o sin el `45`.

**Qué se pierde:** las medidas ya no son números validados (decisión Q2 del Sprint 6). Buscar `45,40` o `45.40` sigue encontrando la medida.

**Diagnóstico previo (prod), para saber cuántas medidas viejas hay:**

```sql
select count(*) as medidas, count(distinct producto_id) as productos
from public.producto_medidas;
```

**Prueba:** (con el `44` corrido en dev) Editar un producto → en Medidas cada fila es un solo campo → escribir `110X140X12/2` → guarda sin pedir valor ni unidad → reabrir y sigue ahí. Buscar `110X140` con el criterio Medidas marcado → lo encuentra. POS, Proforma y PDF muestran `Medidas: 110X140X12/2`. Abrir un producto con medidas viejas → aparecen como `A: 45,40MM` → guardar → se conservan.

---

## T3 — Inventario y Kardex como módulos independientes ✅ paso 1 listo (2026-10-06) — sin SQL

**Qué pide:** separar Inventario de Kardex.

**Cómo estaba:** un solo ítem de menú, "Inventario / Kardex". El Kardex solo se podía abrir desde Inventario; entrando directo a `/kardex` decía "Seleccioná un producto desde Inventario". La columna Costo la veían los tres roles.

**Cómo quedó (paso 1)**

- **Menú** (`components/shared/nav-items.ts`): dos ítems, **Inventario** y **Kardex**, cada uno con su ícono. El título del encabezado sale de ahí.
- **Kardex con entrada propia** (`kardex/kardex-explorer.tsx` y `kardex/actions.ts`, nuevos): buscador de producto con los mismos criterios que el resto (RPC `fn_buscar_productos`) y un botón "Ver kardex" por resultado. Dentro del kardex de un producto hay un enlace "Buscar otro producto".
- **Costo solo para el admin:** a vendedor y cajero no se les muestra la columna Costo en pantalla, ni en el Excel, ni en el PDF. La página y la ruta PDF directamente **no piden el costo a la base** para esos roles.
- **Ruta PDF** (`app/api/pdf/kardex/route.tsx`): ahora exige sesión activa (antes no chequeaba nada) y decide el costo por rol.
- **Inventario** queda como lista de stock por sucursal + ajuste (admin), y conserva el botón "Ver Kardex" de cada producto como atajo.
- **Documentación:** `UI_UX.md` (§3 y §4.4), `FLUJO.md` §10 y `CLAUDE.md`. El manual de usuario en PDF **no se regeneró**.

**Límite conocido:** el costo se oculta en la aplicación. La política de la base sigue permitiendo que cualquier usuario autenticado lea `kardex_movimientos` completo; cerrarlo también ahí necesita SQL (una vista o una función) y no se pidió.

**Pendiente — paso 2 (script `46`, si se aprueba)**

- Filtros por rango de fechas, tipo de movimiento y sucursal.
- RPC `fn_kardex_producto(producto, desde, hasta, sucursal)` con el saldo calculado en SQL. Resuelve un problema latente: hoy el saldo se calcula en la aplicación y la API devuelve como máximo 1000 filas, así que un producto con más de 1000 movimientos mostraría el kardex cortado.

**Prueba:** El menú muestra Inventario y Kardex por separado. Kardex → buscar un producto → "Ver kardex" → movimientos → exportar PDF y Excel → "Buscar otro producto". Inventario → botón "Ver Kardex" de una fila abre ese producto. Como **vendedor** y como **cajero**: no aparece la columna Costo en pantalla, ni en el Excel, ni en el PDF. Como **admin**: sí aparece.

---

## T4 — Diseño de Ventas y Proformas según la imagen de referencia 🔴

**Qué pide:** rediseñar Ventas y Proformas de acuerdo a una imagen de referencia.

**Bloqueada:** la imagen no llegó con el pedido. Sin ella no se puede definir alcance ni tamaño. Tampoco está claro si se refiere a las pantallas o a los documentos impresos (P9).

**Cómo está hoy** (para comparar contra la imagen cuando llegue)

- **POS** (`ventas/pos.tsx`), una sola columna: cliente opcional → buscador con criterios → resultados en filas con botón Agregar → tabla del pedido (N°, Cant., Código / Detalle, P. Unit., Importe) → impuesto y totales → botón "Enviar a caja".
- **Proforma — alta** (`proformas/proforma-form.tsx`), una sola columna: cabecera (cliente, tipo de pago, tiempo de entrega) → buscador → resultados → tabla de ítems (N°, Cant., Unidad, Código / Detalle, P. Unit., Importe), con precio editable hacia arriba → impuesto, glosa y totales → "Crear proforma".
- **Proforma — edición y lectura** (`proformas/[id]/proforma-detalle.tsx`): **dos columnas** (ítems a la izquierda, resumen y acciones a la derecha). Hoy no coincide con la pantalla de alta.
- **PDF** de proforma y de venta: encabezado con logo y datos de la empresa, datos del cliente, glosa, tabla (N°, Cantidad, Código, Línea, Detalle, P. Unit., Importe), total en literal.

**Reglas que el rediseño no puede romper** (vienen de las tandas anteriores y están exigidas también en la base):

- Proforma y POS **sin descuentos**; el precio unitario no baja del precio del sistema para esa cantidad (PLAN_6 · T1/T2).
- En el POS el precio **no se edita** (PLAN_4 · T2).
- Un pedido o una proforma **no mezclan** productos con factura y S/F (PLAN_6 · T4).
- No se agrega un producto sin precio ni más cantidad que el stock de la sucursal (PLAN_5).
- El POS **no cobra**: envía el pedido a Caja (PLAN_5 · T5).
- Paleta y tipografía de la marca JISSACRUZ.

**Plan (se completa al recibir la imagen)**

1. Recibir la imagen. Escribir acá, en texto, lo que se ve en ella (zonas, columnas, orden, qué datos muestra) y **confirmarlo con el cliente** antes de maquetar.
2. Listar las diferencias contra lo de hoy y marcar si alguna pide un dato que el sistema no tiene (eso sí sería SQL).
3. Decidir si las piezas comunes (buscador, tabla de ítems, bloque de totales) pasan a `components/shared/`, para que POS y Proforma no se vuelvan a separar.
4. Implementar en este orden: POS → Proforma alta → Proforma edición y lectura → (si aplica) Cotización S/F, Caja y PDF.
5. Probar en pantalla chica y grande.

**Relacionado, pendiente de PLAN_6:** convertir una proforma en venta la registra directo, sin pasar por Caja. Si T4 toca ese flujo, conviene cerrar esa decisión en el mismo momento.

---

## Cierre de cada tarea

1. `npx tsc --noEmit` + `npm run lint`.
2. Prueba en `localhost:3000` con la base de desarrollo al día.
3. Confirmación del usuario.
4. Si hay SQL: correr el script en prod y anotarlo acá (`✅ corrido en dev + prod`).
5. Push de `main` a los dos remotos → `vercel --prod`.
6. Actualizar el estado de la tarea en este archivo ("Cómo quedó") y `CLAUDE.md` si cambió alguna regla o módulo.

---

## Anotado fuera de esta tanda

Detectado el 2026-10-06 al revisar el repo. No forma parte de T1–T4.

- **Logo en el PDF de cotización — descartado.** Se había anotado que la ruta `/api/pdf/cotizacion/[id]` no está en `outputFileTracingIncludes` de `next.config.mjs` y podía salir sin logo en producción. En el build del 2026-10-06 el logo sí quedó incluido para esa ruta, igual que para las demás. No hay nada que corregir.
- **README desactualizados:** a `supabase/README.md` le faltan las filas de los scripts 35–40 (las del 44 y 45 ya están); el `README.md` raíz nombra un `.env.local.example` que no existe y manda a instalar con `00_setup_completo.sql` en vez de `produccion_setup.sql`. Se corrige si el cliente lo pide.
