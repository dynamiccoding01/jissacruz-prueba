-- ============================================================
-- SISREP — 06: Verificacion de punta a punta (PLAN.md Fase 1)
-- Requisito: haber creado ya el usuario ADMIN (ver guia).
--
-- Este script simula al admin, ejecuta el flujo completo
-- (producto -> compra -> ajuste -> venta -> proforma -> conversion),
-- verifica stock y costos FIFO, y al final hace ROLLBACK a proposito:
-- no deja datos de prueba. Leer los mensajes NOTICE en el resultado.
-- ============================================================

do $$
declare
  v_admin     uuid;
  v_producto  uuid;
  v_proveedor uuid;
  v_orden     uuid;
  v_cliente  uuid;
  v_proforma uuid;
  v_venta    uuid;
  v_stock    integer;
  v_costo    numeric;
  v_estado   text;
begin
  select id into v_admin from public.perfiles where rol = 'admin' and activo limit 1;
  if v_admin is null then
    raise exception 'No hay usuario admin. Crea el usuario y su perfil primero.';
  end if;

  -- simula la sesion del admin (auth.uid() devolvera este id)
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  raise notice '1) Simulando sesion del admin %', v_admin;

  -- ---------- catalogo ----------
  insert into public.productos (codigo, descripcion, precio, stock_minimo, creado_por)
  values ('TEST-001', 'Producto de prueba FIFO', 100, 2, v_admin)
  returning id into v_producto;
  raise notice '2) Producto creado (stock inicial 0)';

  -- ---------- compra: lote 1 = 10 unidades a Bs 50 ----------
  insert into public.proveedores (nombre, nit)
  values ('Proveedor prueba', '123456789')
  returning id into v_proveedor;

  insert into public.ordenes_compra (proveedor_id, creado_por)
  values (v_proveedor, v_admin)
  returning id into v_orden;

  insert into public.orden_compra_items (orden_compra_id, producto_id, cantidad, costo_unitario)
  values (v_orden, v_producto, 10, 50);

  perform public.fn_recibir_orden_compra(v_orden);

  select stock_actual into v_stock from public.productos where id = v_producto;
  if v_stock <> 10 then
    raise exception 'FALLO: stock esperado 10, obtenido %', v_stock;
  end if;
  raise notice '3) Orden recibida: stock = 10 (lote de 10 a Bs 50) OK';

  -- ---------- ajuste manual: lote 2 = 5 unidades a Bs 60 ----------
  perform public.fn_ajuste_stock(v_producto, 5, 'entrada', 'Prueba de ajuste', 60);

  select stock_actual into v_stock from public.productos where id = v_producto;
  if v_stock <> 15 then
    raise exception 'FALLO: stock esperado 15, obtenido %', v_stock;
  end if;
  raise notice '4) Ajuste de entrada: stock = 15 OK';

  -- ---------- venta directa de 12: consume 10@50 + 2@60 (FIFO) ----------
  insert into public.clientes (nombre, ci_nit) values ('Cliente prueba', '7777777')
  returning id into v_cliente;

  v_venta := public.fn_registrar_venta(jsonb_build_object(
    'cliente_id', v_cliente,
    'items', jsonb_build_array(jsonb_build_object(
      'producto_id', v_producto, 'cantidad', 12, 'precio_unitario', 100))
  ));

  select stock_actual into v_stock from public.productos where id = v_producto;
  if v_stock <> 3 then
    raise exception 'FALLO: stock esperado 3, obtenido %', v_stock;
  end if;

  select costo_fifo_unitario into v_costo
  from public.venta_items where venta_id = v_venta;
  -- (10*50 + 2*60) / 12 = 620/12 = 51.67
  if v_costo <> 51.67 then
    raise exception 'FALLO: costo FIFO esperado 51.67, obtenido %', v_costo;
  end if;
  raise notice '5) Venta de 12: stock = 3, costo FIFO = 51.67, numero % OK',
    (select numero from public.ventas where id = v_venta);

  -- ---------- proforma de 2 y conversion a venta ----------
  insert into public.proformas (cliente_id, creado_por)
  values (v_cliente, v_admin)
  returning id into v_proforma;

  insert into public.proforma_items
    (proforma_id, producto_id, cantidad, precio_unitario, subtotal_linea)
  values (v_proforma, v_producto, 2, 100, 200);

  v_venta := public.fn_convertir_proforma_a_venta(v_proforma);

  select estado into v_estado from public.proformas where id = v_proforma;
  select stock_actual into v_stock from public.productos where id = v_producto;
  if v_estado <> 'convertida' or v_stock <> 1 then
    raise exception 'FALLO: conversion (estado %, stock %)', v_estado, v_stock;
  end if;
  raise notice '6) Proforma % convertida en venta %: stock = 1 OK',
    (select numero from public.proformas where id = v_proforma),
    (select numero from public.ventas where id = v_venta);

  -- ---------- venta sin stock suficiente: debe rechazarse ----------
  begin
    perform public.fn_registrar_venta(jsonb_build_object(
      'items', jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto, 'cantidad', 10, 'precio_unitario', 100))
    ));
    raise exception 'FALLO: la venta sin stock NO fue rechazada';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
      raise notice '7) Venta sin stock rechazada correctamente: %', sqlerrm;
  end;

  raise exception 'VERIFICACION COMPLETA: todo OK. (Este error es intencional para deshacer los datos de prueba.)';
end;
$$;
