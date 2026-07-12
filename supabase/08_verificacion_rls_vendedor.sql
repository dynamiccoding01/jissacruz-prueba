-- ============================================================
-- SISREP — 08: Verificacion RLS — rol vendedor
-- Ejecutar despues de 06_verificacion.sql.
-- Requisito: existe al menos un usuario con rol 'vendedor' activo
-- (crear uno de prueba en Auth antes de correr esto, igual que el
-- admin que pide 06).
--
-- Complementa a 06: aquel prueba el flujo transaccional completo
-- como admin; este confirma que RLS BLOQUEA al vendedor donde debe
-- y lo PERMITE donde debe (PLAN.md Fase 1, punto de verificacion).
-- Termina con ROLLBACK intencional: no deja datos de prueba.
-- ============================================================

do $$
declare
  v_vendedor uuid;
  v_producto uuid;
  v_cliente  uuid;
  v_count    integer;
begin
  select id into v_vendedor from public.perfiles where rol = 'vendedor' and activo limit 1;
  if v_vendedor is null then
    raise exception 'No hay usuario vendedor. Crea el usuario y su perfil primero.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_vendedor, 'role', 'authenticated')::text, true);

  raise notice '1) Simulando sesion del vendedor %', v_vendedor;

  -- ---------- lectura permitida: productos ----------
  select count(*) into v_count from public.productos;
  raise notice '2) Lectura de productos permitida (% filas visibles)', v_count;

  -- ---------- lectura bloqueada: proveedores ----------
  select count(*) into v_count from public.proveedores;
  if v_count <> 0 then
    raise exception 'FALLO: vendedor ve % proveedores, deberia ver 0', v_count;
  end if;
  raise notice '3) Lectura de proveedores correctamente bloqueada (0 filas)';

  -- ---------- lectura bloqueada: ordenes_compra ----------
  select count(*) into v_count from public.ordenes_compra;
  if v_count <> 0 then
    raise exception 'FALLO: vendedor ve % ordenes de compra, deberia ver 0', v_count;
  end if;
  raise notice '4) Lectura de ordenes_compra correctamente bloqueada (0 filas)';

  -- ---------- escritura permitida: clientes ----------
  insert into public.clientes (nombre, ci_nit) values ('Cliente prueba vendedor', '999')
  returning id into v_cliente;
  raise notice '5) Insercion de cliente permitida OK';

  -- ---------- escritura bloqueada: proveedores ----------
  begin
    insert into public.proveedores (nombre) values ('Proveedor no autorizado');
    raise exception 'FALLO: el vendedor pudo insertar un proveedor';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
      raise notice '6) Insercion de proveedor correctamente bloqueada: %', sqlerrm;
  end;

  -- ---------- RPC bloqueada para vendedor: fn_ajuste_stock (solo admin) ----------
  select id into v_producto from public.productos limit 1;
  if v_producto is not null then
    begin
      perform public.fn_ajuste_stock(v_producto, 1, 'entrada', 'intento no autorizado');
      raise exception 'FALLO: el vendedor pudo ejecutar fn_ajuste_stock';
    exception
      when others then
        if sqlerrm like 'FALLO:%' then raise; end if;
        raise notice '7) fn_ajuste_stock correctamente bloqueada para vendedor: %', sqlerrm;
    end;
  else
    raise notice '7) (omitido: no hay productos para probar fn_ajuste_stock)';
  end if;

  -- ---------- RPC permitida para vendedor: fn_registrar_venta ----------
  -- Solo valida que la funcion ACEPTA al vendedor (pasa fn_es_usuario_activo);
  -- se usa una cantidad absurda a proposito para que falle por stock
  -- insuficiente y no deje una venta real. Un error de autorizacion aqui
  -- si seria una falla real de la prueba.
  if v_producto is not null then
    begin
      perform public.fn_registrar_venta(jsonb_build_object(
        'cliente_id', v_cliente,
        'items', jsonb_build_array(jsonb_build_object(
          'producto_id', v_producto, 'cantidad', 999999, 'precio_unitario', 1))
      ));
      raise notice '8) fn_registrar_venta acepto al vendedor (llego a completarse)';
    exception
      when others then
        if sqlerrm ilike '%no autorizado%' or sqlerrm ilike '%inactivo%' then
          raise exception 'FALLO: fn_registrar_venta rechazo al vendedor por autorizacion: %', sqlerrm;
        end if;
        raise notice '8) fn_registrar_venta acepto al vendedor (fallo despues por motivo de negocio: %)', sqlerrm;
    end;
  else
    raise notice '8) (omitido: no hay productos para probar fn_registrar_venta)';
  end if;

  raise exception 'VERIFICACION RLS VENDEDOR COMPLETA: todo OK. (Este error es intencional para deshacer los datos de prueba.)';
end;
$$;
