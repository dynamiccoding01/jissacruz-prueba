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
La base está en el **40** (⚠️ confirmar que el `40_ventas_pendientes.sql` ya corrió en **producción**: el esquema de prod del 2026-09-27 no lo tenía). Lo nuevo:
- `41_precio_minimo_sin_descuentos.sql` (T1 + T2) — **requiere el 40**.
- `42_rentabilidad.sql` (T3).

---

## T1 — Proforma sin descuentos ✅ CÓDIGO LISTO (2026-09-27) — ⚠️ falta correr `41` en dev + prod

**Qué pide:** quitar la opción de descuento en proforma (la imagen muestra "Descuento global").
**Decisión:** se quitan el global **y** el de cada línea.

**Cómo quedó:**
- `proformas/proforma-form.tsx` (alta) y `proformas/[id]/proforma-detalle.tsx` (edición): sin columna "Descuento" en las líneas ni bloque "Descuento global". Queda el campo Impuesto %.
- `proformas/actions.ts`: `createProforma` / `updateProforma` **fuerzan** descuento nulo (cabecera e ítems) aunque llegue otra cosa.
- Proformas **históricas** con descuento: se siguen viendo y el PDF lo sigue mostrando. **Al editarlas** el descuento se quita (aviso en pantalla) y el total se recalcula sin él.
- **BD (script `41`)**: el trigger `fn_proforma_items_validar` rechaza ítems nuevos con descuento, y un trigger nuevo en `proformas` rechaza descuento global al crear/editar. Las filas viejas no se tocan (convertir/revalidar siguen funcionando).

**Prueba:** Nueva proforma → no aparece ningún descuento. Abrir una proforma vieja con descuento → avisa, al guardar queda sin descuento.

---

## T2 — Precio unitario mínimo (Proforma y POS) ✅ CÓDIGO LISTO (2026-09-27) — ⚠️ falta correr `41` en dev + prod

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

## T3 — Rentabilidad en el dashboard ✅ CÓDIGO LISTO (2026-09-27) — ⚠️ falta correr `42` en dev + prod

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
