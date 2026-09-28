# PLAN_6.md — Sexta tanda de tareas (una por una)

> Tareas nuevas del cliente. Hechas **de a una**: implementar → probar → confirmar → siguiente.
> Inicio: 2026-09-27.
> **Todo va a los dos entornos:** código a `origin` (jissacruz-prueba) **y** `produccion` (JissaCruz_Project); cada script SQL en la base de **desarrollo y en la de producción**. `produccion` recibe lo ya probado.

---

## Decisiones cerradas (con el cliente, 2026-09-27)

- **T1 (Proforma) descuentos:** se quitan **los dos** — el descuento **global** y el **por línea**.
- **T2 (POS) descuentos:** se quitan **también** en el POS (global y por línea). El POS cobra siempre el precio del sistema.
- **T2 piso de precio:** el precio unitario mínimo es **el que corresponde a la cantidad** — el precio normal, o el **precio por mayor vigente** si la cantidad alcanza su escala (misma regla que `precioSegunCantidad`). Se puede **subir**, nunca **bajar** de ese piso. Aplica a **Proforma** (alta y edición) y **POS**. **Cotización S/F no cambia** (no se pidió).
- **T3 (Dashboard) nombre y contenido:** cuadro **"Rentabilidad"** con **Ingresos por ventas** (netos, sin impuesto), **Costo de ventas** (costo FIFO de lo vendido), **Utilidad bruta** y **Margen bruto (%)**. Solo admin (el dashboard ya es solo admin).
- **T3 período:** selector **Hoy / Este mes / Este año**, arranca en **Este mes**. Los cortes se calculan en **hora de Bolivia** (UTC−4), no en la del servidor.

### Orden de ejecución
1. **T1** — sin descuentos en Proforma (alta + edición).
2. **T2** — piso de precio en Proforma + POS, y sin descuentos en el POS (script `41`).
3. **T3** — cuadro de Rentabilidad en el dashboard (script `42`).

### Scripts SQL de esta tanda
La base está en el **40** (✅ corrido en dev + prod el 2026-09-27). Lo nuevo — **✅ 41 y 42 corridos en dev + prod (2026-09-27)**, verificado con `pg_proc` (existen `fn_precio_minimo`, `fn_proformas_sin_descuento`, `fn_resumen_rentabilidad`):
- `41_precio_minimo_sin_descuentos.sql` (T1 + T2) — **requiere el 40**.
- `42_rentabilidad.sql` (T3).

---

## T1 — Proforma sin descuentos ✅ COMPLETADO (2026-09-27) — script `41` corrido en dev + prod

**Qué pide:** quitar la opción de descuento en proforma (la imagen muestra "Descuento global").
**Decisión:** se quitan el global **y** el de cada línea.

**Cómo quedó:**
- `proformas/proforma-form.tsx` (alta) y `proformas/[id]/proforma-detalle.tsx` (edición): sin columna "Descuento" en las líneas ni bloque "Descuento global". Queda el campo Impuesto %.
- `proformas/actions.ts`: `createProforma` / `updateProforma` **fuerzan** descuento nulo (cabecera e ítems) aunque llegue otra cosa.
- Proformas **históricas** con descuento: se siguen viendo y el PDF lo sigue mostrando. **Al editarlas** el descuento se quita (aviso en pantalla) y el total se recalcula sin él.
- **BD (script `41`)**: el trigger `fn_proforma_items_validar` rechaza ítems nuevos con descuento, y un trigger nuevo en `proformas` rechaza descuento global al crear/editar. Las filas viejas no se tocan (convertir/revalidar siguen funcionando).

**Prueba:** Nueva proforma → no aparece ningún descuento. Abrir una proforma vieja con descuento → avisa, al guardar queda sin descuento.

---

## T2 — Precio unitario mínimo (Proforma y POS) ✅ COMPLETADO (2026-09-27) — script `41` corrido en dev + prod

**Qué pide:** que no se pueda bajar el precio unitario por debajo del que está en el sistema, en Proforma y en Ventas (POS).

**Cómo quedó:**
- **Proforma (alta y edición):** el precio sigue editable **hacia arriba**. Si se escribe uno menor al piso, al salir del campo vuelve al piso y avisa. Al guardar se revisan todas las líneas. En edición, "Traer precios actuales" ahora respeta el precio por mayor de la cantidad.
- **POS:** el precio ya era de solo lectura (PLAN_4 · T2); ahora **sin descuentos** (ni por línea ni global).
- **Servidor:** `validarPrecioMinimo()` en `lib/precios-mayor-server.ts` — lo usan `createProforma`, `updateProforma` y `crearVentaPendiente`.
- **BD (script `41`):** función `fn_precio_minimo(producto, cantidad)` (precio por mayor vigente de la escala alcanzada, o el precio normal). La usan el trigger de `proforma_items` y `fn_crear_venta_pendiente` (que además rechaza descuentos). **El check de la BD es la garantía.**
- **Ojo al editar proformas viejas:** si el producto subió de precio, hay que subir la línea (botón "Traer precios actuales") para poder guardar — es la regla.
- **No cambia:** Cotización S/F (precio y descuento siguen como estaban); la conversión Proforma → Venta usa el precio ya pactado en la proforma.

**Prueba:** Proforma → escribir un precio menor al del sistema → vuelve al piso con aviso. Subirlo → se acepta. Con cantidad que alcanza precio por mayor → el piso pasa a ser el mayorista. POS → no hay descuentos.

---

## T3 — Rentabilidad en el dashboard ✅ COMPLETADO (2026-09-27) — script `42` corrido en dev + prod

**Qué pide:** ver en el dashboard (admin) la diferencia entre compra y venta: con cuánto ingresó y cuál es la ganancia, con nombres profesionales.

**Cómo quedó:**
- **BD (script `42`):** RPC `fn_resumen_rentabilidad(p_periodo)` (`'hoy' | 'mes' | 'anio'`, solo admin). Suma **en la base** (sin el tope de 1000 filas de la API):
  - **Ingresos por ventas** = total de las ventas **sin impuesto** (`total / (1 + impuesto%)`).
  - **Costo de ventas** = `cantidad × costo_fifo_unitario` de cada línea vendida (el costo real de compra, por FIFO).
  - **Utilidad bruta** = ingresos − costo. **Margen bruto** = utilidad / ingresos.
  - Además cuenta las **líneas vendidas sin costo** (costo 0, p. ej. stock cargado por ajuste sin costo): si hay, el dashboard avisa que la utilidad puede estar inflada.
  - Cortes de período en **hora de Bolivia** (`America/La_Paz`).
- **Dashboard:** bloque "Rentabilidad" con selector Hoy / Este mes / Este año (`/dashboard?periodo=...`) y 4 indicadores. De paso, "Ventas de hoy" y el gráfico de 7 días pasan a cortar el día en hora de Bolivia (en Vercel el servidor está en UTC y después de las 20:00 contaba el día siguiente).

**Prueba:** Dashboard como admin → bloque Rentabilidad en "Este mes"; cambiar a Hoy / Este año; comparar ingresos con el reporte de ventas del mismo período.

---

## T4 — Ganancias separadas: con factura y sin factura (sin mezclarlas) ✅ COMPLETADO (2026-09-27) — script `43` corrido en dev + prod

**Qué pide:** separar las ganancias **con factura** de las **sin factura**, sin mezclarlas. Hoy el bloque Rentabilidad de T3 las suma juntas.

### Decisiones cerradas (con el cliente, 2026-09-27)
- **Criterio:** manda **si se emitió factura en la venta** (`ventas.con_factura`, lo que marca el cajero al cobrar). Un producto normal vendido sin factura cuenta en **sin factura**.
- **No se mezcla:** un pedido del POS es **todo con factura o todo S/F**. Si se intenta agregar un producto del otro tipo, el POS avisa y no deja; va en un pedido aparte.
- **Alcance:** **dashboard** (dos bloques) **+ reporte nuevo "Rentabilidad"** en Reportes (por día/semana/mes, exportable a PDF y Excel).
- **Impuestos:** **antes de impuestos**, misma fórmula para las dos (Ingresos sin impuesto − Costo de ventas FIFO). No se estiman IVA/IT: el sistema no guarda las facturas de compra (crédito fiscal). Los calcula el contador.
- **Nunca un total combinado:** en ningún lugar se muestra "con + sin factura" sumado.

### Reglas que se derivan (para que la separación sea confiable)
1. **Un producto S/F nunca se vende con factura.** Pedido S/F ⇒ la Caja lo cobra **sí o sí sin factura** (el selector queda fijo). Pedido normal ⇒ la Caja arranca en "Con factura" y el cajero puede pasarlo a "Sin factura" (cliente que no pide factura).
2. **Proforma: tampoco se mezcla** (✅ confirmado por el cliente, 2026-09-27). Una proforma se convierte en venta, así que sigue la misma regla que el POS; al convertir, la venta sale **con factura** si la proforma es de productos normales y **sin factura** si es de productos S/F (hoy siempre sale "con factura").
3. **La BD es la garantía:** las reglas 1 y 2 se exigen también en las funciones de la base, no solo en pantalla.

### Cómo quedará

**BD — script `43_rentabilidad_por_factura.sql`** (dev + prod + `produccion_setup.sql`):
- `fn_crear_venta_pendiente` (POS): rechaza pedidos que mezclen productos con factura y S/F.
- `fn_registrar_venta`: rechaza `con_factura = true` si algún ítem es un producto S/F. Si el payload no trae `con_factura`, lo **deriva** de los productos.
- `fn_convertir_proforma_a_venta`: deja de mandar siempre "con factura"; lo deriva de los productos de la proforma.
- Trigger de `proforma_items`: rechaza mezclar tipos dentro de una misma proforma (si se confirma la regla 2).
- **RPC nueva `fn_rentabilidad_por_factura(p_periodo)`** (hoy / mes / año, solo admin): devuelve **siempre 2 filas**, una con factura y otra sin factura (aunque alguna esté en cero), con ventas, ingresos, costo, utilidad y líneas sin costo. Hora de Bolivia. Reemplaza en el dashboard a `fn_resumen_rentabilidad` (script 42), que queda sin uso y se puede borrar más adelante.
- **RPC nueva `fn_reporte_rentabilidad(p_desde, p_hasta, p_agrupacion)`** (diario / semanal / mensual, solo admin): una fila por período y tipo de factura, sumada en SQL (sin el tope de 1000 filas).

**App:**
- **POS** (`ventas/pos.tsx`, `ventas/actions.ts`): etiqueta del pedido "Con factura" / "Sin factura (S/F)" según el primer producto; bloqueo y aviso al querer mezclar; la action lo vuelve a validar.
- **Caja** (`caja/`): la tarjeta muestra si el pedido es S/F; en el cobro, el selector de factura queda fijo en "Sin factura" para pedidos S/F.
- **Proforma** (alta y edición): mismo bloqueo de mezcla (si se confirma la regla 2).
- **Dashboard:** el bloque Rentabilidad pasa a **dos paneles lado a lado**, "Con factura" y "Sin factura (S/F)", cada uno con Ingresos, Costo de ventas, Utilidad bruta, Margen bruto y cantidad de ventas. Mismo selector Hoy / Este mes / Este año.
- **Reportes:** tipo nuevo **"Rentabilidad"** — rango de fechas + agrupación; **una tabla Con factura y otra Sin factura** (Período, N.º ventas, Ingresos, Costo, Utilidad, Margen); resumen con la utilidad y el margen **de cada una por separado**; gráfico con **dos series** (una por tipo). PDF con las dos tablas; Excel con **una hoja por tipo** (hoy la hoja extra se llama fija "En tránsito": se generaliza al título del bloque).

### Historial (lo que ya se vendió)
- Cada venta vieja cuenta según su `ventas.con_factura`. Las anteriores al script 37 quedaron todas "con factura" (default), y las convertidas desde proforma también.
- **Diagnóstico corrido en prod el 2026-09-27: 0 filas** — ninguna venta vieja marcada "con factura" trae productos S/F. El historial está limpio, no hay nada que corregir.

```sql
-- Ventas marcadas CON factura que traen algún producto S/F (inconsistentes)
select v.numero, v.creado_en, v.total
from public.ventas v
where v.con_factura
  and exists (select 1 from public.venta_items vi
              join public.productos p on p.id = vi.producto_id
              where vi.venta_id = v.id and not p.con_factura)
order by v.creado_en;
```

### Orden de ejecución
1. Diagnóstico del historial (la consulta de arriba, en prod).
2. Script `43` (reglas + las 2 RPC nuevas) → correr en dev.
3. POS + Caja + Proforma (no mezclar; S/F ⇒ sin factura).
4. Dashboard en dos paneles.
5. Reporte "Rentabilidad" + PDF + Excel.
6. `tsc` + lint → pruebas en `localhost` → confirmar → script 43 en prod → push a los 2 repos → `vercel --prod`.

**Ojo al desplegar:** el 43 endurece reglas que la versión publicada todavía no conoce (mezclar en el POS, cobrar S/F con factura). Si se corre en prod antes de desplegar el código nuevo, esos casos dan error con mensaje claro en vez de guardarse mal. Conviene desplegar enseguida después de correrlo.

### Cómo quedó (2026-09-27)
- **BD:** `43_rentabilidad_por_factura.sql` tal como está descrito arriba (reflejado en `produccion_setup.sql`).
- **POS:** etiqueta "Con factura" / "Sin factura (S/F)" en el pedido; al querer mezclar, aviso y no agrega. `crearVentaPendiente` lo revalida con `validarSinMezclaFactura()` ([lib/factura-server.ts](lib/factura-server.ts)).
- **Caja:** badge S/F en la tarjeta; en el cobro de un pedido S/F el selector queda fijo en "Sin factura".
- **Proforma (alta y edición):** badge S/F en los resultados, etiqueta del tipo en Ítems y bloqueo de mezcla; `createProforma`/`updateProforma` lo revalidan. Una proforma vieja que ya mezclaba no se puede volver a guardar sin sacar los productos de un tipo (se puede convertir igual: la venta sale sin factura).
- **Dashboard:** dos paneles lado a lado (`dashboard/rentabilidad-panel.tsx`) con `fn_rentabilidad_por_factura`.
- **Reportes:** tipo nuevo **Rentabilidad** — tabla "Con factura" + tabla "Sin factura (S/F)", cada una con fila TOTAL; resumen con utilidad y margen de cada una; gráfico con dos series; PDF con las dos tablas; Excel con hojas "Con factura" y "Sin factura (SF)".
- **De paso:** la ruta `/api/pdf/reporte` ahora exige admin (antes cualquier usuario logueado podía bajar un reporte, y este trae costos y utilidades).

**Prueba:** POS → agregar un producto normal y después uno S/F → no deja. Pedido S/F → en Caja el selector queda en "Sin factura". Dashboard → dos paneles que no se suman. Reportes → Rentabilidad del mes → dos tablas, PDF y Excel con las dos por separado.

---

## Arreglos de la revisión del sistema ✅ COMPLETADO (2026-09-27) — sin SQL para correr

Encontrados en la inspección del 2026-09-27 y aprobados por el cliente ("sí, hazlo").

1. **Instalador `produccion_setup.sql` completo:** le faltaban los scripts **35–38** (saltaba del 34 al 39). Se insertaron en orden antes del 39. Una base nueva armada con ese archivo ahora queda con `tipo_pago`, `con_factura`, rol `cajero` y unidades KG/LT. **No hay que correr nada** en las bases actuales (ya los tienen).
2. **Cada rol entra a su pantalla:** `rutaInicio(rol)` en `lib/auth/session.ts` — admin → Dashboard, **cajero → Caja** (antes caía en Proformas, que no es de su rol), vendedor → Proformas. Lo usan el login, la raíz `/` y las guardas. Nueva guarda `requireRol([...])`: Proformas (lista, nueva y detalle) y Pedidos entre sucursales quedan solo para admin + vendedor; Caja para admin + cajero; POS para admin + vendedor. Las acciones de escritura de Proformas y Pedidos también chequean el rol.

**Prueba:** iniciar sesión como cajero → entra directo a **Caja**; escribir `/proformas` o `/traspasos` en la barra → vuelve a Caja.

**Pendiente (decisión del cliente):** convertir una proforma en venta la registra directo, sin pasar por Caja. ¿Debe ir a Caja como pedido pendiente?
