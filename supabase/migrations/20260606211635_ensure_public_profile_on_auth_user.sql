-- Ensure every auth user has a matching PublicProfile row.

create or replace function public.ensure_public_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_email text;
	v_safe_email text;
	v_display_name text;
begin
	v_email := lower(nullif(trim(coalesce(new.email, '')), ''));
	v_safe_email := v_email;
	v_display_name := nullif(
		trim(
			coalesce(
				new.raw_user_meta_data ->> 'display_name',
				new.raw_user_meta_data ->> 'full_name',
				new.raw_user_meta_data ->> 'name',
				''
			)
		),
		''
	);

	if v_display_name is null and v_email is not null then
		v_display_name := nullif(split_part(v_email, '@', 1), '');
	end if;

	if v_safe_email is not null and exists (
		select 1
		from public."PublicProfile" existing_profile
		where lower(coalesce(existing_profile.user_email, '')) = v_safe_email
		  and existing_profile.auth_id <> new.id
	) then
		v_safe_email := null;
	end if;

	insert into public."PublicProfile" (
		id,
		auth_id,
		user_email,
		display_name,
		full_name,
		created_date,
		updated_date
	)
	values (
		new.id,
		new.id,
		v_safe_email,
		v_display_name,
		v_display_name,
		now(),
		now()
	)
	on conflict (id) do update
	set
		auth_id = excluded.auth_id,
		user_email = coalesce(nullif(public."PublicProfile".user_email, ''), excluded.user_email),
		display_name = coalesce(nullif(public."PublicProfile".display_name, ''), excluded.display_name),
		full_name = coalesce(nullif(public."PublicProfile".full_name, ''), excluded.full_name),
		updated_date = excluded.updated_date;

	return new;
end;
$$;

drop trigger if exists trg_auth_user_public_profile on auth.users;
create trigger trg_auth_user_public_profile
after insert on auth.users
for each row execute function public.ensure_public_profile_for_auth_user();

-- One-time targeted backfill for the affected account.
insert into public."PublicProfile" (
	id,
	auth_id,
	user_email,
	display_name,
	full_name,
	created_date,
	updated_date
)
values (
	'881d8429-4ca0-4245-a7af-02fafd77df63'::uuid,
	'881d8429-4ca0-4245-a7af-02fafd77df63'::uuid,
	'p.r@glas-reimer.de',
	'Pia',
	'Pia',
	now(),
	now()
)
on conflict (id) do update
set
	auth_id = excluded.auth_id,
	user_email = coalesce(nullif(public."PublicProfile".user_email, ''), excluded.user_email),
	display_name = coalesce(nullif(public."PublicProfile".display_name, ''), excluded.display_name),
	full_name = coalesce(nullif(public."PublicProfile".full_name, ''), excluded.full_name),
	updated_date = excluded.updated_date;
