# PLAN_7.md — Séptima tanda de tareas (una por una)

> Tareas nuevas del cliente. Se hacen **de a una**: implementar → probar → confirmar → siguiente.
> Armado: 2026-10-06. **Estado al 2026-10-11: T1, T2 y T3 (paso 1) están publicadas en producción desde el 2026-10-06 23:44, y T5 (validez en Proforma) desde el 2026-10-11 18:18: el push a los remotos disparó solo el despliegue en Vercel las dos veces. ⚠️ Falta confirmar que el script `44` esté corrido en producción (ver abajo) y correr el `45`. T4: llegó la imagen y está planificada, sin implementar.**
> **Todo va a los dos entornos:** código a `origin` (jissacruz-prueba) **y** `produccion` (JissaCruz_Project); cada script SQL en la base de **desarrollo y en la de producción**.
> **Una sola rama:** todo el trabajo va directo en `main`. No se crean ramas ni worktrees.

---

## Resumen

| Tarea | Qué pide el cliente | SQL | Estado |
|---|---|---|---|
| **T1** | Mostrar la unidad de medida en Proforma | No | ✅ Código listo — falta probar y confirmar |
| **T2** | En el formulario de Productos, que en "Medidas" quede solo el campo Etiqueta | Sí — `44` y `45` | ✅ Código listo — ⚠️ **falta correr `44` (antes de usar) y `45` (después de desplegar) en dev + prod** |
| **T3** | Separar Inventario de Kardex: módulos independientes | Paso 1: no | ✅ Paso 1 listo — falta probar y confirmar. Paso 2 (filtros) queda para después |
| **T4** | Diseño de Ventas y Proformas según la imagen de referencia | No se espera | ⏳ Imagen recibida el 2026-10-11. **Planificada, sin implementar**: faltan cerrar P10–P15 |
| **T5** | Validez de la oferta (días) en Proforma, como en Cotización | No | ✅ Publicada en producción el 2026-10-11 — falta probar y confirmar |
| **T7** | Rediseño de los PDF de venta, proforma y cotización según la factura de referencia | No | ✅ Código listo (2026-10-11) — **sin subir todavía** |
| **T6** | PDF de venta: Cantidad y Código centrados, y columna de unidad de medida | No | ✅ Publicada en producción el 2026-10-11 (venta y proforma 18:48; kardex y reportes 18:59) — falta que el usuario lo confirme en pantalla |

Verificado el 2026-10-06 con `tsc --noEmit`, `next lint` y `next build` (los tres sin errores). **No se probó en pantalla ni se ejecutaron los scripts SQL** (no hay acceso a la base desde la sesión): esa parte es la prueba en `localhost` de abajo.

---

## Lo que falta para cerrar T1–T3 y T5 (en orden)

**⚠️ Urgente si no se hizo:** el código de T2 está en producción desde el 2026-10-06. Mientras el script `44` no esté corrido en la base de **producción**, **guardar un producto que tenga medidas da error** ("No se pudo actualizar el producto"). Los productos sin medidas se guardan bien.

1. **Correr `supabase/44_medidas_solo_etiqueta.sql` en producción** (y en desarrollo), si todavía no se corrió.
2. Probar en producción o en `localhost:3000` con la lista de "Prueba" de cada tarea.
3. Correr `supabase/45_medidas_a_texto.sql` en dev y en prod (el código nuevo ya está publicado, así que ya se puede).
4. Anotar acá `✅ corrido en dev + prod`.

**Cómo se publicó:** el 2026-10-06 y el 2026-10-11 el push de `main` a los remotos creó un despliegue de producción en Vercel a los 6 segundos. No hizo falta `vercel --prod`. De ahora en adelante: **subir a los repositorios es publicar**, así que un script del que dependa el código va **antes** del push.

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
| **P8** | T4 | Falta la imagen de referencia. | ✅ Recibida el 2026-10-11 (captura de Velacuss, pantalla de cotización). |
| **P9** | T4 | ¿El rediseño es de las pantallas o de los PDF? | ✅ De las pantallas: la imagen es una lista de productos en pantalla. Qué pantallas incluye es P11 (en T4). |

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
- **PDF** (`lib/pdf/proforma-document.tsx`): la unidad se muestra siempre. Primero iba junto a la cantidad (`5 PZA`); desde T6 va en su propia columna "Unidad". El documento es compartido con la **Cotización S/F**, así que su PDF también cambia.
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

## T4 — Diseño de Ventas y Proformas según la imagen de referencia ⏳ planificada (2026-10-11) — sin SQL

**Qué pide:** que Ventas y Proformas se vean como la imagen de referencia.

**La imagen (recibida el 2026-10-11):** captura del sistema Velacuss, pantalla `venta/cotizacion/details`. Es una **lista de productos con una fila grande por producto**, que muestra toda la ficha sin tener que abrir nada. Confirma que el pedido es sobre las **pantallas**, no sobre los PDF.

### Lo que se ve en cada fila (de izquierda a derecha)

1. **Número de fila.**
2. **Código**, en dos líneas: uno gris (`WABC0286`) y debajo otro en negrita (`4410501010`).
3. **Ficha del producto**, como lista de rótulo + valor:
   - `LÍNEA` (WABCO)
   - `DESCRIPCIÓN`
   - `UNIDAD DE MEDIDA` (PIEZAS, con el nombre completo)
   - `MEDIDA` (110X140X12/22), solo si el producto tiene
   - `CÓDIGO ORIGINAL`, varios en una línea
   - `EQUIVALENTES`, uno por línea
   - `TOTAL` (stock total) y, debajo, una tira de etiquetas `sucursal:cantidad`, una por sucursal, en verde si hay stock y en naranja si está en cero.
4. **Precio y stock:** `Precio: Bs 550.00`, `Total stock: 2:0` (la sucursal del usuario y su cantidad) y un cuadro `Descuentos` con columnas Tipo / Cant / Bs / Lím. (`PRECIO POR MAYOR · 3 · 465.00 · 31-12-2026`).
5. **Carga:** campo de cantidad, campo de precio, subtotal de la línea, botón de carrito (agregar) y botón rojo (quitar).

### Qué tiene SISREP de todo eso

| Dato de la imagen | En SISREP | Hoy se muestra en POS / Proforma |
|---|---|---|
| Código | ✅ `productos.codigo` | Sí |
| Segundo código (el de abajo, en negrita) | ❌ No existe: cada producto tiene un solo código | — |
| Línea | ✅ `linea_marca` | No en los resultados |
| Descripción | ✅ | Sí |
| Unidad de medida | ✅ | Sí, chica (T1) |
| Medida | ✅ (T2: texto libre) | Sí, en una línea chica |
| Código original | ✅ `producto_codigos_originales` | Solo los primeros 4 |
| Equivalentes | ✅ `producto_codigos_equivalentes` | **No:** la búsqueda ni los trae |
| Stock total y por sucursal | ✅ `producto_stock_sucursal` | POS sí; Proforma solo el de la sucursal del usuario |
| Precio | ✅ | Sí |
| Precio por mayor (cantidad, precio, vigencia) | ✅ `producto_precios_mayor` | **No:** se usa para calcular, pero no se ve |
| Cantidad antes de agregar | — | No: "Agregar" suma 1 y la cantidad se cambia después |

**Todos los datos ya existen: no se espera SQL.** Lo que cambia es la presentación y lo que trae la búsqueda.

### Lo que NO se copia de la imagen

Son reglas de las tandas anteriores, exigidas también en la base:

- El cuadro se llama **"Precio por mayor"**, no "Descuentos": en POS y Proforma no hay descuentos (PLAN_6).
- En el **POS el precio no se edita** (PLAN_4). En **Proforma** se puede subir, nunca bajar del precio del sistema (PLAN_6).
- No se mezclan productos con factura y S/F; se mantiene la etiqueta **S/F**.
- En el POS no se agrega un producto sin stock en la sucursal ni sin precio.
- Colores y tipografía de **JISSACRUZ**, no los de Velacuss. Los colores de stock (verde / amarillo / rojo) se mantienen.

### Decisiones a cerrar

| # | Pregunta | Recomendación |
|---|---|---|
| **P10** | ¿Dónde va la fila grande: solo en los **resultados de búsqueda** (antes de agregar), o también en la lista de productos ya agregados? | Solo en los resultados. La lista del pedido queda compacta, como hoy, para que el total se vea sin bajar mucho. |
| **P11** | ¿En qué pantallas? | POS, Proforma nueva, Proforma en edición y **también Cotización S/F** (la imagen es justamente una cotización). Caja no. |
| **P12** | La imagen muestra dos códigos por producto; SISREP tiene uno. | Mostrar solo el código que hay. Si el cliente necesita el segundo, es un dato nuevo (eso sí sería SQL y carga de datos). |
| **P13** | ¿La unidad en la ficha va con nombre completo ("PIEZAS", como la imagen) o con el código corto de T1 ("PZA")? | Nombre completo en la ficha, donde hay lugar. El código corto queda en la tabla del pedido y en el PDF. |
| **P14** | ¿Se elige la cantidad en la misma fila antes de agregar, como en la imagen? | Sí: campo de cantidad + botón agregar en la fila. |
| **P15** | Las filas son altas. ¿Cuántos resultados por página? | 5 por página en estas pantallas (hoy son 10), con el selector de siempre. |

### Plan

1. **Datos de la búsqueda.** `lib/producto-busqueda-server.ts` suma los **equivalentes**. Las acciones de búsqueda de POS, Proforma y Cotización pasan a devolver lo mismo: línea, unidad (nombre y código), medidas, originales, equivalentes, stock total y por sucursal, y precios por mayor. Hoy son tres funciones casi iguales: se unifican en un helper para no mantener tres copias.
2. **Componente compartido** `components/shared/producto-ficha.tsx`: la fila grande con las cinco zonas. Reutiliza `<StockBadge />` para el stock por sucursal.
3. **POS** (`ventas/pos.tsx`): los resultados usan la fila nueva; precio de solo lectura.
4. **Proforma nueva** (`proformas/proforma-form.tsx`) y **Proforma en edición** (`proformas/[id]/proforma-detalle.tsx`): lo mismo, con el precio editable hacia arriba. La edición hoy muestra los resultados en una lista chica; pasa a usar la misma fila.
5. **Cotización S/F** (`cotizacion/cotizador.tsx`), si se aprueba P11.
6. **Pantalla chica:** las cinco zonas se apilan en vez de ir en una sola fila.
7. `tsc` + lint + build → prueba en `localhost` → confirmar.

**Orden sugerido:** POS primero. Se muestra, se ajusta lo que haga falta y recién después se replica en Proforma y Cotización.

**Tamaño:** grande (4 pantallas + un componente nuevo), sin SQL.

**Relacionado, pendiente de PLAN_6:** convertir una proforma en venta la registra directo, sin pasar por Caja. T4 no toca ese flujo; sigue siendo una decisión aparte.

**Prueba:** POS → buscar un producto → la fila muestra línea, descripción, unidad, medida, códigos originales, equivalentes, stock por sucursal, precio y precio por mayor → poner cantidad 3 → agregar → entra al pedido con cantidad 3 y, si corresponde, con el precio por mayor. Lo mismo en Proforma nueva, Proforma en edición y Cotización. Verificar en pantalla chica.

---

## T5 — Validez de la oferta en Proforma ✅ código listo (2026-10-11) — sin SQL

**Qué pide:** que la proforma tenga la validez de la oferta en días, igual que la Cotización. Pedido aparte de T4, del 2026-10-11.

**Cómo estaba:** desde el Sprint 6 (decisión Q20) la validez era **fija en 3 días** y el campo se había quitado del formulario. Este pedido revierte esa decisión.

**Cómo quedó**

- **Proforma nueva** (`proformas/proforma-form.tsx`): campo **"Validez (días)"** en la cabecera, junto a Tipo de pago y Entrega. Arranca en 3.
- **Proforma en edición** (`proformas/[id]/proforma-detalle.tsx`): el mismo campo, junto a "Entrega (días)". Al guardar, la proforma queda vigente esa cantidad de días **desde ese momento** (`updateProforma` ahora guarda el plazo; antes no lo tocaba).
- **Límites:** entre **1 y 90 días** (`lib/validations/proforma.ts`). Con 0 la proforma nacería ya "pendiente de revisar precios"; y a los 3 meses la base la da por vencida igual, así que más de 90 no tiene efecto. En Cotización no cambió nada.
- **PDF:** la leyenda "Válida hasta el …" usa la validez elegida. Si la proforma se revisó (edición o revalidación), cuenta **desde la última revisión**, igual que el sistema; antes contaba siempre desde la emisión y podía mostrar una fecha distinta.
- **Sin SQL:** la columna `plazo_validez_dias`, la vista `vista_proformas` y `fn_convertir_proforma_a_venta` ya usaban el plazo de cada proforma (script 27).

**Prueba:** Nueva proforma → aparece "Validez (días)" con 3 → poner 10 → crear → el PDF dice "Válida hasta el …" a 10 días. Poner 0 o 100 → no deja guardar y avisa. Editar una proforma → cambiar la validez → guardar → sigue vigente por esos días. Una proforma pendiente → guardar con la validez nueva → vuelve a estar vigente.

---

## T6 — PDF de venta: columnas centradas y unidad de medida ✅ publicada (2026-10-11) — sin SQL

**Qué pide:** en el PDF de venta, la Cantidad y el Código salían pegados (`CantidadCódigo`, `1TKL35014`) y tienen que ir centrados; además faltaba la unidad de medida. Referencia del cliente: una factura de Velacuss con columna "Unidad de medida".

**Por qué pasaba:** las columnas no tenían margen entre sí, y Cantidad iba alineada a la derecha justo al lado del Código, alineado a la izquierda.

**Cómo quedó**

- Tabla nueva: **N° · Cantidad · Unidad · Código · Línea · Detalle · P. Unit. · Importe**. N°, Cantidad, Unidad y Código van **centrados**, y cada columna tiene margen interno.
- **Columna "Unidad"** propia, con el código corto del catálogo (`PZA`, `KG`), igual que en la proforma (`resolverUnidadCorta()`). Antes el PDF de venta solo mostraba la unidad pegada a la cantidad, y la escondía si era la genérica.
- **El PDF de proforma (y el de cotización, que lo comparte) tenía el mismo defecto y recibió el mismo arreglo**, para que los tres documentos queden iguales. En esos dos la unidad pasa de ir junto a la cantidad (T1) a su propia columna.
- Se mantiene el diseño de JISSACRUZ (encabezado azul); no se copió la grilla con bordes de la factura de referencia.

**Revisión de todos los PDF del sistema (mismo día).** A pedido del cliente se generaron con datos de ejemplo los otros documentos (Kardex y los 5 reportes) y aparecieron defectos del mismo tipo, ya corregidos:

- **Kardex:** la fecha se pegaba al movimiento (`11/10/2026 22:11Salida por venta`). Ahora cada columna tiene su ancho y su margen; Cantidad centrada, Costo y Saldo a la derecha.
- **Reporte de inventario, bloque "Stock en tránsito":** `CantidadRecorrido` y `5CM` pegados. Además la flecha del recorrido (`→`) salía como un apóstrofo, porque la fuente del PDF no la tiene: en el PDF ahora va `>`.
- **Reporte de proformas y de productos más vendidos:** la columna ancha era la primera (Número / Código) y el cliente o la descripción quedaban apretados en una angosta. Ahora la ancha es Cliente / Descripción (`columnaAncha` en `lib/reportes.ts`).
- **Todos los PDF:** las palabras ya no se parten con guion (`FIL-TRO`, `SCA-NIA`, `ORI-ENTE`); pasan enteras al renglón siguiente (`lib/pdf/tipografia.ts`).
- Los reportes de ventas por período y de rentabilidad estaban bien; solo ganaron el margen entre columnas.

**Archivos:** `lib/pdf/venta-document.tsx`, `lib/pdf/proforma-document.tsx`, `lib/pdf/kardex-document.tsx`, `lib/pdf/reporte-document.tsx`, `lib/pdf/tipografia.ts` (nuevo), `lib/reportes.ts`, `lib/reportes-tipos.ts`, `app/api/pdf/venta/[id]/route.tsx`.

**Verificado:** los ocho documentos (venta, proforma, kardex con y sin costo, y los 5 reportes) se generaron con datos de ejemplo — códigos cortos y largos, nombres largos, con medidas y códigos originales — y se revisaron a la vista. `tsc`, lint y build sin errores. No se probó con datos reales de producción.

**Prueba:** abrir el PDF de una venta → Cantidad, Unidad y Código en columnas separadas y centradas. Lo mismo en el PDF de una proforma y de una cotización.

---

## T7 — Rediseño de los PDF comerciales según la factura de referencia ✅ código listo (2026-10-11) — sin SQL

**Qué pide:** revisar todos los PDF tipo factura que genera el sistema (ventas, compras, proforma, cotización) y cambiarles el diseño según la imagen de referencia (una factura de Velacuss), manteniendo la paleta de colores del sistema.

**Qué PDF genera el sistema**

| PDF | Se rediseñó |
|---|---|
| Comprobante de venta | ✅ |
| Proforma | ✅ |
| Cotización S/F | ✅ (comparte el documento de la proforma) |
| **Compras** | ❌ **No existe**: el módulo Compras hoy no genera ningún PDF. Agregarlo es trabajo nuevo, a pedido. |
| Kardex y Reportes | No son facturas: mantienen su diseño (corregido en T6). |

**Cómo quedó** — un solo diseño para los tres, en `lib/pdf/documento-comercial.tsx` (nuevo). `venta-document.tsx` y `proforma-document.tsx` ya no tienen diseño propio: arman sus datos y usan ese componente.

- **Arriba a la izquierda**, centrado: logo, nombre de la empresa, sucursal, dirección y teléfono (los de la sucursal; si no tiene, los de la empresa).
- **Arriba a la derecha:** NIT, número del documento, vendedor y, en la venta, la proforma de origen.
- **Título centrado** (`COMPROBANTE DE VENTA`, `PROFORMA`, `COTIZACIÓN`) con la leyenda "(Sin valor fiscal)".
- **Datos en dos columnas:** Fecha, Nombre/Razón Social y Dirección a la izquierda; NIT/CI, Teléfono y Tipo de pago a la derecha. La glosa, si hay, va debajo.
- **Tabla con grilla** y encabezados centrados, en el orden de la referencia: Código · Cantidad · Unidad de medida · Descripción · Precio unitario · Descuento · Subtotal. La línea, las medidas y los códigos originales van dentro de la descripción.
- **Totales en un cuadro** pegado a la tabla, a la derecha (Subtotal, Descuento, Impuesto, Total a pagar), con el importe en literal a la izquierda.
- **Pie centrado** con las leyendas (y la validez y el tiempo de entrega en proforma y cotización).
- Colores de JISSACRUZ: encabezado de la tabla, título y líneas en el azul de la marca.

**Diferencias con la referencia, a propósito**

- **Columna "Descuento":** aparece solo si algún ítem tiene descuento (hoy, cotizaciones y documentos viejos). En Proforma y POS no hay descuentos desde PLAN_6.
- **Título:** sigue diciendo "Comprobante de venta — sin valor fiscal", no "Factura": el sistema no emite facturas fiscales (no hay código de autorización ni QR).
- **Números** en formato boliviano (`1.500,00`), cantidades enteras y unidad en código corto (`PZA`), como ya estaba decidido.
- No se muestra el número de fila (la referencia no lo tiene).

**Arreglos que salieron al rehacer los documentos**

- **Hora equivocada:** los PDF mostraban la hora del servidor (UTC), 4 horas adelantada. El comprobante de la captura del cliente decía 22:11 para una venta de las 18:11, y una venta después de las 20:00 salía con la fecha del día siguiente. Ahora todos los PDF (también Kardex y Reportes) usan la hora de Bolivia con `textoFechaBolivia()` de `lib/fechas-bolivia.ts`.
- **Documentos de varias hojas:** el encabezado de la tabla se repite en cada hoja y la tabla cierra bien al final de cada una.
- **Importe en literal:** un total con resto de decimales podía salir como "… 100/100 Bolivianos".

**Sin tocar:** `lib/reportes.ts` arma las fechas de las filas de los reportes en el servidor con la misma zona equivocada (por ejemplo la columna Fecha del reporte de proformas). Es un tema de datos, no de diseño; queda anotado.

**Verificado:** venta, proforma y cotización generadas con datos de ejemplo (con y sin descuentos, con impuesto, con glosa, sin cliente, y una venta de 45 ítems en 3 hojas), con el reloj del proceso en UTC como el servidor, y revisadas a la vista. `tsc`, lint y build sin errores. No se probó con datos reales.

**Archivos:** `lib/pdf/documento-comercial.tsx` (nuevo), `lib/pdf/venta-document.tsx`, `lib/pdf/proforma-document.tsx`, `lib/pdf/kardex-document.tsx`, `lib/pdf/reporte-document.tsx`, `lib/pdf/numero-a-literal.ts`, `lib/fechas-bolivia.ts` y las 3 rutas PDF.

**Prueba:** abrir el PDF de una venta, de una proforma y de una cotización → mismo diseño, con la hora correcta. Una cotización con descuento → aparece la columna Descuento. Un documento con muchos ítems → el encabezado de la tabla se repite en la segunda hoja.

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
