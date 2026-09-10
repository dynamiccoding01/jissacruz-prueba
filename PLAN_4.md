# PLAN_4.md — Cuarta tanda de tareas (una por una)

> Tareas nuevas del cliente, casi todas sobre el módulo **Cotización S/F**. Hechas **de a una**: implementar → probar → confirmar → siguiente.
> Inicio: 2026-09-10.
> Repo de trabajo: `origin` (jissacruz-prueba) — acá se hacen todas las pruebas. `produccion` solo recibe lo ya probado.
> Referencia visual: 4 imágenes del sistema **"Velacuss"** que pasó el cliente. **No se copia el diseño**; sí la **información** que debe estar presente.

---

## Contexto y decisión de fondo

Las 7 tareas transforman **Cotización** de un cotizador efímero (imprime, no guarda, sin cliente) en un **módulo persistido con historial**, que en la práctica es la versión **S/F (sin factura)** de Proforma.

**Decisión de arquitectura:** **espejar el módulo Proformas** (tabla + trigger de numeración + trigger de validación de línea + explorer con filtro de fechas + página `nueva` + ruta PDF). Proformas ya tiene casi todo lo que pide el cliente: plazo de validez, tiempo de entrega, glosa, filtro desde/hasta, botón "Nueva" y PDF. Reusamos ese patrón en vez de inventar nada nuevo.

**Diferencias de Cotización vs Proforma:** cliente **opcional** (permite "SIN NOMBRE"), **solo productos S/F** (`con_factura = false`), numeración **`COT-0001`**, y **sin ciclo de estados/convertir** (es referencial: se guarda, se lista, se imprime — fuera de alcance por ahora convertirla a venta).

### Información que debe llevar (según las imágenes)

- **Documento impreso (PDF):** N° de cotización, **Señor(es) / Contacto / Dirección** (cliente, puede ser SIN NOMBRE), **Tipo de pago**, **Glosa**, tabla **N° · Cantidad · Código · Línea (marca) · Detalle · P. Unit · Importe**, **Total**, total en letras (ej. "Doscientos 00/100 Bolivianos"), texto de **validez del plazo** ("La cotización solo tiene validez por el plazo de N día(s)") y **Tiempo de entrega**.
- **Pantalla de armado (nueva):** cliente (opcional), tipo de pago, plazo de validez, tiempo de entrega, **glosa**, buscador con criterios, y líneas que muestran **Unidad de medida**, **Línea/Marca** y **Código original**.
- **Historial (lista):** filtros **fecha desde/hasta (default: hoy)**, buscador, botón **"Nueva cotización"** arriba, tabla **paginada** (Nro, Sucursal, Vendedor/Cajero, Cliente, Fecha, Total, Acciones: ver/PDF).

### Orden de ejecución

1. **T1, T2** — quick wins independientes, **sin tocar BD**.
2. **T5** (base: tablas + numeración + guardar) → **T6** (historial/lista) → **T7** (glosa) → **T3** (unidad) → **T4** (marca + mayorista) — el módulo persistido nuevo, todo encadenado.

### Scripts SQL de esta tanda

La base está en el script **38**. Lo nuevo de T5 arranca en el **`39`** y hay que correrlo en **dev + prod** y reflejarlo en `supabase/produccion_setup.sql`. T1–T4 y T6–T7 no agregan esquema (salvo lo que ya trae T5).

---

## T1 — Renombrar el ítem del sidebar a "Cotización S/F" ✅ COMPLETADO (2026-09-10)

**Qué pide:** que en el sidebar, donde dice "Cotización", diga **"Cotización S/F"**.

**Cómo quedó:**
- Etiqueta cambiada en `components/shared/nav-items.ts` (el `href` `/cotizacion` no cambió, solo el texto).
- Título de la página (`app/(dashboard)/cotizacion/page.tsx`) renombrado de "Cotización de precios" a **"Cotización S/F"**.

**SQL:** ninguno.

**Prueba:** en el sidebar aparece **"Cotización S/F"**; al entrar, el título de la página también dice Cotización S/F.

---

## T2 — Que en Ventas no se pueda modificar el precio ✅ COMPLETADO (2026-09-10)

**Qué pide:** en el proceso de **ventas (POS)** no se debe poder cambiar el precio unitario de los productos.

**Decisión aplicada (defaults confirmados con "ok hazlo" — revisar si hace falta):**
- El precio unitario en el POS pasa de `<input>` editable a **texto de solo lectura**. Se mantiene el **ajuste automático por mayoreo** (el precio sigue cambiando solo cuando la cantidad alcanza una escala); solo se quita la edición **manual**.
- **Alcance:** solo **Ventas/POS**. Proforma y Cotización siguen con precio editable.
- **Rol:** bloqueado para **todos** (cajero y admin).
- **Descuento:** el descuento por línea **sigue editable**.

**Cómo quedó:**
- En `app/(dashboard)/ventas/pos.tsx`: el input de `items.${index}.precio_unitario` se reemplazó por un `<span>` de solo lectura (`{bs(...)}`); el valor sigue en el form (se fija al agregar y se ajusta solo por mayoreo). `npm run lint` limpio.

**SQL:** ninguno.

**Prueba:** POS → agregar producto → el precio **no** se puede editar a mano; al subir la cantidad y cruzar una escala por mayor, el precio se ajusta solo; el descuento sí se puede tocar.

---

## T5 — Guardar cada cotización + persistencia (base del módulo) ⬜ PENDIENTE

> Se hace **antes** de T6/T7/T3/T4 porque es la base: sin guardar no hay historial.

**Qué pide:** que cada cotización se pueda **guardar** (similar a Ventas/Facturación), sin depender de imprimir.

**Decisión (cerrada con las imágenes):** cliente **opcional** (permite SIN NOMBRE, como la imagen "PROFORMA No. 2303"). Módulo espejo de Proformas, solo S/F, numeración `COT-0001`, sin ciclo de estados.

**Cómo quedará:**
- **BD (script `39_cotizaciones.sql`):**
  - Tablas `cotizaciones` (numero `COT-`, `cliente_id` **nullable**, `tipo_pago`, `plazo_validez_dias`, `tiempo_entrega_dias`, `glosa`, `subtotal`, `descuento_tipo/valor`, `impuesto_porcentaje`, `total`, `sucursal_id`, `creado_por`, `creado_en`) y `cotizacion_items` (`cantidad`, `precio_unitario`, `descuento_tipo/valor`, `subtotal_linea`).
  - Secuencia + trigger `BEFORE INSERT` para el correlativo `COT-0001` (patrón del script `02`).
  - Trigger de validación de línea (recalcula `subtotal_linea`), calcado de `fn_proforma_items_validar`. **No usa RPC** porque no mueve stock.
  - **RLS**: `select`/`insert` para autenticados; scoping por sucursal para vendedor (igual que proformas desde el script `30`).
- **App:** Server Action `guardarCotizacion(...)` en `cotizacion/actions.ts` (inserta cabecera + ítems), validación zod en `lib/validations/cotizacion.ts`.
- El botón pasa de solo **"Imprimir"** a **"Guardar"** (y "Guardar e imprimir"), que persiste y abre el PDF.

**SQL pendiente:** ⚠️ correr `39_cotizaciones.sql` en **dev + prod** y reflejar en `produccion_setup.sql`.

**Prueba:** armar una cotización → **Guardar** → queda con número `COT-000X` y aparece luego en el historial (T6).

---

## T6 — Que Cotización abra mostrando el historial (default: hoy) ⬜ PENDIENTE

**Qué pide:** al apretar **"Cotización S/F"** en el sidebar, que lo primero sea el **historial** — las cotizaciones **del día por defecto**, paginadas, con un selector de fechas **desde/hasta**, y el botón **"Nueva cotización"** arriba.

**Cómo quedará:** reestructurar el módulo al patrón de Proformas:
- `cotizacion/page.tsx` → **explorer/historial** (Server Component que carga las cotizaciones) + `cotizacion/cotizaciones-explorer.tsx` (tabla con `TablaDatos`, filtro **fecha desde/hasta arrancando en HOY**, buscador, paginación, botón "Nueva cotización").
- `cotizacion/nueva/page.tsx` → el **cotizador actual** (el form de armado).
- Columnas de la tabla: Nro · Fecha · Cliente · Total · Acciones (ver / descargar PDF). *(Sucursal/Vendedor si aplica, como en la imagen "Ventas electronicas".)*
- Ruta PDF `app/api/pdf/cotizacion/[id]/route.tsx` + documento `lib/pdf/cotizacion-document.tsx` (con total en letras, validez y tiempo de entrega, como las imágenes).

**SQL:** ninguno extra (usa las tablas de T5).

**Prueba:** entrar a Cotización S/F → se ven las cotizaciones **de hoy** paginadas; cambiar el rango de fechas filtra; "Nueva cotización" abre el form; guardar vuelve y aparece en la lista.

---

## T7 — Glosa en la cotización ⬜ PENDIENTE

**Qué pide:** un campo **Glosa** al hacer la cotización (ej.: "ya le di adelanto", etc.).

**Cómo quedará:** campo `glosa` (textarea) en el form de `cotizacion/nueva`, ya persistido por T5 (columna `cotizaciones.glosa`), y mostrado en el PDF (igual que la imagen, con el rótulo "GLOSA:").

**SQL:** ninguno extra (la columna entra en el script `39` de T5).

**Prueba:** al armar una cotización se puede escribir una glosa; se guarda y sale impresa en el PDF.

---

## T3 — Mostrar la Unidad de los productos en Cotización ⬜ PENDIENTE

**Qué pide:** que Cotización esté bien estructurada como las demás (facturación/ventas) y muestre la **Unidad de medida** de los productos — hoy en Cotización no aparece.

**Dato:** Cotización **ya captura** la unidad en cada ítem; solo falta **mostrarla** en las líneas (hoy sale solo en los resultados de búsqueda como "/ unidad"). `fn_buscar_productos` ya la devuelve (`select p.*`).

**Cómo quedará:** mostrar la **Unidad de medida** en la línea del pedido (columna o rótulo bajo el detalle), como en la imagen "PROFORMA" de Velacuss (`UNIDAD DE MEDIDA: PIEZAS`). Alinear el formato de la tabla al de Ventas/Proforma.

**SQL:** ninguno.

**Prueba:** en Cotización, cada línea muestra la unidad del producto (ej. "PIEZAS").

---

## T4 — Precio por mayorista y Marca (Línea) en Cotización ⬜ PENDIENTE

**Qué pide:** que en Cotización esté también el **precio por mayorista** y la **marca**.

**Datos:**
- **Mayorista:** Cotización **ya aplica** el precio escalonado automáticamente al subir la cantidad (`precioSegunCantidad`). Falta **mostrarlo** (ej. las escalas / precio por mayor visible en el resultado o la línea).
- **Marca (`linea_marca`):** `fn_buscar_productos` ya la devuelve (`select p.*`); Cotización solo no la mapea. Es sumarla al tipo y mostrarla como **columna "Línea"** (como en las imágenes, `LINEA: INCODIESEL`).

**Cómo quedará:** mapear `linea_marca` en `buscarProductosParaCotizacion` y mostrarlo como **Línea** en resultados y en la línea del pedido; mostrar el/los **precio(s) por mayor** vigentes en el resultado de búsqueda.

**SQL:** ninguno.

**Prueba:** buscar un producto en Cotización → se ve su **Línea/Marca** y su **precio por mayor**; al alcanzar la cantidad mínima, el precio de la línea baja al mayorista.

---

## Decisiones abiertas (para arrancar sin trabarnos)

- **T2:** (1) ¿excepción para **admin** o bloqueado para todos? (2) ¿bloqueo **solo el precio** o también el **descuento**? (3) ¿**solo POS**, o también fijar precio en Proforma/Cotización? — *propuesta: todos / solo precio / solo POS.*
- **T4:** ¿el **mayorista** hay que **mostrarlo** (ya se aplica solo) — como escalas visibles en el resultado? — *propuesta: sí, mostrarlo en el resultado de búsqueda.*
