# PLAN_7.md — Séptima tanda de tareas (una por una)

> Tareas nuevas del cliente. Se hacen **de a una**: implementar → probar → confirmar → siguiente.
> Armado: 2026-10-06. **Estado: plan armado, nada implementado todavía.**
> **Todo va a los dos entornos:** código a `origin` (jissacruz-prueba) **y** `produccion` (JissaCruz_Project); cada script SQL en la base de **desarrollo y en la de producción**.
> **Una sola rama:** todo el trabajo va directo en `main`. No se crean ramas ni worktrees.

---

## Resumen

| Tarea | Qué pide el cliente | Tamaño | SQL | Estado |
|---|---|---|---|---|
| **T1** | Mostrar la unidad de medida en Proforma | Chica | No | ⏳ Lista para hacer (2 preguntas menores: P1, P2) |
| **T2** | En el formulario de Productos, que en "Medidas" quede solo el campo Etiqueta | Media | Sí — script `44` | ⏳ Decisión cerrada (P3); falta P4 |
| **T3** | Separar Inventario de Kardex: módulos independientes | Media | Opcional — script `45` | ⏳ Paso 1 listo para hacer; paso 2 según P5–P7 |
| **T4** | Diseño de Ventas y Proformas según la imagen de referencia | Grande | No se espera | 🔴 **Bloqueada: la imagen todavía no llegó** (P8, P9) |

Leyenda: ⏳ pendiente · ❓ necesita una decisión · 🔴 bloqueada · ✅ completada.

---

## Preguntas a cerrar con el cliente antes de codificar

Cada una trae mi recomendación. Si no hay respuesta, se sigue la recomendación y se anota acá.

| # | Tarea | Pregunta | Recomendación |
|---|---|---|---|
| **P1** | T1 | ¿La unidad se muestra en la **pantalla** de la proforma, en el **PDF** que se le entrega al cliente, o en los dos? | En los dos. |
| **P2** | T1 | ¿Se muestra el **nombre** ("Pieza", "Kilogramo") o el **código corto** ("PZA", "KG")? | Código corto: entra mejor en la tabla y en el PDF. |
| **P3** | T2 | "Que quede solo Etiquetas": ¿quitar los campos Valor y Unidad y dejar un solo texto libre por fila, o solo cambiar el título del bloque? | ✅ **Cerrada (2026-10-06):** queda solo el campo **Etiqueta**, texto libre (ejemplo del cliente: `110X140X12/2…`). Se quitan Valor y Unidad. |
| **P4** | T2 | Las medidas que **ya están cargadas** (con valor y unidad): ¿se convierten a texto (`A: 45,40MM`) o se borran? | Convertirlas a texto: no se pierde nada. |
| **P5** | T3 | Al entrar a Kardex, ¿qué se ve? **(A)** un buscador de producto y, al elegirlo, sus movimientos; **(B)** lo anterior más filtros por fecha, tipo de movimiento y sucursal. | Empezar por (A) (paso 1, sin SQL) y sumar (B) como paso 2. |
| **P6** | T3 | ¿Quién ve el Kardex? Hoy lo ven los tres roles, **incluida la columna Costo** (lo que se pagó al proveedor). | Mantener los tres roles, pero mostrar Costo **solo al admin**. |
| **P7** | T3 | ¿Inventario conserva el botón "Ver Kardex" de cada producto como atajo? | Sí: son módulos separados, pero el atajo ahorra buscar el producto de nuevo. |
| **P8** | T4 | **Falta la imagen de referencia.** | Enviarla para poder planificar T4. |
| **P9** | T4 | ¿"Diseño de Ventas, Proformas" es el de las **pantallas** (POS y formulario de proforma) o el de los **documentos PDF** (nota de venta y proforma impresas)? ¿Aplica también a Cotización S/F y a Caja? | Se define al ver la imagen. |

---

## Orden de ejecución recomendado

1. **T1** — chica, sin SQL.
2. **T3 · paso 1** — separar los módulos, sin SQL.
3. **T2** — necesita cerrar P4 y trae el script `44`.
4. **T3 · paso 2** — filtros y saldo calculado en la base (script `45`), si se aprueba.
5. **T4** — cuando llegue la imagen. Es la más grande.

**Ojo con T1 y T4:** las dos tocan las filas de ítems de la proforma. Si la imagen de T4 llega pronto, conviene hacer de T1 solo la parte de datos y PDF, y ubicar la unidad en pantalla dentro del diseño nuevo, para no maquetarla dos veces.

### Scripts SQL de esta tanda

La base está en el **43** (✅ corrido en dev + prod el 2026-09-27). Lo nuevo:

- `44_producto_etiquetas.sql` — T2. **⏳ no escrito.**
- `45_kardex_consulta.sql` — T3 paso 2, solo si se aprueba. **⏳ no escrito.**

Cada script va en dev, en prod y reflejado en `supabase/produccion_setup.sql` (insertado por orden de dependencia).

---

## T1 — Unidad de medida en Proforma ⏳

**Qué pide:** mostrar la unidad de medida en "Proforma".

**Cómo está hoy**

- **Alta** (`proformas/proforma-form.tsx`): en los resultados de búsqueda la unidad aparece chica debajo del precio (`/ Pieza`), y **solo si no es la unidad por defecto** `"unidad"`. En las filas de ítems ya agregados **no aparece**: solo código y descripción.
- **Edición y lectura** (`proformas/[id]/proforma-detalle.tsx`): **no aparece en ningún lado**. `obtenerProformaDetalle` ni siquiera la trae.
- **PDF** (`lib/pdf/proforma-document.tsx`): va pegada a la cantidad (`5 Pieza`) y se omite si es `"unidad"`.
- **Cotización S/F** ya la muestra en cada línea (`Unidad: …`, PLAN_4). Es el patrón a copiar.

**Plan**

1. **Datos.** Sumar la unidad al ítem del formulario (`proformaItemSchema` en `lib/validations/proforma.ts`, como dato de pantalla igual que `codigo` y `descripcion`: no se guarda) y a `ProformaDetalleItem` (`proformas/actions.ts`: agregar la unidad al `select` de `productos`).
2. **Código corto (si P2 = código).** `fn_buscar_productos` devuelve la fila completa de `productos`, que incluye `unidad_medida_id`; el código (`PZA`, `KG`) se resuelve con `getUnidadesActivas()` de `lib/datos-cacheados.ts`, que ya está cacheado. Si el producto no tiene unidad del catálogo, se muestra el texto `unidad_medida`. Sin SQL.
3. **Pantalla — alta.** Mostrar la unidad **siempre** (también cuando es `"unidad"`) en los resultados y en cada fila de ítems.
4. **Pantalla — edición y lectura.** Lo mismo en `proforma-detalle.tsx` (resultados, ítems editables y vista de solo lectura).
5. **PDF.** Mostrarla siempre. La tabla ya tiene 7 columnas ajustadas, así que se recomienda dejarla junto a la cantidad (`5 PZA`) en vez de abrir una columna nueva. **El documento es compartido con la Cotización S/F** (`variante="cotizacion"`): el cambio le llega también.

**⚠️ Dato a revisar antes de dar T1 por buena.** La carga de catálogos crea los productos con `unidad_medida = 'unidad'`, y por eso hoy la pantalla la esconde. Al mostrarla siempre, esos productos van a decir "unidad". Además, `fn_guardar_producto` **no deja cambiar la unidad de un producto que ya tiene movimientos de stock** (guarda R1 del script 24), así que no se arregla desde el formulario. Correr este diagnóstico en prod:

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

Si la mayoría sale sin unidad del catálogo, hay que decidir con el cliente cómo asignarlas (una lista por línea/marca y un script de carga única). Eso es un trabajo de datos aparte de T1.

**No cambia:** la unidad no se guarda en `proforma_items`; siempre se muestra la unidad actual del producto.

**Archivos:** `lib/validations/proforma.ts`, `proformas/actions.ts`, `proformas/proforma-form.tsx`, `proformas/[id]/proforma-detalle.tsx`, `lib/pdf/proforma-document.tsx`, `app/api/pdf/proforma/[id]/route.tsx` y `app/api/pdf/cotizacion/[id]/route.tsx` (si se usa el código corto).

**SQL:** ninguno.

**Prueba:** Nueva proforma → buscar un producto → se ve su unidad en el resultado y en la fila al agregarlo. Abrir una proforma existente → se ve en lectura y en edición. PDF → cada línea trae la unidad. Probar un producto en KG y uno con la unidad por defecto.

---

## T2 — En "Medidas" queda solo el campo Etiqueta (formulario de Productos) ⏳

**Qué pide:** en el formulario del CRUD de productos, que el dato "Medidas" quede solo con la Etiqueta.

**Decisión cerrada (2026-10-06, con captura del formulario):** de las tres columnas del bloque Medidas (Etiqueta, Valor, Unidad) **queda solo Etiqueta**, como texto libre. El cliente escribe ahí la medida completa, por ejemplo `110X140X12/2…`. Se quitan **Valor** y **Unidad**.

*Interpretación mía, a confirmar al probar:* el bloque se sigue llamando "Medidas" y se sigue mostrando como `Medidas: …` en el resto del sistema, porque lo que se escribe sigue siendo una medida. Lo único que desaparece son los dos campos.

**Por qué hace falta:** hoy el formulario exige un Valor mayor a 0 y una Unidad. Para escribir la medida como texto hay que inventar un número; con el Valor en 0, como en la captura, no deja guardar.

**Cómo está hoy**

- El bloque **Medidas** de `productos/producto-form.tsx` tiene tres campos por fila: **Etiqueta** (`A`, `B`…), **Valor** (número) y **Unidad** (`MM` / `CM` / `PULG`).
- Tabla `producto_medidas`: `etiqueta text not null`, `valor numeric(12,2) not null check (valor > 0)`, `unidad text not null default 'MM'`, `orden`, y `unique (producto_id, etiqueta)`.
- `fn_guardar_producto` (versión vigente en el repo: script `37`) inserta los tres campos y convierte `valor` a número.
- `fn_buscar_productos` (versión vigente en el repo: script `34`), criterio `medida`: busca sobre `etiqueta + valor + unidad` y cambia la coma decimal por punto.
- Se muestran como `Medidas: A: 45,40MM  B: 17,00MM` (`lib/medidas.ts`) en los resultados de búsqueda de **POS, Proforma, Cotización, Compras y Pedidos**, y en los **PDF de proforma, venta y cotización**.

**Qué se pierde:** hoy las medidas son números con unidad, decisión cerrada en el Sprint 6 (Q2). Como texto ya no se valida que sean números. La búsqueda sigue funcionando: encuentra lo que el texto contenga.

**Queda abierta P4:** qué hacer con las medidas ya cargadas con valor y unidad. Recomendación: convertirlas a texto (`A: 45,40MM`), así no se pierde nada.

**Plan**

*Base de datos — script `44_producto_etiquetas.sql`*

1. `producto_medidas.valor` y `unidad` pasan a aceptar `null` (se sacan el `not null` y el default). La tabla y las columnas **no se renombran ni se borran**: menos riesgo.
2. `fn_guardar_producto`: `valor` y `unidad` pasan a ser opcionales; si no llegan, quedan en `null`. Así la versión publicada sigue guardando como hoy hasta que se despliegue la nueva.
3. `fn_buscar_productos`, criterio `medida`: busca sobre el texto de la etiqueta (y sobre valor y unidad mientras queden filas viejas), aceptando la coma tal como se escribe. El id del criterio (`medida`) no cambia.
4. **Conversión de lo ya cargado (si P4 = convertir):** `etiqueta` pasa a `A: 45,40MM` y `valor`/`unidad` quedan en `null`, para que correrlo dos veces no duplique nada.

⚠️ **Antes de reescribir las dos funciones, confirmar qué versión corre de verdad** en dev y en prod (`select prosrc from pg_proc where proname in ('fn_guardar_producto','fn_buscar_productos')`). El repo ya tuvo definiciones en conflicto.

*Aplicación*

5. `lib/validations/producto.ts`: `medidaSchema` queda solo con `etiqueta`.
6. `productos/producto-form.tsx`: cada fila del bloque Medidas es **un solo campo de texto** (más el botón de borrar). Se ajusta el mensaje de error.
7. `lib/medidas.ts`: el tipo pasa a `{ etiqueta }` y el formateo a unir las etiquetas con un separador. Las pantallas y los PDF que muestran `Medidas: …` usan ese helper, así que cambian solos.
8. Ajustar los `select` y tipos que piden `valor` y `unidad`: `productos/actions.ts`, `lib/producto-busqueda-server.ts` y las rutas PDF de proforma, venta y cotización.

**Orden al desplegar (importante).** Los puntos 1–3 son compatibles con la versión publicada. La conversión de datos (punto 4) no: la versión vieja mostraría mal las medidas convertidas. Entonces: correr 1–3 en prod → desplegar el código → **recién ahí** correr la conversión.

**Archivos:** `supabase/44_producto_etiquetas.sql`, `supabase/produccion_setup.sql`, `lib/validations/producto.ts`, `lib/medidas.ts`, `lib/producto-busqueda-server.ts`, `productos/producto-form.tsx`, `productos/actions.ts` y las 3 rutas PDF (`app/api/pdf/proforma/[id]`, `venta/[id]`, `cotizacion/[id]`).

**Diagnóstico previo (prod):** cuántas medidas hay cargadas y con qué etiquetas, para decidir P4 con datos.

```sql
select count(*) as medidas, count(distinct producto_id) as productos
from public.producto_medidas;

select etiqueta, unidad, count(*) from public.producto_medidas
group by 1, 2 order by 3 desc limit 30;
```

**Prueba:** Editar un producto → en Medidas cada fila es un solo campo → escribir `110X140X12/2` → guarda sin pedir valor ni unidad → reabrir y sigue ahí. Buscar `110X140` con el criterio Medidas marcado → lo encuentra. POS, Proforma y PDF muestran `Medidas: 110X140X12/2`. Un producto que tenía medidas viejas las conserva como texto.

---

## T3 — Inventario y Kardex como módulos independientes ⏳

**Qué pide:** separar Inventario de Kardex.

**Cómo está hoy**

- El menú tiene **un solo ítem**, "Inventario / Kardex", que abre `/inventario`: la lista de stock por sucursal, con un botón por fila para ver el kardex y, para el admin, el ajuste de stock.
- `/kardex` existe como página, pero **solo funciona si se llega desde Inventario** (`/kardex?producto=…`). Entrando directo dice "Seleccioná un producto desde Inventario". No tiene ítem de menú ni título propio en el encabezado.
- El kardex mezcla todas las sucursales del producto y muestra la columna **Costo** a los tres roles. El PDF del kardex (`/api/pdf/kardex`) tampoco chequea rol.
- **Problema latente:** el saldo de cada fila se calcula en la aplicación recorriendo todos los movimientos (`calcularSaldo` en `lib/kardex.ts`). La API devuelve como máximo 1000 filas, así que un producto con más de 1000 movimientos mostraría el kardex cortado, sin los movimientos más recientes. Lo mismo el PDF.

**Plan — paso 1: separar (sin SQL)**

1. **Menú** (`components/shared/nav-items.ts`): dos ítems en el grupo Inventario — **Inventario** (`/inventario`) y **Kardex** (`/kardex`), cada uno con su ícono. El título del encabezado sale solo de esa lista.
2. **Kardex con entrada propia:** al abrir `/kardex` sin producto, un buscador de productos (misma RPC `fn_buscar_productos` y el mismo componente de criterios que el resto) y, al elegir uno, sus movimientos. Con un botón para volver a buscar otro. Sigue el patrón de módulo: `page.tsx` + `kardex-explorer.tsx` + `actions.ts`.
3. **Inventario** queda como lista de stock + ajuste (admin). Conserva o pierde el botón "Ver Kardex" según P7.
4. **Roles** según P6: `requireRol` en la página y, si Costo queda solo para admin, ocultar la columna en pantalla, en el Excel y en el PDF (la ruta PDF tiene que chequear el rol, porque se puede abrir directo).
5. **Documentación:** `UI_UX.md` (§3 navegación y §4.4), `FLUJO.md` §10, `CLAUDE.md` y el manual de usuario.

**Plan — paso 2: filtros y saldo en la base (script `45`, si se aprueba P5-B)**

6. RPC `fn_kardex_producto(producto, desde, hasta, sucursal)` que devuelve el **saldo anterior** al rango y los movimientos con el saldo ya calculado en SQL. Resuelve el tope de 1000 filas y permite filtrar por fecha sin que el saldo arranque en cero.
7. Filtros en pantalla: rango de fechas, tipo de movimiento y sucursal. Con sucursal elegida, el saldo es el de esa sucursal.
8. El PDF y el Excel respetan los filtros.

**Archivos (paso 1):** `components/shared/nav-items.ts`, `app/(dashboard)/kardex/page.tsx`, `kardex/kardex-view.tsx`, `kardex/kardex-explorer.tsx` (nuevo), `kardex/actions.ts` (nuevo), `inventario/inventario-explorer.tsx`, `app/api/pdf/kardex/route.tsx`, `lib/pdf/kardex-document.tsx`.

**SQL:** paso 1 ninguno. Paso 2: `45_kardex_consulta.sql`.

**Prueba:** El menú muestra Inventario y Kardex por separado. Kardex → buscar un producto → ver sus movimientos → exportar PDF y Excel. Inventario → lista de stock y ajuste (admin). Como vendedor y como cajero: verificar qué ven según P6.

---

## T4 — Diseño de Ventas y Proformas según la imagen de referencia 🔴

**Qué pide:** rediseñar Ventas y Proformas de acuerdo a una imagen de referencia.

**Bloqueada:** la imagen no llegó con el pedido. Sin ella no se puede definir alcance ni tamaño. Tampoco está claro si se refiere a las pantallas o a los documentos impresos (P9).

**Cómo está hoy** (para comparar contra la imagen cuando llegue)

- **POS** (`ventas/pos.tsx`), una sola columna: cliente opcional → buscador con criterios → resultados en filas con botón Agregar → tabla del pedido (N°, Cant., Código / Detalle, P. Unit., Importe) → impuesto y totales → botón "Enviar a caja".
- **Proforma — alta** (`proformas/proforma-form.tsx`), una sola columna: cabecera (cliente, tipo de pago, tiempo de entrega) → buscador → resultados → tabla de ítems igual a la del POS, con precio editable hacia arriba → impuesto, glosa y totales → "Crear proforma".
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

Detectado el 2026-10-06 al revisar el repo. No forma parte de T1–T4; se hace si el cliente lo pide.

- **Logo en el PDF de cotización:** la ruta `/api/pdf/cotizacion/[id]` no está en `outputFileTracingIncludes` de `next.config.mjs`, así que en producción puede salir sin logo. No comprobado: se confirma abriendo un PDF de cotización en producción.
- **README desactualizados:** a `supabase/README.md` le faltan las filas de los scripts 35–40; el `README.md` raíz nombra un `.env.local.example` que no existe y manda a instalar con `00_setup_completo.sql` en vez de `produccion_setup.sql`.
