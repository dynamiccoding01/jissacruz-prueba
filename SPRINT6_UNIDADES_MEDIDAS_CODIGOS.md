# SPRINT 6 — Cambios pedidos por el cliente (reunión del 26 jul 2026)

**Cliente:** JISSACRUZ · **Origen:** reunión del **26 jul 2026**, posterior al Sprint 5.
**Estado:** diseño cerrado y validado con el cliente. **NADA implementado todavía — no se tocó una sola línea de código ni de la BD.**
**Análisis verificado contra la BD real** `laedzzghoddjoxzjsfkb` y contra el código en `main`, commit `d88efdd`.

---

## 📖 Cómo usar este documento

Este documento es **autosuficiente**: contiene el análisis del estado actual, todas las decisiones ya tomadas con el cliente, los riesgos detectados y el plan paso a paso. Está escrito para que **cualquier dev (o Claude Code) pueda ejecutarlo sin haber estado en la conversación original**.

**Reglas para quien lo tome:**

1. **Las decisiones marcadas ✅ ya están cerradas con el cliente. No volver a preguntarlas ni re-discutirlas.** Cada una tiene su justificación al lado.
2. **Solo queda 1 pregunta abierta en todo el documento: `Q6`** (§7) — cuántos códigos originales entran en el PDF. Si nadie la responde, aplicar la recomendación (tope de 5 + "…").
3. Antes de escribir código, leer **[CLAUDE.md](CLAUDE.md)** (reglas del proyecto) y la columna *Estado* de **[PLAN.md](PLAN.md)**.
4. **Los riesgos R1–R14 (§5, §5bis) no son teoría**: cada uno tiene archivo y línea. Leerlos antes de tocar el área correspondiente.
5. Acceso a la BD: credenciales en `.env.local` (fuera de git). El esquema se consulta con el `SUPABASE_ACCESS_TOKEN` vía Management API, o con el `service_role` vía REST.

---

## 🗺️ Mapa del documento

| Parte | Contenido | Estado del diseño | Esfuerzo |
|---|---|---|---|
| **I** (§0–§10) | Unidades de medida · medidas estructuradas · códigos originales | ✅ Cerrado (1 pregunta abierta: Q6) | ~4,5 días |
| **II** (F1–F4) | Acentos en la búsqueda · traspasos (análisis) · Enter agrega al carrito · quitar descuento por % | ✅ Cerrado | ~2 días |
| **III** | Rediseño del módulo **Pedido** (ex Traspasos): se invierte el flujo | ✅ Cerrado | ~2,5 días |
| **IV** | **Proformas**: vigencia de 3 días, estado `pendiente`, detalle, edición | ✅ Cerrado | ~2,5 días |
| | | **Total** | **≈ 11,5 días** (2 devs, sin UAT) |

## ⚙️ Orden de ejecución recomendado (de menor a mayor riesgo)

```
1. F1  · acentos en la búsqueda          🟢 chico, aislado, arregla un bug que hoy bloquea el POS
2. F4  · quitar descuento por porcentaje 🟢 chico, aislado
3. F3  · Enter agrega al carrito         🟢 chico, solo frontend
4. R8  · guardado transaccional de producto 🔴 ANTES de la Parte I (protege los 810 códigos)
5. Parte IV · Proformas                  🟡 medio
6. Parte III · Pedido                    🟡 medio
7. Parte I  · unidades / medidas / códigos 🟠 el más grande
```

## 🔢 Asignación de números de script SQL (¡respetar!)

El último script del repo es el `21`. **Para que dos devs trabajando en paralelo no choquen, los números ya están asignados:**

| Script | Bloque | Qué hace |
|---|---|---|
| `22_codigos_originales.sql` | Parte I · Fase 1 | Tabla de códigos originales + migración de los 810 + quitar `fabricante` |
| `23_producto_medidas.sql` | Parte I · Fase 2 | Tabla de medidas |
| `24_unidades_medida.sql` | Parte I · Fase 3 | Catálogo de unidades (vacío) + FK en productos |
| `25_busqueda_original_medida.sql` | Parte I · Fase 4 | Criterios `original` y `medida` en `fn_buscar_productos` |
| `26_busqueda_unaccent.sql` | Parte II · F1 | Acentos ignorados en `fn_buscar_productos` |
| `27_proformas_vigencia.sql` | Parte IV | `revalidada_en` + vista con 3 estados + validación en la RPC de conversión |
| `28_pedidos_flujo.sql` | Parte III | Inversión del flujo + `cantidad_solicitada` + RPC de modificación + permisos |

> ⚠️ **Coordinación obligatoria entre devs:** los scripts **25 y 26 reescriben la MISMA función** (`fn_buscar_productos`). **Los tiene que hacer la misma persona, en orden, o fusionarlos en un solo script.** Si dos personas los escriben por separado, el segundo pisa al primero. Este proyecto ya tuvo que reconciliar trabajo en paralelo dos veces (ver PLAN.md, 18 jul) y hay un caso real de función pisada documentado en **F1**.

---

> ✅ **Decisión de arquitectura que define la Parte I (confirmada por el cliente el 26 jul):**
> **Un producto tiene UNA unidad de medida y se vende SOLO en esa unidad.** Si un producto está registrado en docenas, se compra en docenas, se stockea en docenas y se vende en docenas.
>
> **Consecuencia: NO hay conversión de unidades.** El stock, el kardex, el FIFO, el precio y el costo hablan todos el mismo idioma — el del producto. **El núcleo de inventario no se toca: cero cambios en `kardex_movimientos`, `producto_stock_sucursal`, `fn_fifo_consumir`, el trigger de cache de stock y las 6 RPC de movimiento.**
>
> *(Se evaluó y descartó el modelo multi-unidad con factor de conversión: implicaba reescribir 6 RPC, 7 fases, ~8,5 días y riesgo alto. Ver §6 para por qué se descartó y qué se pierde.)*

---

## 0. Los 3 cambios

| # | Cambio | Qué es | Riesgo |
|---|---|---|---|
| **A** | Tabla **`producto_codigos_originales`** | Códigos del fabricante original (OEM). Un producto tiene N. Incluye **migrar los 810 "equivalentes OEM"** mal clasificados. | 🟢 Bajo |
| **B** | Tabla **`producto_medidas`** | Medidas etiquetadas del producto (`A: 45,40MM  B: 17,00MM`). Estructurada, no texto libre. | 🟢 Bajo |
| **C** | Tabla **`unidades_medida`** + FK en productos | Catálogo administrable (pieza, docena, juego…). Reemplaza el texto libre actual. **Sin conversión.** | 🟡 Medio-bajo |

**Descartado explícitamente por el cliente:** código de barras y segundo código de producto → **el producto sigue teniendo un solo `codigo`**.

### Los 3 niveles de código (modelo final)

| Nivel | Qué es | Dónde vive | Cardinalidad |
|---|---|---|---|
| Código de tienda | Código propio de JISSACRUZ (`VADE0676`, `TKL31012A`) | `productos.codigo` (ya existe) | 1 |
| **Código original** | Código del **fabricante original (OEM)** de la pieza | `producto_codigos_originales` (**nueva**) | N |
| Código equivalente | Código de **otro fabricante** que hace la misma pieza | `producto_codigos_equivalentes` (ya existe) | N |

---

## 1. Estado de partida verificado en la BD real

Comprobado con consultas al proyecto Supabase, no supuesto:

| Dato | Valor | Por qué importa |
|---|---|---|
| Productos | **239** | Universo a migrar: chico |
| `productos.unidad_medida` | **texto libre; los 239 dicen `'unidad'`** | La migración al catálogo es trivial |
| `producto_codigos_equivalentes` | **810 filas, las 810 con `fabricante = 'OEM'`** | **Todas son códigos ORIGINALES mal clasificados** (carga del catálogo TKL del 19 jul) |
| Productos con medidas en la descripción | 9 de 239 | La carga de medidas es trabajo de datos del cliente, no automatizable |
| Integridad de stock (cache vs kardex vs lotes FIFO) | **0 desajustes** | Punto de partida sano. Este sprint no lo toca, así que debe seguir en 0 |
| Traspasos en estado `enviado` | 2 (stock en tránsito) | Ya no bloquea nada — este sprint no toca movimientos |

---

## 2. Modelo de datos nuevo

### 2.1 Cambio A — Códigos originales

```sql
create table public.producto_codigos_originales (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos(id) on delete cascade,
  codigo_original text not null,
  creado_en       timestamptz not null default now(),
  unique (producto_id, codigo_original)
);
create index idx_codigos_originales_codigo on public.producto_codigos_originales (codigo_original);
```

RLS: espejo exacto de `producto_codigos_equivalentes` → `select` autenticados, `insert/update/delete` solo admin.

> ✅ **Sin columna `fabricante`** (decisión del cliente, 26 jul — **Q1**). Y se **elimina también de `producto_codigos_equivalentes`**: ambas tablas guardan solo el código. Verificado: `fabricante` existe únicamente en esa tabla, con las 810 filas en `'OEM'` (un relleno, no un fabricante real). Formulario más simple: una sola columna de input por fila en vez de dos.

### 2.2 Cambio B — Medidas estructuradas

```sql
create table public.producto_medidas (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  etiqueta    text not null,                       -- 'A', 'B', 'DIÁMETRO', 'LARGO'
  valor       numeric(12,2) not null check (valor > 0),
  unidad      text not null default 'MM',          -- MM, CM, PULG
  orden       smallint not null default 0,         -- para renderizar A antes que B
  unique (producto_id, etiqueta)
);
create index idx_producto_medidas_producto on public.producto_medidas (producto_id);
```

Render en UI y PDF: concatenar por `orden` → `A: 45,40MM  B: 17,00MM` (formato `es-BO`, coma decimal).
RLS: `select` autenticados, escritura solo admin.

> ✅ **`etiqueta` queda obligatoria (decisión del cliente, 26 jul — Q2):** el usuario **siempre pone la letra**, incluso cuando el catálogo original no la traía (`VADE0676` → `(88MM)` se carga como `A: 88MM`). Se mantiene `etiqueta text not null` y `unique (producto_id, etiqueta)` — modelo más simple y sin casos especiales en el renderizado. *(Si más adelante aparece un producto con dos medidas que nadie sabe etiquetar, se revisa: pasar `etiqueta` a nullable es un cambio chico y no destructivo.)*

### 2.3 Cambio C — Unidades de medida (catálogo, sin conversión)

```sql
create table public.unidades_medida (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,        -- 'PZA','DOC','JGO','PAR','CAJ'
  nombre      text not null,               -- 'Pieza','Docena','Juego'
  abreviatura text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

alter table public.productos
  add column unidad_medida_id uuid references public.unidades_medida(id) on delete restrict;
```

**La tabla se crea VACÍA** (decisión del cliente): las unidades reales las carga el admin desde el ABM cuando entregue su lista. Por eso:

- `unidad_medida_id` es **nullable** en este sprint (no hay con qué backfillear).
- **`productos.unidad_medida` (texto) NO se borra todavía.** Convive con la FK: la UI lee `unidad_medida_id` y **cae al texto si la FK está vacía**. Se elimina en el paso final, cuando el catálogo esté cargado y asignado.
- `on delete restrict`: no se puede borrar una unidad que algún producto está usando.

> **No hay tabla de factores ni columnas nuevas en `kardex_movimientos`, `venta_items`, `proforma_items`, `orden_compra_items` ni `pedido_traspaso_items`.** La unidad es un atributo del producto; la cantidad de cada documento ya está expresada en esa unidad.

---

## 3. Plan de ejecución paso a paso

Scripts SQL nuevos, **idempotentes**, en `supabase/`, continuando la numeración (el último es `21`). **Nunca re-correr `00_setup_completo.sql`.**

Las 3 fases son **independientes entre sí** y cada una es entregable por separado.

---

### FASE 1 — Códigos originales `[script 22]` 🟢

**Paso 1.1** · Crear `supabase/22_codigos_originales.sql`. **El orden de estos pasos importa:**
1. `create table if not exists producto_codigos_originales` (§2.1, **sin `fabricante`**).
2. Índice + `enable row level security` + 4 políticas (espejo de equivalentes).
3. **Migración de los 810 — ANTES de borrar la columna `fabricante`.** Verificado: las 810 filas de la tabla son OEM y **no hay ninguna otra**, así que la migración mueve todo sin necesitar discriminador:
   ```sql
   insert into public.producto_codigos_originales (producto_id, codigo_original)
   select producto_id, codigo_equivalente
   from public.producto_codigos_equivalentes
   on conflict (producto_id, codigo_original) do nothing;

   delete from public.producto_codigos_equivalentes;
   ```
4. **Recién ahora** eliminar la columna: `alter table public.producto_codigos_equivalentes drop column fabricante;` (**Q1**).
   ⚠️ Si se borra la columna **antes** del paso 3, se pierde la única marca que distingue estas filas — con los datos actuales no cambia el resultado (son todas OEM), pero deja el script inservible si mañana se re-corre sobre una base con equivalentes reales cargados.
5. Agregar el `unique (producto_id, codigo_equivalente)` que hoy **le falta** a la tabla de equivalentes (verificado: solo tiene PK y FK; **0 duplicados**, entra limpio).
6. `notify pgrst, 'reload schema';` al final (ver riesgo **R4**).

**Paso 1.2** · Verificación obligatoria antes de seguir:
```sql
select (select count(*) from producto_codigos_originales)   as originales,   -- esperado: 810
       (select count(*) from producto_codigos_equivalentes) as equivalentes; -- esperado: 0
```

**Paso 1.3** · Frontend:
- `producto-form.tsx`: sección **“Códigos originales”** (mismo patrón de lista editable que “Códigos equivalentes”), y **quitar el input “Fabricante (opcional)”** de la sección de equivalentes → queda una sola columna por fila.
- `lib/validations/producto.ts`: array `codigos_originales`; **eliminar `fabricante`** del schema de equivalentes.
- `productos/actions.ts`: alta/edición/borrado de los hijos nuevos; **eliminar `fabricante`** del insert y del select.
- `productos/page.tsx` + explorer: traer y mostrar originales y equivalentes **en columnas separadas**.

**Limpieza de `fabricante` — los 5 lugares exactos** (verificado con `grep`): [actions.ts:39](<app/(dashboard)/productos/actions.ts>), [actions.ts:164](<app/(dashboard)/productos/actions.ts>), [producto-form.tsx:217](<app/(dashboard)/productos/producto-form.tsx>), [producto-form.tsx:234](<app/(dashboard)/productos/producto-form.tsx>), [lib/validations/producto.ts:5](lib/validations/producto.ts).

✅ **Checkpoint 1:** el producto muestra sus originales y sus equivalentes por separado, y los 810 quedaron bien clasificados.

---

### FASE 2 — Medidas estructuradas `[script 23]` 🟢

**Paso 2.1** · `supabase/23_producto_medidas.sql`: tabla (§2.2) + índice + RLS + `notify pgrst`.

**Paso 2.2** · Helper de presentación en `lib/medidas.ts` (nuevo):
`formatearMedidas(medidas[]): string` → `"A: 45,40MM  B: 17,00MM"`, ordenado por `orden`, formato `es-BO`. **Se reutiliza en catálogo, POS, proforma y PDFs — no duplicar el formateo en cada pantalla.**

**Paso 2.3** · Frontend:
- `producto-form.tsx`: sección **“Medidas”** — filas con `etiqueta`, `valor` (numérico) y `unidad` (select MM/CM/PULG).
- `lib/validations/producto.ts` + `actions.ts`: igual que en la Fase 1.
- Mostrar las medidas en la fila del catálogo y en los resultados de búsqueda del POS y de proformas (como en el sistema del cliente).

✅ **Checkpoint 2:** se cargan medidas a un producto y se ven en la ficha, el catálogo y el buscador.

---

### FASE 3 — Catálogo de unidades de medida `[script 24]` 🟡

**Paso 3.1** · `supabase/24_unidades_medida.sql` — **solo estructura, SIN datos**:
1. Crear `unidades_medida` + RLS (select autenticados / escritura admin). **Queda vacía.**
2. `alter table productos add column unidad_medida_id` — nullable, `on delete restrict`.
3. **NO borrar `productos.unidad_medida`** (texto). Se elimina en el paso 3.4.
4. `notify pgrst, 'reload schema';`

**Paso 3.2** · ABM de unidades (solo admin): nueva ruta `app/(dashboard)/unidades-medida/` siguiendo el patrón exacto de `sucursales/` (page + explorer + form + actions + `lib/validations/unidad.ts`), e ítem de nav en el grupo **Administración** con `roles: ["admin"]`.
*Alternativa a decidir (**D3**)*: como pestaña dentro de Configuración, para no agrandar el sidebar.

**Paso 3.3** · Frontend:
- `producto-form.tsx`: la unidad pasa de input de texto a **`<Select>`** de unidades activas.
- Etiquetas explícitas donde la unidad da contexto: **“Precio por {unidad}”** y **“Stock mínimo (en {unidad})”**. Barato ahora, evita el malentendido de §5 **R2**.
- Mostrar la unidad en: fila del catálogo, resultados de búsqueda del POS/proforma, columna de inventario, kardex y **tabla de ítems de los PDF** (el modelo del cliente muestra `UNIDAD DE MEDIDA: PIEZAS`).
- **Lectura con fallback:** `unidad_medida_id ?? unidad_medida` mientras conviven las dos columnas.

**Paso 3.4** · **Carga de datos y cierre — NO es parte del script, ocurre después** (cuando el cliente entregue su lista):
1. El admin da de alta las unidades reales desde el ABM.
2. Se asigna la unidad a cada producto (masivo por SQL si son casi todos iguales, o desde la ficha).
3. Script aparte: `set not null` en `productos.unidad_medida_id` y **`drop column productos.unidad_medida`**.

> Mientras el paso 3.4 no ocurra, el sistema funciona exactamente como hoy. **Es un estado intermedio estable**, se puede vivir en él el tiempo que haga falta.

✅ **Checkpoint 3:** el ABM funciona, la ficha de producto usa el select y la unidad se ve en todas las pantallas donde aporta contexto.

---

### FASE 4 — Búsqueda por los campos nuevos `[script 25]` 🟢

**Paso 4.1** · `supabase/25_busqueda_original_medida.sql`: agregar los criterios **`'original'`** y **`'medida'`** a `fn_buscar_productos`, con la misma lógica de fragmentos `ilike all` que ya usa `equivalente`.

> ✅ **Solo cambia el CUERPO de la función, no su firma ni su tipo de retorno** → `create or replace` funciona, **sin `drop`, sin romper los 5 llamadores** (compras, inventario, productos, proformas, ventas). Éste era el riesgo grande del diseño anterior y con el modelo simple desaparece.

Para la **medida**, comparar contra el texto armado `etiqueta || ' ' || valor || ' ' || unidad`, y ⚠️ **normalizar la coma decimal**: el usuario escribe `45,40` y en la BD el valor es `45.40`.

**Paso 4.2** · `components/shared/criterios-busqueda.tsx`: dos checkboxes nuevos, **“Código original”** (`id: "original"`) y **“Medidas”** (`id: "medida"`).
⚠️ **Los `id` deben coincidir carácter por carácter con los que evalúa el SQL** — si no, la búsqueda devuelve 0 resultados **sin error** (riesgo **R5**).

**Paso 4.3** · Enriquecer los resultados de búsqueda con unidad, medidas y códigos originales **sin cambiar el tipo de retorno de la RPC**: consulta adicional por los `id` devueltos, siguiendo el patrón que ya existe en [lib/precios-mayor-server.ts](lib/precios-mayor-server.ts) (`escalasVigentesPorProducto`).

✅ **Checkpoint 4:** buscar por un código OEM lo encuentra con el criterio “Código original”; buscar `45,40` lo encuentra con “Medidas”.

---

### FASE 5 — Verificación y documentación

**Paso 5.1** · Pruebas manuales (no hace falta script de verificación con rollback: **este sprint no toca stock**):
1. Alta y edición de un producto con originales, equivalentes, medidas y unidad.
2. Los 5 criterios viejos + los 2 nuevos, uno por uno.
3. Proforma y venta de un producto con unidad DOCENA → confirmar que el kardex descuenta **1** y que la unidad se ve en el PDF.
4. Intentar **borrar una unidad en uso** → debe fallar con mensaje claro.
5. Reconciliación de control (debe seguir dando **0**, igual que antes del sprint):
   ```sql
   -- cache por sucursal vs kardex · lotes FIFO vs cache · total vs suma por sucursal
   ```

**Paso 5.2** · Documentación (ya hay deuda acumulada, no sumar más):
- `supabase/README.md`: filas 22–25 en la tabla de migraciones incrementales.
- `PLAN.md`: sección Sprint 6 + registro de cambios.
- `BACKEND.md`: **está desactualizado desde el Sprint 5** (no documenta sucursales, stock por sucursal, precios por mayor ni traspasos). Actualizarlo, o marcarlo formalmente como histórico y dejar `supabase/README.md` como única fuente de verdad.
- `00_setup_completo.sql`: sigue sin los scripts 12–14, 16, 20 y 21; ahora se le suman 22–25. **Una instalación desde cero ya no funciona con ese archivo solo.**

---

## 4. Esfuerzo y orden

```
Fase 1 (códigos originales)  ─┐
Fase 2 (medidas)             ─┤ independientes, se pueden hacer en paralelo
Fase 3 (unidades)            ─┘
        │
        ▼
Fase 4 (búsqueda por los campos nuevos)   ← depende de las 3 anteriores
        │
        ▼
Fase 5 (verificación y docs)
```

| Fase | Esfuerzo |
|---|---|
| 1 · Códigos originales | ~0,5 día |
| 2 · Medidas | ~1 día |
| 3 · Unidades | ~1 día |
| 4 · Búsqueda | ~0,5 día |
| **0 · R8** · guardado transaccional del producto vía RPC (**Q4 ✅ aprobado**) | ~0,5 día |
| **PDF** · unidad, originales y medidas en proforma y venta (**Q5 ✅ aprobado**, ver **R14**) | ~0,5 día |
| 5 · Verificación y docs | ~0,5 día |
| **Total** | **≈ 4,5 días** (2 devs, sin UAT) |

⚠️ **El arreglo de R8 va ANTES de la Fase 1**, no después: la Fase 1 es la que carga los 810 códigos originales en el mismo patrón de guardado que puede borrarlos.

---

## 5. Riesgos (los que quedan con el modelo simple)

De los 10 riesgos identificados en la auditoría del 26 jul, **6 desaparecieron al descartar la conversión** (validación de stock en el POS, reportes sumando unidades mixtas, precio/costo desalineados, sobrecarga de `fn_ajuste_stock`, inserts directos rompiéndose, y el `factor` con decimales). Quedan éstos:

### R1 · Cambiar la unidad de un producto que ya tiene movimientos 🔴

**El riesgo propio de este modelo, y el más importante.** Si un producto tiene 8 de stock en PIEZAS y alguien le cambia la unidad a DOCENAS, **el número no cambia pero su significado sí**: pasa a ser 8 docenas. El kardex histórico queda mintiendo y no hay forma automática de saber qué quiso decir cada movimiento.

**Mitigación:** **bloquear el cambio de unidad si el producto tiene movimientos en el kardex** (o exigir stock 0 y confirmación explícita del admin). Validar en la Server Action, no solo en el formulario.

### R2 · El significado de `precio` y `stock_minimo` depende de la unidad 🟠🔇

`lib/reportes.ts:224` valoriza el inventario con `stock_actual × precio` y compara `stock_actual <= stock_minimo`. Ambos son coherentes **siempre que el precio sea el precio de la unidad del producto**. Si alguien registra un producto en DOCENAS pero carga el precio de la pieza, la valorización queda **÷12** sin que nada se queje.

**Mitigación:** las etiquetas explícitas del paso 3.3 (*“Precio por DOCENA”*, *“Stock mínimo (en DOCENAS)”*) + una línea en el manual de usuario.

### R3 · Convivencia temporal de `unidad_medida` (texto) y `unidad_medida_id` (FK) 🟡

Entre la Fase 3 y el paso 3.4 hay dos fuentes para el mismo dato.
**Mitigación:** la UI siempre lee `unidad_medida_id ?? unidad_medida`, y el paso 3.4 borra la columna de texto. **No dejar esta deuda abierta indefinidamente** — es exactamente el patrón que dejó a `productos.stock_actual` como “total transicional” desde el Sprint 5, todavía sin resolver.

### R4 · Caché de esquema de PostgREST 🟡

Tras el DDL, la API puede seguir sin ver las tablas/columnas nuevas y responder *“column does not exist”*, dando la falsa impresión de que el script falló.
**Mitigación:** `notify pgrst, 'reload schema';` al final de cada script.

### R5 · `id` de criterios de búsqueda desalineados entre TSX y SQL 🟠🔇

El fallo es **silencioso**: devuelve 0 resultados, no error.
**Mitigación:** probar cada checkbox nuevo inmediatamente después de correr el script 25.

### R6 · La migración de los 810 es la única operación que modifica datos existentes 🟡

**Mitigación:** es reversible con el `insert` inverso (los datos no se pierden, cambian de tabla), pero conviene **snapshot del proyecto Supabase antes de correr el script 22**. Barato y cierra el tema.

### R7 · No hay suite de tests 🟠

La única red histórica son los scripts de verificación SQL. Con este alcance el riesgo baja mucho (nada toca stock), pero la Fase 5 sigue siendo obligatoria — así aparecieron los dos bugs críticos de traspasos (scripts 20 y 21): en prueba manual, no en revisión de código.

---

## 5bis. Riesgos encontrados en la segunda auditoría del código (26 jul)

### R8 · 🔴🔴 `updateProducto` borra los hijos y los reinserta **sin transacción** — puede perder los 810 códigos OEM

**Evidencia:** [app/(dashboard)/productos/actions.ts:131-141](<app/(dashboard)/productos/actions.ts>)

```ts
// reemplaza los hijos por el set actual del formulario
await supabase.from("producto_codigos_equivalentes").delete().eq("producto_id", id)
await supabase.from("producto_vehiculos_compatibles").delete().eq("producto_id", id)
await supabase.from("producto_precios_mayor").delete().eq("producto_id", id)

try {
  await guardarHijos(...)          // ← si esto falla, los delete YA se aplicaron
} catch (e) { return { error: ... } }
```

**Qué pasa:** son llamadas HTTP independientes, **sin transacción**. Los tres `delete` **no verifican error** (no capturan el `error` que devuelven). Si `guardarHijos` falla —validación, RLS, un corte de red—, los borrados **ya están confirmados** y el producto queda **sin equivalentes, sin vehículos y sin precios por mayor**, de forma permanente.

**Por qué este sprint lo empeora, y bastante:**
1. Se suman **dos colecciones hijas más** (originales y medidas) al mismo patrón.
2. Una de ellas contiene los **810 códigos OEM que salieron de parsear un PDF de 67 páginas**. Perderlos en un producto significa **no poder recuperarlos** salvo re-parseando el catálogo.
3. ⚠️ **El `unique` que yo mismo propongo en §2.1 y en la Fase 1 aumenta la probabilidad de que el bug se dispare**: si el admin tipea dos veces el mismo código original en el formulario, el `insert` ahora **falla por la restricción única**… después de que el `delete` ya borró todo.

**Mitigación mínima (obligatoria antes de la Fase 1):**
- Deduplicar las listas hijas en el schema zod **antes** de tocar la BD (mata el disparador más probable).
- Verificar el `error` de los tres `delete`.

**Mitigación correcta:** mover el guardado completo a una RPC transaccional `fn_guardar_producto(p_id uuid, p_payload jsonb)`. Es además lo que manda la regla del propio proyecto (*“toda operación crítica pasa por funciones RPC transaccionales”*, CLAUDE.md) — hoy el guardado de producto es la excepción. Ver pregunta **Q4**.

### R9 · 🟠🔇 Los criterios nuevos no entran en el arreglo por defecto → nunca se buscan

**Evidencia:** [supabase/15_busqueda_anidada.sql](supabase/15_busqueda_anidada.sql), dentro de `fn_buscar_productos`:

```sql
v_campos := coalesce(
  nullif(p_campos, '{}'::text[]),
  array['codigo', 'descripcion', 'equivalente', 'linea_marca', 'vehiculo']
);
```

**Qué pasa:** cuando el usuario no marca ningún criterio, la función usa ese arreglo. Si se agregan `'original'` y `'medida'` a la cláusula `where` **pero no a este arreglo**, la búsqueda "en todos los campos" **jamás mira** códigos originales ni medidas. Falla **silenciosa**: 0 resultados, sin error.

**Mitigación:** agregar los dos criterios al arreglo por defecto en el script 25. Trivial, pero es exactamente el tipo de línea que se olvida.

### R10 · ~~🔴~~ ⚪ **CERRADO** — el sistema está en desarrollo, no hay usuarios que sufran la regresión

**Riesgo original:** al migrar los 810, `producto_codigos_equivalentes` queda vacía, así que buscar el OEM `9730025210` con el criterio “Equivalentes” marcado pasaría a devolver 0 resultados.

**Resolución (cliente, 26 jul):** el sistema **aún está en desarrollo y sin usuarios en producción**, así que no hay regresión que gestionar. **No hace falta que “Código original” venga tildado por defecto** ni avisar a nadie de la reclasificación. Se agregan los dos checkboxes y listo (**Q3**).

⚠️ **Sigue en pie R9**: los criterios nuevos **deben entrar en el arreglo por defecto del SQL**. Eso no es cosmético — sin eso, la búsqueda "en todos los campos" nunca mira originales ni medidas.

### R11 · 🟠 Multiplicación de filas en la búsqueda: 5 `LEFT JOIN` + `select distinct p.*`

**Evidencia:** `fn_buscar_productos` hoy hace 3 `LEFT JOIN` (equivalentes, compatibilidades, vehículos) y deduplica con `select distinct p.*`. Agregar los criterios de originales y medidas suma **2 joins más**.

**Qué pasa:** el producto con 8 originales × 5 equivalentes × 3 vehículos × 2 medidas genera **240 filas intermedias** que el `DISTINCT` después colapsa a 1. Con 239 productos hoy es tolerable; a medida que crezca el catálogo, la búsqueda del POS —que corre en cada tecleo— se degrada.

**Mitigación:** reescribir los criterios de tablas hijas como subconsultas **`EXISTS (...)`** en lugar de `LEFT JOIN` + `DISTINCT`. Sin multiplicación de filas, sin `DISTINCT`, y es una **mejora neta sobre el código actual**. Se hace en el mismo script 25, sin costo adicional. *(Ya hay una nota vieja en PLAN.md sobre índices `pg_trgm` que sigue pendiente y aplica al mismo problema.)*

### R12 · 🟡 Consultas por tecleo en el POS

**Evidencia:** [app/(dashboard)/ventas/actions.ts:47-74](<app/(dashboard)/ventas/actions.ts>) — hoy son 1 RPC + 2 consultas en `Promise.all` (escalas de precio y stock por sucursal).

**Qué pasa:** el POS de mostrador tiene que ser rápido. Sumar unidad + medidas + originales de forma ingenua lo lleva a 6 consultas por tecleo.

**Mitigación:**
1. Meter las consultas nuevas **dentro del `Promise.all` existente**, nunca en serie.
2. El **catálogo de unidades es diminuto** (~5 filas) → cachearlo por request en [lib/datos-cacheados.ts](lib/datos-cacheados.ts), que ya existe para la configuración de empresa. **Cero consultas extra por búsqueda.**

### R13 · ~~🟠~~ ⚪ **CERRADO** — el usuario pone la letra a mano (Q2)

**Evidencia:** en la imagen del sistema del cliente, el producto `VADE0676` tiene la descripción *“CULATA COMPRESOR KNORR LK4941 LP4965 SCANIA SERIE 4 PGRT **(88MM)**”* — una medida **sin etiqueta A/B**, embutida en la descripción. En cambio `HCZ-205` sí usa *“A: 45,40MM B: 17,00MM”*.

**Qué pasa:** el modelo de §2.2 tiene `etiqueta text not null` + `unique (producto_id, etiqueta)`. Con una medida sin etiqueta, el admin se ve forzado a inventar una, y si un producto tuviera dos medidas sin etiqueta, el `unique` las rechaza.

**Resolución (cliente, 26 jul):** **no se cambia el modelo.** `etiqueta` queda obligatoria y el usuario escribe la letra al cargar la medida (`(88MM)` → `A: 88MM`). Se mantiene `unique (producto_id, etiqueta)`, que además impide cargar dos veces la misma letra en un producto. Si en el futuro aparece un caso que no se puede etiquetar, pasar `etiqueta` a nullable es un `alter` chico y no destructivo.

### R14 · 🟠 No caben más columnas en la tabla de ítems del PDF

**Evidencia:** [lib/pdf/proforma-document.tsx:46-52](lib/pdf/proforma-document.tsx) — las 7 columnas actuales ya suman **exactamente el 100%** del ancho:

```
N° 5%  ·  Cantidad 10%  ·  Código 15%  ·  Línea 15%  ·  Detalle 30%  ·  P.Unit 12%  ·  Importe 13%
```

**Qué pasa:** el cliente pidió (**Q5**) que unidad, códigos originales y medidas salgan también en el PDF. Como **columnas nuevas no entran** — y menos una que puede traer 8–10 códigos OEM por producto (`1376274 1424766 1424768 K014896 K016615 K012799 II32688 K003960`).

**Mitigación — copiar el layout que el propio cliente usa en pantalla**, que apila la info dentro de una celda:
1. **Unidad** → dentro de la celda **CANTIDAD**: `12 PZA`. Compacto y natural, sin columna nueva.
2. **Códigos originales y medidas** → **líneas secundarias dentro de DETALLE** (ampliando `cDetalle` de 30% a ~40% a costa de Código/Línea), igual que la pantalla del cliente:
   ```
   LINEA: VADEN
   CULATA COMPRESOR KNORR LK4941 LP4965 SCANIA SERIE 4 PGRT
   MEDIDAS: 88MM
   COD. ORIGINAL: 1376274 1424766 1424768 K014896 ...
   ```

⚠️ **Efecto lateral a decidir (Q6):** con 8–10 códigos OEM por línea, cada fila crece 2–4 renglones. Una proforma de 10 ítems que hoy entra en 1 página puede pasar a 2–3. **Definir si van todos los códigos originales o un tope** (p. ej. los primeros 5 + “…”).

---

## 5ter. Buenas noticias verificadas (riesgos que NO existen)

Cosas que revisé esperando problemas y están bien:

- ✅ **Cero duplicados en `producto_codigos_equivalentes`** (comprobado sobre las 810 filas): el `unique` nuevo se aplica sin conflictos, no hace falta limpiar datos antes.
- ✅ **El guard de `productos` no molesta.** `fn_productos_before_update` solo revierte `stock_actual` cuando `pg_trigger_depth() = 1`; **actualizar `unidad_medida_id` desde la app funciona normal.**
- ✅ **`fn_buscar_productos` devuelve `setof public.productos`** → al agregar `unidad_medida_id` a la tabla, la función **ya lo devuelve sola**, sin tocar su firma. Y `create or replace` **conserva los grants** (`revoke ... from anon` / `grant ... to authenticated`), así que no hay riesgo de exponer la función.
- ✅ **Ninguna de las 6 RPC de movimiento aparece en el impacto** — confirmado leyendo las llamadas `.rpc()` de toda la app: solo `fn_buscar_productos` se toca.

---

## 6. Por qué se descartó el modelo con conversión (y qué se pierde)

Se diseñó y se descartó un modelo multi-unidad (`producto_unidades` con factor, `cantidad_base` en los 4 documentos, las 6 RPC reescritas): **7 fases, ~8,5 días, riesgo alto**, contra las **3,5 días y riesgo bajo** de este.

**Evidencia de que el modelo simple es el correcto para JISSACRUZ** — dos filas del propio sistema del cliente:

| Código | Descripción | Unidad | Stock |
|---|---|---|---|
| `TRVA0106` / RCLF-0034.0 | LIQUIDO FRENO DOT 3 500ML | **PIEZAS** | 5743 |
| `TRVA0235` / RCLF-0034.0-COMBO | 40_UNS_LIQUIDO +1GORRA_REGALO | **JUEGO** | 0 |

El combo de 40 unidades **no es el mismo producto en otra unidad: es un producto aparte**, con su código, su unidad y su stock, vinculado al suelto como equivalente. **El sistema que el cliente usa hoy tampoco convierte.**

**Lo único que se pierde — y hay que decírselo al cliente en la UAT:** si un producto se vende suelto y por combo, son **dos productos separados y sus stocks no están vinculados**. Vender 1 combo no descuenta 40 del suelto. **El cliente ya vive con esa inconsistencia hoy** (combo en 0, suelto en 5743), así que es esperable que le resulte aceptable — pero debe quedar dicho, no asumido.

**Compatibilidad hacia adelante:** si en el futuro aparece la necesidad real de conversión, se agrega `producto_unidades` con factores **encima de lo construido acá**, sin rehacer nada. Este diseño no cierra esa puerta.

---

## 7. Decisiones pendientes

Las que existían por la conversión (fracciones, cantidad mínima de precios por mayor en qué unidad, redondeo del costo al dividir por el factor, edición del factor, semilla de unidades) **quedaron cerradas o sin efecto**. Sobreviven tres, todas menores:

| # | Decisión | Recomendación |
|---|---|---|
| **D1** | ¿Se puede cambiar la unidad de un producto **con movimientos**? | **Bloquearlo** (ver riesgo R1). Es la única decisión con consecuencias de integridad. |
| **D2** | Etiquetas de medida: ¿libres (`A`, `B`) o catálogo cerrado? | **Libres** — el cliente usa A/B en su sistema actual. |
| **D3** | ¿ABM de unidades en ruta propia `/unidades-medida` o pestaña en Configuración? | **Ruta propia**, por consistencia con `/sucursales`. |

Sin impacto en el diseño, pero conviene confirmar con el cliente: **`producto_precios_mayor.cantidad_minima`** queda expresada en la unidad del producto (una escala “≥20” en un producto en docenas significa 20 docenas). Es coherente y no requiere cambios — solo que el cliente lo sepa al cargar las escalas.

### Preguntas abiertas de la segunda auditoría

| # | Pregunta | Estado | Resolución |
|---|---|---|---|
| **Q1** | ¿Guardar el fabricante real de cada código original? | ✅ **Cerrada (26 jul)** | **Se elimina `fabricante`.** Ambas tablas guardan solo el código; se borra la columna de `producto_codigos_equivalentes` y no se crea en `producto_codigos_originales`. Ver Fase 1 pasos 1.1.4 y 1.3. |
| **Q4** | ¿Arreglar `updateProducto` con RPC transaccional? | ✅ **Cerrada (26 jul)** | **Sí, se corrige.** Entra como paso previo a la Fase 1 (~0,5 día). Ver **R8**. |
| **Q5** | ¿Originales y medidas en los PDF de proforma y venta? | ✅ **Cerrada (26 jul)** | **Sí, van al PDF.** Abre el problema de ancho de la tabla → ver **R14** y la nueva **Q6**. |
| **Q2** | ¿Se permiten medidas sin etiqueta? | ✅ **Cerrada (26 jul)** | **No.** El usuario escribe la letra a mano; `etiqueta` queda obligatoria. Modelo de §2.2 sin cambios. Ver **R13**. |
| **Q3** | ¿“Código original” tildado por defecto en el buscador? | ✅ **Cerrada (26 jul)** | **Se agregan los dos checkboxes** (“Código original” y “Medidas”), **sin necesidad de que vengan tildados**: el sistema está en desarrollo, sin usuarios en producción. Ver **R10**. |
| **Q6** | En el PDF, ¿van **todos** los códigos originales de cada ítem (pueden ser 8–10) o un tope (p. ej. 5 + “…”)? Afecta la cantidad de páginas del documento. | ⏳ **ABIERTA — última pendiente** | Tope de 5 y “…”, para que una proforma de 10 ítems no se vaya a 3 páginas. Ver **R14**. |

---

## 8. Impacto en archivos (checklist de implementación)

**SQL nuevos:** `22_codigos_originales.sql` · `23_producto_medidas.sql` · `24_unidades_medida.sql` · `25_busqueda_original_medida.sql`

**Función SQL modificada:** `fn_buscar_productos` (**solo el cuerpo** — sin cambio de firma ni de tipo de retorno).
**Funciones SQL que NO se tocan:** las 6 RPC de movimiento (`fn_registrar_venta`, `fn_recibir_orden_compra`, `fn_ajuste_stock`, `fn_convertir_proforma_a_venta`, `fn_enviar_traspaso`, `fn_recibir_traspaso`), `fn_fifo_consumir`, `fn_kardex_aplica_stock`, `fn_productos_before_update`, `fn_proforma_items_validar`, `fn_obtener_precio_escalonado`.

**Tablas que NO se tocan:** `kardex_movimientos`, `producto_stock_sucursal`, `venta_items`, `proforma_items`, `orden_compra_items`, `pedido_traspaso_items`.

**Frontend:**

| Archivo | Qué cambia |
|---|---|
| `app/(dashboard)/unidades-medida/*` | **Nuevo** ABM (patrón `sucursales/`) |
| `components/shared/nav-items.ts` | Ítem nuevo en grupo Administración |
| `components/shared/criterios-busqueda.tsx` | Criterios `original` y `medida` |
| `app/(dashboard)/productos/producto-form.tsx` | 3 secciones nuevas (originales, medidas) + select de unidad + etiquetas de precio/stock mínimo |
| `app/(dashboard)/productos/{actions.ts,page.tsx,productos-explorer.tsx}` | Hijos nuevos, columnas, guarda de cambio de unidad (R1) |
| `app/(dashboard)/{ventas/pos.tsx,proformas/proforma-form.tsx}` | Mostrar unidad, medidas y originales en los resultados de búsqueda |
| `app/(dashboard)/{ventas,proformas,compras,inventario}/actions.ts` | Enriquecer resultados con unidad/medidas/originales (patrón `escalasVigentesPorProducto`) |
| `app/(dashboard)/inventario/inventario-explorer.tsx` · `kardex/kardex-view.tsx` | Columna de unidad |
| `lib/validations/producto.ts` + `unidad.ts` (nuevo) | Schemas zod |
| `lib/medidas.ts` | **Nuevo** helper de formateo |
| `lib/pdf/{proforma,venta,kardex}-document.tsx` + rutas `/api/pdf/*` | Columna de unidad; medidas en el DETALLE si el cliente lo pide |

---

## 9. Pendientes previos que este sprint NO resuelve

- ⏳ **Despliegue en Vercel** (comprometido desde el Sprint 1).
- ⏳ **UAT con el cliente** y corrección de hallazgos.
- ⏳ **234 de 239 productos con precio = Bs 0** — depende de que el cliente entregue la lista de precios.
- ⏳ **Carga de stock inicial por sucursal.**
- ⏳ **C2 paso 4** del Sprint 5: eliminar el total repetido `productos.stock_actual` y aplicar **RLS por sucursal al vendedor** (hoy un vendedor ve documentos de todas las sucursales).
- ⏳ **2 traspasos en estado `enviado`** (stock en tránsito, invisible en ambas sucursales) — resolverlos o cancelarlos.
- ⏳ `00_setup_completo.sql` incompleto para instalaciones desde cero.
- ⏳ **Divergencia de alcance abierta**: `linea_marca` es texto libre, pero el sistema del cliente maneja **Línea y Marca como campos separados** y ofrece búsqueda difusa (“Parecido”). No entra en este sprint; anotarlo para la próxima conversación.

---

## 10. Nota de alcance comercial

Los tres cambios de este sprint **no están en el alcance firmado** (`PlanProyecto.md` §3 y `PRD.md` §5 no mencionan catálogo de unidades, medidas estructuradas ni códigos originales). A diferencia del bloque multi-sucursal del Sprint 5, **son de tamaño chico (~3,5 días) y no re-arquitecturan nada**, así que la conversación con el cliente es mucho más simple — pero conviene dejarlos registrados como alcance adicional antes de ejecutarlos.

---

# PARTE II — Cambios funcionales y lógicos pedidos por el cliente (26 jul)

Cuatro pedidos nuevos, **independientes** de la Parte I (unidades/medidas/códigos). Se pueden ejecutar antes, después o en paralelo.

> **Estado del proyecto al momento de este análisis:** rama `main`, último commit `d88efdd` *("POS y Proforma: carrito como modal flotante moderno")*. Scripts SQL en el repo: hasta el `21`. Sin cambios sin commitear más allá de este documento y los archivos de `docs/`.

---

## F1 · Búsqueda por descripción ignorando acentos

### Lo que encontré (es peor de lo que parece)

Medido contra la BD real:

| Medición | Resultado |
|---|---|
| Productos con acentos en la descripción | **147 de 239** (61%) |
| `fn_buscar_productos('valvula', ['descripcion'])` | **1 resultado** |
| `fn_buscar_productos('válvula', ['descripcion'])` | **112 resultados** |
| `fn_buscar_productos('valvula descarga', ['descripcion'])` | **0 resultados** |

O sea: **hoy es imposible encontrar el 61% del catálogo sin escribir los acentos exactos.** Un vendedor que teclea `valvula` en el mostrador ve 1 producto de 113. No es una mejora cosmética: es un bug funcional que bloquea el uso real del POS.

### 🔴 Hallazgo colateral grave: el repo y la BD NO coinciden

La función `fn_buscar_productos` **viva en la BD no es la que declara el repo**:

| | `supabase/15_busqueda_anidada.sql` (lo que el repo declara vigente) | **Lo que realmente corre en la BD** |
|---|---|---|
| Motor | `to_tsvector('spanish')` + `ilike all` por campo | **Puro `ILIKE`, sin tsvector** |
| Lógica de fragmentos | Un mismo campo debe cumplir **todos** los fragmentos | Cada token puede matchear en **cualquier** campo (cross-field) |
| Separador de tokens | espacios (conserva `%` como comodín) | `[\s%]+` (parte también por `%`) |
| Origen | script 15 | **el cuerpo que está dentro de `00_setup_completo.sql`** |

Verificado: el cuerpo desplegado contiene `v_tokens` y **no** contiene `to_tsvector`; esa forma solo existe en `00_setup_completo.sql`. `supabase/README.md` (fila 15) declara vigente la otra. **Hay dos definiciones conflictivas de la misma función en el repo, y la que gobierna es la no documentada.**

**Consecuencias, y son importantes:**

1. ⚠️ **El script de este sprint debe escribirse sobre la versión VIVA, no sobre el script 15.** Si alguien parte del 15 —que es lo que el README indica— **revierte en silencio el trabajo del compañero** y cambia el comportamiento de la búsqueda en catálogo, compras, POS y proformas de una sola vez.
2. La versión viva **perdió el `tsvector`**, y con él el *stemming* del español: hoy `válvulas` (plural) no encuentra `VÁLVULA`. Eso sí funcionaba en el diseño del script 15.
3. Antes de tocar la búsqueda hay que **decidir cuál de las dos lógicas de fragmentos se quiere** (cross-field vs. mismo-campo). Son experiencias distintas y hoy nadie la eligió: quedó por accidente de qué script se corrió último.

### Cómo se arregla

1. **`create extension if not exists unaccent with schema extensions;`** — verificado: **no está instalada** (ni `unaccent` ni `pg_trgm`).
2. Envolver **los dos lados** de cada comparación: `extensions.unaccent(campo) ILIKE '%' || extensions.unaccent(tok) || '%'`.
   ⚠️ Hay que **calificar el esquema** (`extensions.unaccent`), porque la función tiene `set search_path = public` y no vería la extensión.
3. Aplicarlo a **todos** los campos de texto, no solo a la descripción (ver **Q7**).

**Notas técnicas:**

- `unaccent()` es `STABLE`, **no `IMMUTABLE`** → no se puede indexar directamente. Para índices haría falta un wrapper `IMMUTABLE`. Con 239 productos no importa (ya hoy hace scan), pero anotarlo para cuando el catálogo crezca.
- Si se quiere recuperar el stemming, la vía limpia es una configuración de búsqueda propia: `create text search configuration spanish_unaccent (copy = spanish)` mapeando `unaccent + spanish_stem`. Es trabajo adicional — ver **Q8**.

---

## F2 · Traspasos / pedidos — cómo funciona HOY

Documentado leyendo `supabase/19_pedidos_traspaso.sql` y el módulo `app/(dashboard)/traspasos/`, para que el cliente pueda decir qué quiere cambiar sobre una base concreta.

### Flujo actual: 3 estados + cancelación

```
   [Alguien crea el pedido]
   fn_crear_pedido_traspaso(destino, items, notas, origen?)
   · numero PED-000001 (secuencia + trigger)
   · origen = parametro, o la sucursal del usuario (fn_mi_sucursal())
   · valida: origen <> destino · al menos 1 item · cantidad > 0
   · NO valida stock disponible · NO reserva nada
   · costo_fifo_unitario del item queda en 0
                │
                ▼  estado: PENDIENTE ──────► fn_cancelar_traspaso() ──► CANCELADO
                │                             (solo desde pendiente)
                ▼
   [Despachar]  fn_enviar_traspaso(pedido)
   · exige estado = pendiente
   · por item: fn_fifo_consumir(producto, ORIGEN, cantidad)
     → descuenta stock del origen y calcula el costo FIFO real
   · guarda costo_fifo_unitario en el item
   · kardex: 'salida_traspaso' en la sucursal ORIGEN
                │
                ▼  estado: ENVIADO   ⚠️ stock "en el aire"
                │
   [Recibir]    fn_recibir_traspaso(pedido)
   · exige estado = enviado
   · por item: kardex 'entrada_traspaso' en la sucursal DESTINO
     con cantidad_restante_lote = cantidad (nuevo lote FIFO)
     y costo_unitario = costo FIFO del origen → el traspaso NO genera margen
                │
                ▼  estado: RECIBIDO
```

Las 4 RPC son `security definer`; la RLS de ambas tablas es **solo `select` para autenticados** (se escribe únicamente vía RPC, mismo criterio que ventas).

### Huecos del flujo actual (candidatos a lo que va a pedir el cliente)

| # | Hueco | Detalle |
|---|---|---|
| **H1** | **No se puede cancelar un traspaso ya enviado** | `fn_cancelar_traspaso` exige estado `pendiente`. Si la mercadería salió y se pierde, se rechaza o se mandó por error, **no hay forma de anular ni de devolverla al origen**. El único camino es recibirla y hacer un ajuste manual de stock. |
| **H2** | **Stock "en el aire" entre enviado y recibido** | Salió del origen y no entró al destino: **no aparece en ninguna sucursal**, no se valoriza en el reporte de inventario y no hay pantalla de "en tránsito". Hoy hay **2 pedidos en ese estado** en la BD real. |
| **H3** | **No hay recepción parcial** | Se recibe todo o nada. Si de 10 unidades llegan 8, el sistema no lo modela. |
| **H4** | **No valida stock al crear el pedido** | Se puede crear un pedido de 100 unidades habiendo 5; falla recién al despachar, con el pedido ya cargado. Tampoco **reserva** stock: dos pedidos pueden comprometer el mismo stock y el segundo falla al enviar. |
| **H5** | **El pedido no se puede editar** | Ni ítems ni cantidades después de creado. Hay que cancelar y volver a cargar todo. |
| **H6** | **Dirección del flujo** | Hoy el pedido lo crea el **origen** (o quien elija el origen). Si el cliente quiere que **la sucursal que necesita el producto lo solicite** y el origen lo apruebe/despache, eso es invertir el flujo y agregar un paso de aprobación. |
| **H7** | 🔒 **`fn_cancelar_traspaso` no valida usuario** | Las otras 3 RPC llaman `fn_es_usuario_activo()`; **ésta no**. Cualquier usuario autenticado puede cancelar cualquier pedido pendiente. |
| **H8** | 🔒 **Nadie valida la sucursal del usuario** | Cualquier autenticado puede **enviar** un traspaso de una sucursal ajena o **recibir** uno destinado a otra. Ligado al pendiente "C2 paso 4" del Sprint 5 (RLS por sucursal). |

> H7 y H8 son **agujeros de permisos que ya existen**, independientes de lo que pida el cliente. Conviene cerrarlos en el mismo trabajo.

> ➡️ **El cliente YA definió cómo lo quiere: ver la PARTE III de este documento**, que contiene el rediseño completo del módulo (inversión del flujo, modificación de cantidades, permisos y renombrado a "Pedido").
>
> **Resolución de los huecos:** H6, H7 y H8 **se corrigen**; **H2** se corrige mostrando el stock en tránsito en el reporte de inventario; **H1** (cancelar enviado) y **H3** (recepción parcial) quedan **fuera de alcance** por decisión explícita del cliente.

---

## F3 · Enter agrega el producto al carrito (proforma y venta)

### Estado actual

- **POS** ([app/(dashboard)/ventas/pos.tsx:205-212](<app/(dashboard)/ventas/pos.tsx>)): input con `autoFocus`, solo `onChange` → **no hay manejo de teclado**.
- Resultados: grid de `<button type="button" onClick={() => agregarProducto(r)}>` (líneas 216-255). Los productos sin stock en la sucursal salen `disabled`.
- ✅ **Buena noticia:** el buscador está **fuera** del `<form onSubmit={handleSubmit(onSubmit)}>` (que vive en el modal del carrito, línea 291). Por eso **Enter no va a disparar el registro de la venta** — que es el accidente clásico de esta feature. Riesgo bajo.
- ⚠️ El carrito fue **reescrito hace un commit** (`d88efdd`, modal flotante): implementar esto sobre ese código y no sobre una versión anterior.

### Lo que hay que definir antes de codearlo (**Q9**)

"Con un Enter se agrega al carrito" admite varios comportamientos, y cambian bastante la experiencia:

1. **¿Cuándo agrega?** ¿Solo si hay **exactamente 1 resultado** (lo más seguro), o siempre **el primero** de la lista?
2. **¿Navegación con flechas?** ↑/↓ para elegir y Enter para agregar el resaltado — es lo que espera alguien que trabaja en mostrador sin mouse.
3. **¿Se limpia el buscador después de agregar** y mantiene el foco, para cargar el siguiente de corrido? (Recomendado para carga rápida.)
4. **¿Qué cantidad?** ¿Siempre 1, o el foco salta al campo de cantidad?
5. **¿Y si el producto no tiene stock** en la sucursal? Hoy el botón está deshabilitado; con Enter hay que mostrar el mismo aviso y **no** agregarlo.
6. ⚠️ **Carrera con la búsqueda**: la búsqueda es asíncrona. Si el usuario teclea el código y aprieta Enter **antes** de que lleguen los resultados, no hay nada que agregar. Hay que esperar el resultado pendiente o ignorar el Enter mientras `buscando` está activo.

---

## F4 · Eliminar el descuento por porcentaje en ventas

### Dónde vive hoy

| Capa | Ubicación |
|---|---|
| UI · descuento **por línea** | [pos.tsx:385](<app/(dashboard)/ventas/pos.tsx>) — `<SelectItem value="porcentaje">%</SelectItem>` |
| UI · descuento **global** | [pos.tsx:426](<app/(dashboard)/ventas/pos.tsx>) — ídem |
| Validación | `lib/validations/venta.ts` (enum `porcentaje` / `monto_fijo` / `ninguno`) |
| Cálculo servidor | `fn_registrar_venta` — rama `when 'porcentaje' then round(... * valor / 100, 2)` |
| BD | `check (descuento_tipo = any (array['porcentaje','monto_fijo']))` en **`ventas`, `venta_items`, `proformas`, `proforma_items`** |

### 🔴 Dato que condiciona la solución: ya hay registros con porcentaje

| Tabla | Registros con `descuento_tipo = 'porcentaje'` |
|---|---|
| `ventas` | **1** |
| `venta_items` | **7** |
| `proformas` | 0 |
| `proforma_items` | **4** |

**Por eso NO se debe endurecer el `check` de la BD**: dejaría 12 registros violando la restricción, y Postgres rechaza el `alter` si hay filas que no cumplen (salvo que se migren o se convierta cada descuento a monto fijo).

**Enfoque recomendado:** quitar el porcentaje **de la UI y del schema zod** —que es la puerta real, porque toda escritura pasa por Server Actions validadas— y **dejar intactos el `check` de la BD y la rama de `fn_registrar_venta`**. Así el histórico sigue siendo legible y no se rompe nada.

⚠️ **No borrar la rama `'porcentaje'` de `fn_registrar_venta`**: si queda una proforma vieja con descuento porcentual y se convierte a venta, sin esa rama el descuento se ignoraría **en silencio** y el total saldría más alto.

### Lo que falta decidir (**Q10**, **Q11**)

- **Q10 · ¿También en proformas?** El cliente dijo *"a la hora de hacer una venta"*. Pero si la proforma conserva el porcentaje y después se convierte a venta, **la venta nace con un descuento porcentual** — justo lo que se quiso prohibir.
- **Q11 · ¿Los dos niveles de descuento?** Hoy hay porcentaje **por línea** y **global**. ¿Se elimina en ambos o en uno?
- Los 12 registros históricos se dejan como están (trazabilidad). Solo confirmar que el cliente acepta verlos así en los PDF y reportes viejos.

---

## Preguntas abiertas de la Parte II

| # | Pregunta | Recomendación |
|---|---|---|
| **Q7** | ¿Ignorar acentos solo en descripción o en todos los campos? | ✅ **En TODOS los campos** (código, descripción, línea/marca, equivalente, original, vehículo, medidas). |
| **Q8** | ¿Se recupera el stemming (que `válvulas` encuentre `VÁLVULA`)? | ✅ **NO.** No se recupera nada de lo que perdió la versión viva. **No crear la configuración `spanish_unaccent`** — solo aplicar `unaccent`. El usuario escribe el singular. |
| **Q8b** | ¿Cross-field o mismo-campo? | ✅ **Cross-field**, o sea **se conserva la lógica de la versión viva tal cual**. Solo se le agrega `unaccent`, nada más. |
| **Q9** | Comportamiento del Enter | ✅ **Enter agrega el PRIMERO de la lista.** Complementos aplicados por defecto: limpia el buscador y mantiene el foco, cantidad 1, ignora el Enter si el producto no tiene stock en la sucursal o si la búsqueda todavía está en curso. |
| **Q10** | ¿El porcentaje también se quita en proformas? | ✅ **Sí, también en proformas.** |
| **Q11** | ¿Por línea, global o ambos? | ✅ **En ambos niveles.** |
| **Q12** | ¿Se adopta la versión viva de `fn_buscar_productos` como oficial? | ✅ **Sí.** Hay que **corregir `supabase/README.md`** (la fila 15 apunta a la función equivocada) y dejar constancia de que `15_busqueda_anidada.sql` **no es** lo que corre. |

---

# PARTE III — Rediseño del módulo "Pedido" (ex Traspasos)

**Decisiones del cliente, 26 jul 2026.** Diseño cerrado. ⏳ **Implementación en espera de luz verde.**

## El cambio de fondo: se invierte quién crea el pedido

**Hoy:** el usuario que crea el pedido es el **origen** — *"yo le mando mi stock a la otra sucursal"*. El formulario fija `Origen = mi sucursal` y deja elegir el destino ([traspaso-form.tsx:157-195](<app/(dashboard)/traspasos/traspaso-form.tsx>)).

**Como lo quiere el cliente:** el usuario que crea el pedido es el **destino** — *"le **pido** 80 unidades a la otra sucursal"*.

Ejemplo del cliente: un usuario de **Casa Matriz (1)** pide `producto X, cantidad 80` al **Almacén Centro (2)**. El Almacén Centro recibe la solicitud, la verifica, ajusta la cantidad si no tiene stock suficiente, y despacha. La mercadería va **2 → 1**.

🟢 **Las columnas `sucursal_origen_id` / `sucursal_destino_id` NO cambian de significado** (origen = de dónde sale el stock). Solo se invierte el rol del creador. **Los 8 pedidos históricos siguen siendo válidos: no hay migración de datos.**

## Flujo nuevo

```
  Sucursal SOLICITANTE (= DESTINO) crea el pedido
  · destino = su propia sucursal (fn_mi_sucursal())
  · origen  = la sucursal a la que le pide
                    │
                    ▼  PENDIENTE ──────► cancelar (solo el creador o admin) ──► CANCELADO
                    │
  Sucursal PROVEEDORA (= ORIGEN) abre el pedido, ajusta
  cantidades si no tiene stock, y despacha en UN solo paso
                    │
                    ▼  ENVIADO   (sale el stock del origen, FIFO)
                    │
  Sucursal SOLICITANTE recibe (todo, no hay parcial)
                    │
                    ▼  RECIBIDO  (entra el stock al destino como lote FIFO)
```

## Decisiones tomadas

| # | Decisión | Resolución |
|---|---|---|
| **Q13** | Verificar/modificar y despachar | **Un solo paso.** La sucursal origen ajusta cantidades y aprieta "Despachar". Sin estado intermedio de "aprobado". |
| **Q14** | Qué puede modificar el origen | **Solo la cantidad.** No puede quitar líneas ni agregar productos que no se pidieron. |
| **Q15** | Trazabilidad del recorte | **Se guarda `cantidad_solicitada`** (lo que pidió el destino) además de `cantidad` (lo que realmente se despacha). El solicitante ve *"pedí 80, me mandaron 50"*. |
| **Q16** | Recepción parcial (H3) | ❌ **No se implementa.** No hace falta: el origen ya ajusta la cantidad antes de despachar. **H3 sale del alcance.** |
| **Q17** | Cancelar un pedido ya enviado (H1) | ❌ **No se permite.** Se mantiene el comportamiento actual: solo se cancela en estado `pendiente`. **H1 sale del alcance** (no se crea el estado `devuelto`). |
| **Q18** | Permisos (H7/H8) | ✅ Matriz aprobada, ver abajo. |
| **Q19** | Los 2 pedidos hoy en `enviado` | **Recibirlos**, para que el stock entre al destino y no quede en el aire. |
| — | Nombre del módulo | **"Pedido"** en lugar de "Traspasos" (nav, títulos y textos). La numeración `PED-` ya era coherente. |

### Matriz de permisos aprobada (cierra H7 y H8)

| Acción | Quién puede |
|---|---|
| Crear pedido | Cualquier usuario activo (destino = su sucursal) |
| Modificar cantidades y despachar | Usuario de la sucursal **origen**, o admin |
| Recibir | Usuario de la sucursal **destino**, o admin |
| Cancelar (solo en `pendiente`) | Quien lo creó, o admin |

Hoy **cualquier autenticado puede hacer todo** y `fn_cancelar_traspaso` **no valida ni que el usuario esté activo** (las otras 3 RPC sí). Esta matriz es la corrección.

## Alcance resultante

**Entra:**
- **H6** · inversión del flujo (creación desde el destino) — el cambio principal.
- **Q14/Q15** · RPC nueva para que el origen modifique cantidades antes de despachar, guardando `cantidad_solicitada`.
- **H7** · `fn_cancelar_traspaso` valida usuario activo.
- **H8** · las 4 RPC validan la sucursal del usuario según la matriz.
- **H2** · visibilidad del stock en tránsito (pendiente definir alcance: pantalla de pedidos vs. reporte de inventario).
- Renombrado a "Pedido".

**Sale del alcance:** H1 (cancelar enviado) y H3 (recepción parcial), por decisión explícita del cliente.

## Micro-detalles — resueltos (26 jul)

| # | Detalle | Resolución |
|---|---|---|
| **1** | ¿La cantidad puede bajar a 0? | ✅ **Sí: `0` = no despacho ese ítem.** Queda registrado que se pidió (`cantidad_solicitada = 80`) y que no se envió nada (`cantidad = 0`). El `check (cantidad > 0)` actual de `pedido_traspaso_items` **hay que relajarlo a `>= 0`**, y `fn_enviar_traspaso` debe **saltear** los ítems en 0 (no llamar al FIFO ni insertar kardex para ellos). |
| **2** | ¿El solicitante puede corregir su pedido pendiente? | ❌ **No. Solo cancelarlo** y crear uno nuevo. Simplifica: la única RPC de modificación es la del origen al despachar. |
| **3** | **H2** · dónde se ve el stock en tránsito | ✅ **En el reporte de inventario.** Ver nota de implementación abajo. |

### Nota de implementación de H2 (reporte de inventario)

Hoy el reporte de inventario ([lib/reportes.ts:224](lib/reportes.ts)) lee solo `productos` (`linea_marca, stock_actual, stock_minimo, precio`) y agrupa por línea con valorización. El stock en tránsito **no está en ninguna tabla de stock** — hay que derivarlo:

```sql
-- stock en tránsito = ítems de pedidos en estado 'enviado'
select producto_id, sum(cantidad) en_transito, sum(cantidad * costo_fifo_unitario) valor_transito
from pedido_traspaso_items i
join pedidos_traspaso p on p.id = i.pedido_id
where p.estado = 'enviado'
group by producto_id
```

**Criterios de diseño:**
- El tránsito va como **columna aparte**, **no se suma** al stock de ninguna sucursal (no está en ninguna de las dos).
- Se valoriza al **costo FIFO del origen** (`costo_fifo_unitario`, que ya se guardó al despachar), no al precio de venta.
- ✅ **Se muestra el recorrido `origen → destino` de cada tránsito** (decisión del cliente, 26 jul).

**Consecuencia de mostrar el recorrido:** no entra como una columna del cuadro agrupado por línea. Un mismo producto puede tener **varios tránsitos simultáneos** (dos pedidos de orígenes distintos, o uno de ida y otro de vuelta), así que una sola celda no alcanza. Va como **bloque propio dentro del reporte de inventario**, con una fila por ítem en tránsito:

| Pedido | Producto | Cantidad | Recorrido | Enviado | Valor (costo FIFO) |
|---|---|---|---|---|---|
| `PED-000012` | `TKL31012A` — VÁLVULA… | 50 | Almacén Centro → Casa Matriz | 24/07/2026 | Bs 1.250,00 |

Consulta base:

```sql
select p.numero, p.fecha_envio,
       so.nombre as origen, sd.nombre as destino,
       pr.codigo, pr.descripcion, pr.linea_marca,
       i.cantidad, i.cantidad * i.costo_fifo_unitario as valor
from pedido_traspaso_items i
join pedidos_traspaso p  on p.id = i.pedido_id
join sucursales so       on so.id = p.sucursal_origen_id
join sucursales sd       on sd.id = p.sucursal_destino_id
join productos pr        on pr.id = i.producto_id
where p.estado = 'enviado' and i.cantidad > 0
order by p.fecha_envio desc
```

Suma trabajo: además de la consulta, hay que agregar el bloque al reporte en pantalla, al **PDF** (`lib/pdf/reporte-document.tsx`) y al **Excel** (columnas propias, distintas del cuadro por línea). Estimado **~0,5 día** adicional sobre el reporte de inventario.

### Q19 · nota operativa

Recibir los 2 pedidos en tránsito es un **movimiento real de stock** (entra mercadería al destino) y solo se revierte con un ajuste manual. Además `fn_recibir_traspaso` valida `fn_es_usuario_activo()`, así que hay que ejecutarlo **logueado desde la app**, no por SQL directo (donde `auth.uid()` viene nulo).

---

# PARTE IV — Cambios en Proformas (pedido del cliente, 26 jul)

**Pedido del cliente, en sus términos:**
1. No se puede ver qué productos tiene una proforma vigente.
2. La vigencia debe ser de **3 días** (los precios cambian). Pasados los 3 días, la proforma pasa a estado **"PENDIENTE"** y **no se debe poder convertir a venta**. El usuario verifica los precios de los productos de esa proforma, y **también debe poder agregar productos nuevos**.
3. Al convertir a venta solo aparece una confirmación seca — falta ver el detalle de productos, cliente y totales antes de confirmar.

## Estado actual verificado

| Aspecto | Cómo está hoy |
|---|---|
| Acciones del módulo | Solo **3**: `buscarProductosParaProforma`, `createProforma`, `convertirProformaAVenta` ([proformas/actions.ts](<app/(dashboard)/proformas/actions.ts>)) |
| Edición de proformas | ❌ **No existe.** El formulario es solo de alta (`defaultValues: VACIO`), no hay `updateProforma` |
| Ver el detalle de ítems | ❌ **No existe en la UI.** Los ítems solo se leen en la ruta del PDF (`/api/pdf/proforma/[id]`) |
| Vigencia | `proformas.plazo_validez_dias`, **editable por proforma**, default `15` en la BD. Datos reales: hay proformas con **15, 7 y 30** días |
| Estado "vencida" | **Derivado**, no persistido: `vista_proformas.estado_efectivo` calcula `creado_en + plazo_validez_dias < now() → 'vencida'`. La columna `estado` solo distingue `vigente` / `convertida` |
| Bloqueo de conversión si venció | ⚠️ **Solo en la UI**: `puedeConvertir = estadoEfectivo(...) === "vigente"` esconde el botón ([proformas-explorer.tsx:144](<app/(dashboard)/proformas/proformas-explorer.tsx>)) |
| Diálogo de conversión | `AlertDialog` con el número y un texto genérico. Sin ítems, sin cliente, sin totales |

### 🔴 Hallazgo 1 · El bloqueo de conversión es solo cosmético

`fn_convertir_proforma_a_venta` valida **únicamente** que la proforma no esté ya convertida:

```sql
if v_proforma.estado = 'convertida' then
  raise exception 'La proforma % ya fue convertida', v_proforma.numero;
end if;
```

**No mira el vencimiento.** Y como la columna `estado` sigue diciendo `'vigente'` para siempre (el vencimiento se deriva en la vista), **hoy la RPC convierte una proforma vencida sin protestar**. Lo único que lo impide es que el botón esté escondido en el frontend.

→ El requisito "no debe dejar convertirla" **exige la validación en la RPC**, no solo en la UI.

### 🔴 Hallazgo 2 · Con el modelo actual, una proforma "pendiente" NO podría volver a convertirse nunca

El vencimiento se calcula desde `creado_en`, que **no cambia** al editar. Entonces: el usuario revisa los precios, corrige, guarda… y la proforma **sigue vencida**, porque `creado_en + 3 días` ya pasó. Queda trabada para siempre.

**Se necesita una marca de revalidación.** Propuesta: columna nueva `revalidada_en timestamptz` (null por defecto), y la vista calcula el vencimiento desde `coalesce(revalidada_en, creado_en)`. Al confirmar los precios, la acción setea `revalidada_en = now()` → la proforma vuelve a estar vigente por 3 días más. Mantiene el diseño derivado (sin jobs ni estados persistidos).

## Alcance del cambio

**BD:**
- `proformas.revalidada_en` (nueva) + `vista_proformas` recalculada desde `coalesce(revalidada_en, creado_en)`.
- **Tres estados derivados** en vez de dos (ver Q21):

```sql
case
  when estado = 'convertida' then 'convertida'
  -- TOPE DURO: 3 meses desde la CREACION (Q30). Se evalua primero: gana sobre todo lo demas.
  when creado_en + interval '3 months' < now() then 'vencida'
  -- vigente: dentro de los 3 dias desde la creacion o desde la ultima revalidacion
  when coalesce(revalidada_en, creado_en) + make_interval(days => plazo_validez_dias) >= now()
       then 'vigente'
  else 'pendiente'                                     -- hay que revisar precios
end as estado_efectivo
```

⚠️ **Consecuencia del tope duro (Q30):** una proforma revalidada el día 89 queda `vigente`… y al día 90 pasa directo a `vencida` **sin pasar por `pendiente`**. Es correcto según la regla, pero la UI debe mostrar siempre la **fecha de vencimiento definitivo** (`creado_en + 3 meses`) para que nadie se sorprenda.

- `plazo_validez_dias`: default **3** y `update` de las 5 filas existentes a 3 (Q20 fijo + Q28 retroactivo). **No se elimina la columna**: la usa la leyenda del PDF (P9) y deja el plazo configurable con un `alter` si mañana el cliente cambia de idea.
- `fn_convertir_proforma_a_venta`: **rechazar si el estado efectivo no es `vigente`**.

**App:**
- `obtenerProformaDetalle(id)` — acción nueva (hoy no existe forma de leer los ítems desde la UI).
- `updateProforma(id, values)` — acción nueva: precios, cantidades y productos nuevos, **recalculando los totales de cabecera**.
- `revalidarProforma(id)` — marca `revalidada_en`.
- Modo edición en `proforma-form.tsx` (hoy solo alta).
- Vista de detalle reutilizable, usada tanto en "Ver detalle" como en el diálogo de conversión.
- El explorer pasa a mostrar el estado `pendiente` y su acción "Revisar precios".

⚠️ **`updateProforma` va a necesitar el mismo cuidado que el riesgo R8** (borrar hijos y reinsertar sin transacción). Resolverlo con el mismo criterio: RPC transaccional o diff, no delete-all suelto.

⚠️ **Recalcular la cabecera es obligatorio:** el trigger `fn_proforma_items_validar` recalcula `subtotal_linea` de cada ítem, pero `proformas.subtotal` y `.total` los calcula la acción de la app. Si se agregan ítems sin recalcular la cabecera, **el total del PDF no va a coincidir con la suma de las líneas**.

## Preguntas abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| # | Pregunta | Resolución (26 jul) |
|---|---|---|
| **Q20** | Plazo de vigencia | ✅ **Fijo en 3 días por ahora.** Se quita el campo "Validez" del formulario; la columna queda con default 3. |
| **Q21** | ¿"pendiente" reemplaza a "vencida"? | ✅ **Conviven: son 3 estados.** `vigente` (3 días) → `pendiente` (hay que revisar precios) → **`vencida` a los 3 meses**. |
| **Q22** | Columna `revalidada_en` | ✅ **Aprobada.** |
| **Q23** | Revisión de precios | ✅ **Comparación precio de la proforma vs. precio actual, resaltando lo que cambió.** |
| **Q24** | ¿Editar vigente y pendiente? | ✅ **En ambos casos.** |
| **Q25** | ¿Quitar productos? | ✅ **Quitar y agregar.** |
| **Q26** | Detalle | ✅ **Página completa `/proformas/[id]`** (no modal). |
| **Q27** | Precios al convertir | ✅ Los de la proforma ya revisada. |
| **Q28** | Retroactividad del plazo | ✅ **Sí, retroactivo.** Las 5 existentes pasan a plazo 3 → PRO-0005 y PRO-0010 quedan en `pendiente` al instante. |

### Resueltas (26 jul) — cierran el diseño de proformas

| # | Pregunta | Resolución |
|---|---|---|
| **Q29** | ¿Una proforma `vencida` se puede revalidar? | ❌ **No, queda muerta.** Solo lectura y PDF. Si el cliente vuelve, se duplica en una proforma nueva. La UI no ofrece "revisar precios" en ese estado. |
| **Q30** | ¿Los 3 meses desde cuándo? | ✅ **Desde la creación** (`creado_en`). Es un **tope duro**: por más que se revalide, a los 3 meses muere. |
| **Q31** | ¿Dónde se convierte? | ✅ **En la página de detalle**, con ítems, cliente y totales a la vista. Se saca el `AlertDialog` de la lista. |
| **Q32** | Botón "traer precios actuales" | ✅ **Sí**, además de la edición manual línea por línea. |

> 📝 **Nota de nomenclatura:** el estado `pendiente` ya existe en el módulo **Pedido** (pedido pendiente = esperando despacho). Ahora hay dos "pendiente" con significados distintos: proforma pendiente = *esperando revisión de precios*. No es un problema técnico, pero los textos de la UI deben aclararlo (*"Pendiente de revisión de precios"* vs *"Pendiente de despacho"*).

> 📝 **Nota de nomenclatura:** el estado `pendiente` ya existe en el módulo **Pedido** (pedido pendiente = esperando despacho). Ahora habrá dos "pendiente" con significados distintos: proforma pendiente = *esperando revisión de precios*. No es un problema técnico, pero conviene que los textos de la UI lo aclaren.

---

# CIERRE — Checklist consolidado y reglas de trabajo

## ✅ Checklist de implementación (marcar a medida que se avanza)

### Bloque 0 · Previo (🔴 hacer primero)
- [ ] **R8** — `updateProducto` deja de borrar hijos y reinsertarlos sin transacción. Mínimo: deduplicar listas en zod + verificar el error de los `delete`. Correcto: RPC transaccional `fn_guardar_producto`. *(Protege los 810 códigos OEM antes de que la Parte I los cargue en ese mismo patrón.)*

### Bloque F1 · Acentos en la búsqueda 🟢
- [ ] `create extension if not exists unaccent with schema extensions;`
- [ ] `26_busqueda_unaccent.sql`: envolver **ambos lados** con `extensions.unaccent(...)` en **todos** los campos (Q7). **Partir de la versión VIVA de la función, no del script 15** (ver F1).
- [ ] **No** crear la configuración `spanish_unaccent` (Q8) ni cambiar la lógica cross-field (Q8b).
- [ ] `notify pgrst, 'reload schema';`
- [ ] Corregir `supabase/README.md`: la fila 15 apunta a una función que no es la que corre (Q12).
- [ ] Probar: `valvula` debe devolver ~113 productos (hoy devuelve 1).

### Bloque F4 · Quitar descuento por porcentaje 🟢
- [ ] Quitar `<SelectItem value="porcentaje">` de POS (línea y global) y de proforma (Q10, Q11).
- [ ] Quitar `porcentaje` del enum en `lib/validations/venta.ts` y `lib/validations/proforma.ts`.
- [ ] **NO tocar** el `check` de la BD (hay 12 registros históricos con porcentaje) ni la rama `'porcentaje'` de `fn_registrar_venta`.

### Bloque F3 · Enter agrega al carrito 🟢
- [ ] `onKeyDown` en el buscador de POS y de proforma: Enter agrega **el primero** de la lista (Q9).
- [ ] Limpiar el buscador, mantener el foco, cantidad 1.
- [ ] Ignorar el Enter si el producto no tiene stock en la sucursal o si la búsqueda está en curso.

### Bloque IV · Proformas 🟡
- [ ] `27_proformas_vigencia.sql`: columna `revalidada_en`, vista con **3 estados**, `plazo_validez_dias` default 3 + update de las 5 filas existentes, y **validación de vigencia dentro de `fn_convertir_proforma_a_venta`**.
- [ ] Página `/proformas/[id]` con detalle completo (cliente, ítems, totales) — la conversión se hace **desde ahí** (Q31).
- [ ] Acciones nuevas: `obtenerProformaDetalle`, `updateProforma`, `revalidarProforma`.
- [ ] Modo edición en el formulario: agregar y quitar productos, editar precios (Q24, Q25).
- [ ] Comparación *precio de la proforma vs. precio actual* resaltando lo cambiado + botón "traer precios actuales" (Q23, Q32).
- [ ] Quitar el campo "Validez" del formulario (Q20).
- [ ] Estado `vencida` = solo lectura, sin acciones (Q29).
- [ ] **Recalcular los totales de cabecera** al editar ítems (si no, el PDF no cuadra con las líneas).

### Bloque III · Pedido (ex Traspasos) 🟡
- [ ] `28_pedidos_flujo.sql`: invertir el flujo, `cantidad_solicitada`, relajar el `check` a `cantidad >= 0`, RPC de modificación de cantidades, validación de usuario y sucursal en las 4 RPC.
- [ ] `fn_enviar_traspaso` debe **saltear los ítems en 0** (no llamar al FIFO ni insertar kardex).
- [ ] Renombrar el módulo a **"Pedido"** (nav, títulos, textos).
- [ ] Formulario: el creador es el **destino**; se elige la sucursal **origen** a la que se le pide.
- [ ] Pantalla del origen: ajustar cantidades y despachar en un solo paso.
- [ ] Stock en tránsito en el **reporte de inventario**, con recorrido `origen → destino`, en pantalla + PDF + Excel.
- [ ] **Recibir los 2 pedidos que hoy están en `enviado`** (logueado desde la app, no por SQL).

### Bloque I · Unidades, medidas y códigos originales 🟠
- [ ] Fases 1 a 5 según §3. Respetar el **orden dentro del script 22** (migrar los 810 **antes** de borrar `fabricante`).
- [ ] **Snapshot de la BD antes del script 22** (única operación que mueve datos existentes).
- [ ] **R9**: agregar `original` y `medida` al **arreglo por defecto** de criterios en el SQL, no solo al `WHERE`.
- [ ] **R11**: usar `EXISTS (...)` en vez de `LEFT JOIN` + `DISTINCT` para los criterios de tablas hijas.
- [ ] **R14**: en el PDF, la unidad va dentro de la celda CANTIDAD y originales/medidas como líneas dentro de DETALLE. No agregar columnas.

### Cierre
- [ ] Actualizar `supabase/README.md` con los scripts 22–28.
- [ ] Actualizar `PLAN.md` (sección Sprint 6 + registro de cambios).
- [ ] `BACKEND.md` está desactualizado **desde el Sprint 5**: actualizarlo o marcarlo como histórico.
- [ ] `npm run build` + `npx tsc --noEmit` + `npm run lint` limpios.

---

## 🤝 Reglas de coordinación (dos devs en paralelo)

Este proyecto **ya tuvo que reconciliar trabajo duplicado dos veces** (PLAN.md, 18 jul: dos versiones de la búsqueda por fragmentos, dos helpers de número a letras). Y hay un caso peor documentado en **F1**: una función que quedó **pisada en la BD** sin que nadie lo notara, con el repo declarando una versión distinta de la que realmente corre.

Para que no vuelva a pasar:

1. **Repartirse bloques completos, no archivos sueltos.** Los bloques de este documento son independientes entre sí *salvo* la excepción del punto 2.
2. **`fn_buscar_productos` la toca UNA sola persona.** Los scripts 25 y 26 la reescriben los dos. Si se los reparten, el segundo pisa al primero.
3. **Respetar la numeración de scripts asignada arriba.** Nadie inventa un número nuevo sin avisar.
4. **Al correr un script en Supabase, anotarlo en `supabase/README.md` en el mismo commit.** El desfase entre el repo y la BD es el problema más caro que ya tiene este proyecto.
5. **Verificar contra la BD, no contra el repo.** Antes de reescribir una función, hacer `select prosrc from pg_proc where proname = '...'` y confirmar qué está corriendo de verdad.

---

## 🚫 Lo que este documento decidió NO hacer

Para que nadie lo reabra por su cuenta:

| Descartado | Motivo |
|---|---|
| Conversión de unidades (vender en docenas y descontar 12 piezas) | El cliente confirmó: un producto se vende **solo** en su unidad. Ver §6. |
| Código de barras y segundo código de producto | Descartado por el cliente. |
| Campo `fabricante` en los códigos | Se elimina de ambas tablas (Q1). |
| Medidas sin etiqueta | El usuario siempre escribe la letra (Q2). |
| Stemming / búsqueda por plurales | El cliente pidió no recuperar nada de eso (Q8). |
| Cancelar un traspaso ya enviado (H1) | Fuera de alcance por decisión del cliente (Q17). |
| Recepción parcial de traspasos (H3) | No hace falta: el origen ajusta la cantidad antes de despachar (Q16). |
| Editar una proforma pendiente por parte del solicitante | Solo puede cancelarla y crear otra. |
| Revalidar una proforma vencida (+3 meses) | "Ya no sirve para nada": solo lectura (Q29). |
| Endurecer el `check` de `descuento_tipo` en la BD | Hay 12 registros históricos con porcentaje; el `alter` fallaría. |

---

## 📌 Pendientes anteriores que este sprint NO resuelve

Siguen abiertos desde antes y conviene no perderlos de vista:

- **Despliegue en Vercel** (comprometido desde el Sprint 1).
- **UAT con el cliente** y corrección de hallazgos.
- **234 de 239 productos con precio = Bs 0** — depende de que el cliente entregue la lista de precios.
- **Carga de stock inicial por sucursal.**
- **C2 paso 4** del Sprint 5: eliminar el total repetido `productos.stock_actual` y **RLS por sucursal para el vendedor**.
- `00_setup_completo.sql` no sirve para una instalación desde cero (le faltan los scripts 12–14, 16, 20, 21 y ahora 22–28).
- **Línea y Marca como campos separados** + búsqueda difusa ("Parecido"), que el sistema del cliente tiene y este no.
