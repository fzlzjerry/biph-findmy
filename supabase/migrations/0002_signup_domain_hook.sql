-- Supabase Auth "before user created" hook: only school addresses can create an account.
-- The backend already rejects other domains; this also stops anyone who calls Supabase Auth
-- directly (bypassing our site) from creating users or burning the email quota.
-- Enabled in Auth config: hook_before_user_created_uri = pg-functions://postgres/public/hook_restrict_signup_domain

create or replace function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  email text := lower(coalesce(event->'user'->>'email', ''));
begin
  if split_part(email, '@', 2) = 'basischina.com' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Only @basischina.com school email addresses can sign up.'));
end;
$$;

grant execute on function public.hook_restrict_signup_domain(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_domain(jsonb) from authenticated, anon, public;
