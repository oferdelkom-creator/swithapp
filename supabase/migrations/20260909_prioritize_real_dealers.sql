-- Keep test/demo inventory out of the public marketplace and place verified
-- business inventory before private listings. Applies to both historical RPC
-- overloads so older clients receive the same safe result.
do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cars_for_sale'
  loop
    definition := pg_get_functiondef(fn.oid);

    if position('and c.is_seed = false' in definition) = 0 then
      definition := replace(
        definition,
        'where c.for_sale = true',
        'where c.for_sale = true
    and c.is_seed = false
    and u.is_seed = false'
      );
    end if;

    if position('(u.role in (''dealer'', ''importer'')) desc' in definition) = 0 then
      definition := replace(
        definition,
        'order by
    (c.boosted_until > now())',
        'order by
    (u.role in (''dealer'', ''importer'')) desc,
    (c.boosted_until > now())'
      );
    end if;

    execute definition;
  end loop;
end
$$;
