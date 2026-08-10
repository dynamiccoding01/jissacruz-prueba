# PLAN_2.md — Segunda tanda de tareas (T1–T12)

> Documento de trabajo para coordinar los nuevos pedidos del cliente sobre SISREP.
> Estado: **borrador para validar** — varias tareas tienen preguntas abiertas (marcadas con ❓)
> que hay que cerrar con el cliente/dueño **antes** de codificar. La implementación ya arrancó:
> ver el **Avance** de cada tarea (✅/⏳) y la tabla resumen al final.
>
> Fecha de armado: 2026-08-10. Autor del análisis: revisión del código real módulo por módulo.

## Convenciones y contexto que aplica a TODO

1. **Dos bases separadas.** Desarrollo (`dynamiccoding01`) y Producción (`jissacruzscz-spec`)
   son proyectos Supabase distintos. **Cada cambio de esquema = un script SQL nuevo numerado
   (35, 36, …)** que hay que correr en el SQL Editor de **ambas** bases, y además reflejarlo en
   `supabase/produccion_setup.sql` para instalaciones nuevas.
2. **Patrón por módulo.** `page.tsx` (Server Component) + `<modulo>-explorer.tsx` (tabla cliente) +
   `<modulo>-form.tsx` (react-hook-form + zod) + `actions.ts` (Server Actions) + `lib/validations/<modulo>.ts`.
3. **Todo lo que mueve stock pasa por RPC** (`fn_registrar_venta`, etc.). No se toca stock desde el cliente.
4. **Cantidades enteras hoy.** `kardex_movimientos.cantidad` es `integer` y los schemas de venta/proforma
   usan `z.coerce.number().int()`. Esto es central para **T1**.
5. **Deploy a producción**: `vercel --prod` desde `C:\Sisrep` (el auto-deploy por git está bloqueado en Hobby).

Leyenda de estado por tarea: 🟢 clara y lista para hacer · 🟡 necesita una decisión · 🔴 grande / rediseño · ✅ ya existe (total o parcial).

---

## T1 — Kilos y litros en productos 🔴❓

**Avance:** ✅ COMPLETADO (2026-08-10) — ⚠️ falta **correr `supabase/35_unidades_kg_litro.sql`** en dev y prod (agrega KG y LT al catálogo de unidades). No hay cambios de código de app.
**Decisión (2026-08-10):** Cantidades **ENTERAS** (opción A). Se agregan "Kilogramo (KG)" y "Litro (LT)" como unidades del catálogo `unidades_medida` (desde la pantalla *Unidades*). No se toca el modelo de stock/FIFO ni las cantidades. Tarea chica. **Descartada** la opción de decimales.

- **Qué pide:** "nueva característica en productos, de kilos y litros."
- **Hoy:** existe el catálogo `unidades_medida` y `productos.unidad_medida` / `unidad_medida_id`.
  La unidad es **sin conversión** (el producto se vende solo en su unidad; el kardex y el FIFO no la miran).
  **Todas las cantidades son enteras** (venta, proforma, kardex, compras).
- **Dos lecturas posibles (hay que elegir):**
  - **A — Solo etiquetas (simple):** agregar "Kilogramo (KG)" y "Litro (LT)" como unidades del catálogo.
    Los productos se venden "en kilos/litros" pero en **cantidades enteras** (1, 2, 3 kg). Trabajo: ~minutos,
    se hace desde la pantalla *Unidades* sin tocar código.
  - **B — Venta por peso/volumen con decimales (fuerte):** poder vender **1,5 kg** o **0,75 lt**.
    Esto obliga a pasar `cantidad` de entero a **decimal** en: schemas zod (venta, proforma), `kardex_movimientos.cantidad`,
    `orden_compra_items.cantidad`, **todas** las RPC de stock/FIFO (`fn_registrar_venta`, `fn_recibir_orden_compra`,
    `fn_convertir_proforma_a_venta`, `fn_ajuste_stock`, `fn_fifo_consumir`, `cantidad_restante_lote`), inputs del POS/proforma
    y los PDF. Es un cambio **transversal sobre la parte más delicada del sistema** (stock/FIFO), con pruebas dedicadas.
- **❓ Decisión que necesito:** ¿los productos en kg/lt se venden en cantidades **enteras** (A) o con **decimales** (B)?
  Es la diferencia entre 10 minutos y un mini-proyecto. **Recomendación:** si es peso/volumen real, tratarlo como B y planificarlo aparte.

## T2 — Atajo Alt+Enter en "descripción" 🟡❓

**Avance:** ⏳ PENDIENTE

- **Qué pide:** "atajo con alt + enter en la función de descripción similar a lo que hace shift + enter."
- **Hoy:** el campo *descripción* del producto es un `<Textarea>`; ahí Enter y Shift+Enter **ya insertan salto de línea**
  por defecto. No hay ningún manejo especial de Shift+Enter en el código.
- **❓ Decisión que necesito (con un ejemplo):** ¿qué querés que haga Alt+Enter exactamente y en **qué campo**?
  (¿la descripción del *producto*, la *glosa* de proforma, la búsqueda?) ¿Insertar salto de línea, un separador,
  una plantilla, agregar el primer resultado sin cerrar el buscador…? Sin un "cuando toco Alt+Enter quiero que pase X"
  no lo puedo hacer con precisión. Una vez definido: riesgo bajo.

## T3 — Sacar el historial de ventas de *Ventas* y llevarlo a *Reportes* 🟢

**Avance:** ✅ COMPLETADO (2026-08-10) — historial quitado de `ventas/page.tsx` (queda solo el POS); el componente se movió a `app/(dashboard)/reportes/ventas-historial.tsx` y se renderiza en `reportes/page.tsx` debajo de los reportes (con su reimpresión de PDF por venta y filtro por cliente).

- **Qué pide:** "quitar el historial de ventas en ventas, eso debe estar en reportes."
- **Hoy:** `ventas/page.tsx` muestra el POS **y** el componente `VentasHistorial` (lista individual con reimpresión
  de PDF, filtro por cliente), visible solo para admin. *Reportes* ya tiene "Ventas por período" pero es **agregado**
  (totales por día/semana/mes), no la lista venta por venta.
- **Plan:** (1) quitar `VentasHistorial` de `ventas/page.tsx` → Ventas queda solo con el POS. (2) Agregar el historial
  a *Reportes* reutilizando el componente `VentasHistorial` que ya existe.
- **⚠️ Detalle técnico:** el framework de *Reportes* (`ReporteResultado`: columnas/filas de texto + exportar) **no soporta
  botones/enlaces por fila** (reimprimir el PDF de cada venta). Por eso conviene sumarlo como una **pestaña/sección
  "Historial de ventas" dentro de Reportes**, no como un `ReporteTipo` más. Esfuerzo: bajo-medio.

## T4 — Carrito de ventas como modal flotante estilo factura 🟡❓

**Avance:** ⏳ PENDIENTE

- **Qué pide:** "quitar el carrito de ventas en ventas y que esté de la misma manera del diseño de factura, o sea un modal flotante."
- **Hoy:** el carrito de Ventas **ya es un modal flotante** (botón fijo abajo-derecha + `Dialog` grande, hecho en esta misma etapa).
- **❓ Decisión que necesito:** como ya es modal flotante, entiendo que querés **rediseñar el contenido del modal para que
  se vea como la factura** (mismas columnas N°/Cantidad/Código/Detalle/P.Unit/Importe, encabezado con logo y empresa, totales
  estilo comprobante). ¿Es eso? ¿O te referís al carrito de **Proforma** (confirmame si ese todavía no es modal)?
  No quiero rehacer algo que ya está.

## T5 — Clientes: "Nombre" → "Razón Social" y "Nombre de factura" → "Contacto" 🟢

**Avance:** ✅ COMPLETADO (2026-08-10) — etiquetas cambiadas en `cliente-form.tsx` ("Nombre"→"Razón social", "Nombre de factura"→"Contacto"), encabezado de tabla y placeholder de búsqueda en `clientes-explorer.tsx`, y mensaje de validación en `lib/validations/cliente.ts`. **Sin migración**: las columnas `nombre` y `nombre_factura` quedan igual (no se pierde data).

- **Qué pide:** renombrar dos campos en el módulo Clientes.
- **Hoy:** `cliente-form.tsx` tiene "Nombre" (columna `nombre`) y "Nombre de factura" (columna `nombre_factura`). Ambas columnas existen.
- **Plan:** cambiar **solo las etiquetas visibles** (form + explorer + mensajes), manteniendo los nombres de columna
  `nombre` y `nombre_factura` → **cero migración, no se pierde data**. Esfuerzo: muy bajo.
- **⚠️ Detalle menor:** en los PDF, "Contacto" hoy = el **teléfono** del cliente (`Contacto: {telefono}`). Si en Clientes
  "Nombre de factura" pasa a llamarse "Contacto", quedan dos "Contacto" con sentidos distintos. Aclarar qué es "Contacto"
  (¿la persona de contacto?) para no confundir en el comprobante.

## T6 — Campo "con/sin factura" (S/F) en productos 🟡❓

**Avance:** ✅ COMPLETADO (2026-08-10) — columna `productos.con_factura` (la guarda `fn_guardar_producto`), checkbox en el form, badge **S/F** en explorer + POS + cotización. La venta guarda `ventas.con_factura` (selector "Factura" en el carrito, con default sugerido según los productos S/F). ⚠️ Falta **correr `supabase/37_con_factura.sql`** en dev y prod.
**Decisión (2026-08-10):** Dos partes. (1) Nueva columna `productos.con_factura boolean not null default true` + badge **"S/F"** en explorer/POS/cotización + control en el form. (2) La **venta** también guarda `ventas.con_factura`, elegido **al cobrar** (por defecto derivado de los productos del carrito, editable). Ese flag por venta es el que alimenta la estadística de T7.

- **Qué pide:** "agregar un nuevo campo para productos que son con o sin factura, algo como S/F."
- **Hoy:** `productos` **no** tiene ese campo.
- **Plan:** columna `con_factura boolean not null default true` en `productos` (script SQL nuevo, dev+prod+setup),
  checkbox/select en el form ("Con factura / Sin factura (S/F)"), y badge **"S/F"** en explorer, POS y cotización.
- **❓ Decisión de negocio (afecta T6, T7 y T10):** ¿"sin factura" es atributo del **PRODUCTO** o de la **VENTA**?
  Normalmente lo informal (S/F) es de la **transacción**. Si es del producto: ¿un producto S/F **solo** puede venderse sin
  factura? ¿una venta con productos mixtos (con y sin factura) cómo cuenta? **Recomendación:** marcar productos como S/F
  **y además** que la venta registre si fue con/sin factura (ver T7). Necesito la regla exacta.

## T7 — Estadística de ventas "sin factura" (separada de las con factura) 🟡❓

**Avance:** ✅ COMPLETADO (2026-08-10) — el reporte "Ventas por período" muestra KPIs separados **Con factura** y **Sin factura (S/F)** (sobre `ventas.con_factura`). Requiere el script 37.
**Decisión (2026-08-10):** La estadística se calcula sobre el flag `ventas.con_factura` (definido en T6). En Reportes (y/o Dashboard) se separan **Con factura** vs **Sin factura** (KPIs + serie + filtro). Depende de que T6 esté hecho primero.

- **Qué pide:** "nueva estadística de ventas especiales… una en especial únicamente para las sin factura."
- **Hoy:** Reportes/Dashboard no distinguen con/sin factura.
- **Plan:** separar en Reportes (y/o Dashboard) las ventas **con factura** vs **sin factura** (dos KPIs / dos series / filtro).
- **❓ Depende de T6:** para reportar "ventas sin factura" cada **venta** tiene que registrar esa condición. Si el flag es
  solo por producto, una venta mixta no se puede clasificar limpio. **Recomendación:** agregar `ventas.con_factura`
  (elegido al cobrar, con default derivado de los productos) además del atributo del producto. Definir junto con T6.

## T8 — Tipo de pago como opciones seleccionables (efectivo, QR, …) 🟡❓

**Avance:** ✅ COMPLETADO (2026-08-10) — proforma y venta con `<Select>` (Efectivo/QR/Transferencia/Tarjeta/Crédito, en `lib/tipos-pago.ts`); `ventas.tipo_pago` lo guarda la RPC y se muestra en el PDF de la factura. ⚠️ Falta **correr `supabase/36_venta_tipo_pago.sql`** en dev y prod. Pendiente menor: la conversión proforma→venta todavía no propaga el tipo de pago.
**Decisión (2026-08-10):** En **proforma Y venta**. Proforma: el input `tipo_pago` pasa de texto libre a `<Select>`. Venta: se agrega `ventas.tipo_pago` (columna + `fn_registrar_venta` + selector en el POS + mostrarlo en el PDF de la factura). Lista **fija** para arrancar: **Efectivo, QR, Transferencia, Tarjeta, Crédito** (se puede pasar a configurable más adelante).

- **Qué pide:** "en factura, en la parte de tipo de pago, opciones seleccionables (efectivo, QR, etc.), no escribir."
- **Hoy:** las **proformas** tienen `tipo_pago` como **texto libre** (y se imprime en el PDF de proforma).
  Las **ventas NO tienen `tipo_pago`** (ni en el schema, ni en la BD, ni en el PDF de la factura).
- **Plan (dos partes):**
  - **(a) Proforma:** cambiar el input de `tipo_pago` de texto libre a un `<Select>` con opciones. **Fácil.**
  - **(b) Venta/factura:** si querés el tipo de pago **en la factura**, hay que agregar la columna `ventas.tipo_pago`,
    pasarlo por `fn_registrar_venta`, poner el selector en el POS y mostrarlo en el PDF de venta. **Medio.**
- **❓ Decisión:** ¿tipo de pago **solo en proforma**, o **también en la venta/factura**? ¿Lista de opciones **fija**
  (Efectivo, QR, Transferencia, Tarjeta, Crédito) o **configurable** desde Configuración? **Recomendación:** lista fija
  para empezar + agregarlo a la venta (que es "la factura").

## T9 — Validez de la oferta en proforma + leyenda al imprimir ✅🟡

**Avance:** ⏳ PENDIENTE (base ya existente; faltan los incrementos)

- **Qué pide:** "validez de la oferta en proforma… si pasan esos días ya no vale… que al imprimir salga abajo la validez."
- **Hoy — ya existe casi todo:** `proformas.plazo_validez_dias` (default 15), estado **`vencida`** derivado en `vista_proformas`,
  y el PDF **ya imprime** al pie: *"La cotización solo tiene validez por el plazo de N día(s)."*
- **Plan (solo los incrementos que faltan):**
  - Mostrar en **pantalla** (form/listado de proformas) un badge de validez y si está **vigente/vencida**.
  - Mejorar el texto impreso para mostrar la **fecha concreta de vencimiento** ("Válida hasta DD/MM/AAAA",
    calculada como `creado_en + plazo_validez_dias`) en vez de solo "N días".
- **Nota:** gran parte ya está hecha — lo señalo para no rehacerlo. Confirmame si querés el badge en pantalla y la fecha concreta.

## T10 — Que en cotización aparezcan los productos S/F 🟡❓

**Avance:** ✅ COMPLETADO (2026-08-10) — la cotización muestra el badge **S/F** en cada producto (según `con_factura`). Requiere el script 37.
**Decisión (2026-08-10):** Mostrar el **badge "S/F"** en cada producto dentro de la cotización (según el campo `con_factura` de T6). No se filtra ni se excluye nada. Depende de T6.

- **Qué pide:** "que en cotización aparezcan los productos s/f."
- **Hoy:** la cotización busca con `buscarProductosParaCotizacion` y **ya muestra todos** los productos que encuentra.
- **❓ Decisión (depende de T6):** ¿qué significa "que aparezcan"?
  (a) que se **vea el badge "S/F"** en cada producto de la cotización, o
  (b) que la cotización sea **solo** de productos S/F, o
  (c) que hoy los S/F se **excluyan** de algún lado y en cotización sí deban aparecer.
  **Recomendación:** (a) mostrar el badge. Esfuerzo bajo una vez hecho T6.

## T11 — "Precio de venta en venta" 🟡❓

**Avance:** ⏳ PENDIENTE

- **Qué pide:** "Precio de venta en venta."
- **Hoy:** el POS **ya muestra** el precio en las tarjetas de resultado (`Bs …`) y el **precio unitario es editable**
  en el carrito.
- **❓ Decisión que necesito (con un ejemplo):** no me queda claro qué agrega. ¿Mostrar el precio más destacado?
  ¿Mostrar precio de venta **vs** costo? ¿Una columna de precio en el historial? ¿Otra cosa? Contame el caso concreto.

## T12 — Módulo *Cajero*: cobrar ventas, solo para el rol cajero 🔴❓

**Avance:** ✅ COMPLETADO (2026-08-10) — rol `cajero` habilitado. El POS (`/ventas`) y la acción `registrarVenta` quedan **solo para `cajero` y `admin`** (el vendedor ya no ve ni usa Ventas). Nav: el cajero ve Productos, Inventario, Clientes, Cotización y Ventas. Alta de cajero desde **Configuración → Usuarios**. ⚠️ Falta **correr `supabase/38_rol_cajero.sql`** en dev y prod. Decisión del sub-detalle (2026-08-10): **Solo Cajero y Admin operan el POS**.
**Decisión (2026-08-10):** **Flujo B (solo permiso).** Se agrega el rol `cajero` y el cierre/cobro de ventas queda restringido a `cajero` (y `admin`). Implica: ALTER del `check` de `perfiles.rol` (dev+prod+setup), tipo `Rol`, `nav-items.ts`, helpers de sesión (`esCajero`) y la guarda en la acción `registrarVenta` / botón "Confirmar venta" del POS. Sin bandeja de pendientes ni estado nuevo. ⚠️ Sub-detalle a confirmar al implementar: si el **vendedor** conserva el POS solo para armar el carrito o si el POS pasa a ser de `cajero`/`admin`.

- **Qué pide:** "Módulo Cajero — cobrar ventas únicamente para el rol de cajero."
- **Hoy:** roles = **`admin | vendedor`** (`check (rol in ('admin','vendedor'))` en `perfiles.rol`, tipo TS `Rol`,
  `nav-items.ts`, RLS con `fn_es_admin()` / `fn_mi_sucursal()`). Las ventas se registran **atómicas** con
  `fn_registrar_venta` (finales, descuentan stock al instante). **No existe** el concepto "venta pendiente de cobro".
- **Plan (tarea grande, en dos frentes):**
  1. **Nuevo rol `cajero`:** ALTER del `check` de `perfiles.rol` (dev+prod+setup), tipo `Rol`, `nav-items.ts`,
     helpers de sesión (`esCajero`/`requireCajero`) y políticas RLS.
  2. **Definir el FLUJO de cobro** (hoy no hay "venta pendiente"). Dos caminos:
     - **A — Flujo de cobro real:** el vendedor arma la venta y queda **PENDIENTE** (nueva columna de estado/pago);
       el **cajero la cobra** (confirma el pago y **recién ahí** se descuenta el stock). Implica partir `fn_registrar_venta`
       en "crear pendiente" + "cobrar", una pantalla **Cajero** (bandeja de ventas por cobrar), estados y RLS nuevas. **Grande.**
     - **B — Solo permiso:** el cajero es el **único rol** que puede apretar "Confirmar venta" en el POS. Mucho más simple,
       pero cambia poco el negocio (no hay bandeja de pendientes). **Chico-medio.**
- **❓ Decisión (clave):** ¿querés el **flujo A** (vendedor deja la venta para cobrar, el cajero cobra y ahí se descuenta stock)
  o el **flujo B** (el cajero es el único que cierra ventas)? Es la diferencia entre ~1 día y ~1 semana de trabajo.
  Es la tarea más grande de la lista; conviene detallarla en su propio mini-flujo.

---

## Resumen de fallas / cosas a decidir antes de codificar

| # | Tarea | Avance | Decisión / qué falta definir |
|---|---|---|---|
| T1 | Kilos/litros | ✅ COMPLETADO | Correr `35_unidades_kg_litro.sql` en dev+prod. |
| T2 | Alt+Enter | ⏳ PENDIENTE | ❓ Falta un **ejemplo concreto** de qué hace y en qué campo. |
| T3 | Historial→Reportes | ✅ COMPLETADO | — |
| T4 | Carrito modal factura | ⏳ PENDIENTE | ❓ Confirmar: ¿rediseñar el modal **como factura**? ¿o es la Proforma? |
| T5 | Renombrar en Clientes | ✅ COMPLETADO | — |
| T6 | Campo S/F en producto | ✅ COMPLETADO | Correr `37_con_factura.sql` en dev+prod. |
| T7 | Stat ventas S/F | ✅ COMPLETADO | Correr `37_con_factura.sql` en dev+prod. |
| T8 | Tipo de pago selección | ✅ COMPLETADO | Correr `36_venta_tipo_pago.sql` en dev+prod. |
| T9 | Validez proforma | ⏳ PENDIENTE | ❓ Confirmar: ¿sumo **badge en pantalla + fecha concreta** al imprimir? |
| T10 | S/F en cotización | ✅ COMPLETADO | Correr `37_con_factura.sql` en dev+prod. |
| T11 | Precio de venta en venta | ⏳ PENDIENTE | ❓ Falta un **ejemplo concreto** de qué agrega. |
| T12 | Módulo Cajero | ✅ COMPLETADO | Correr `38_rol_cajero.sql` en dev+prod. |

**Observación transversal:** hay un **cluster con/sin factura** (T6 → T7 → T10) que se resuelve de una vez si definimos
primero el modelo (producto vs venta). Y hay **tres tareas que necesitan un ejemplo concreto** para poder planificarlas
bien: **T2, T4 y T11**.

## Orden de implementación sugerido

1. **Quick wins ya definidos:** T3 (historial→reportes), T5 (renombrar clientes), T9 (incrementos de validez), T8(a) (select de tipo de pago en proforma).
2. **Cluster con/sin factura:** T6 → T7 → T10 (una vez cerrado el modelo).
3. **T8(b):** tipo de pago en la venta/factura (si se confirma).
4. **T4:** rediseño del modal como factura (tras confirmar alcance).
5. **T1:** kilos/litros (según entero vs decimal).
6. **T2 y T11:** tras el ejemplo concreto.
7. **T12 (Cajero):** al final; es lo más grande y necesita el flujo definido.
