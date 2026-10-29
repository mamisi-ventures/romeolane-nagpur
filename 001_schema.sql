-- Romeo Lane Nagpur — database schema
-- Operated by Mamisi Ventures Private Limited
-- Public visitors never read tables directly: they call the functions below.
-- Staff (rows in public.staff) read and manage everything through RLS.

-- ---------- helpers ----------
create or replace function public.ist_today() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  role text not null default 'staff' check (role in ('staff','manager','owner')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create policy "staff read staff" on public.staff for select to authenticated using (public.is_staff());

-- ---------- content: events, offers, packages ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'Event',
  date date not null,
  time text not null default 'Doors 8 PM',
  price integer not null default 0 check (price >= 0),
  guestlist boolean not null default false,
  cutoff text not null default '10:30 PM',
  blurb text not null default '',
  sample boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "anyone reads events" on public.events for select to anon, authenticated using (true);
create policy "staff manage events" on public.events for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text not null default '',
  when_text text not null default '',
  members_only boolean not null default false,
  sort integer not null default 0,
  sample boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create policy "anyone reads offers" on public.offers for select to anon, authenticated using (true);
create policy "staff manage offers" on public.offers for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.packages (
  id text primary key,
  name text not null,
  rate integer not null check (rate > 0),
  bar jsonb not null default '[]',
  royal_dishes boolean not null default false,
  sort integer not null default 0
);
alter table public.packages enable row level security;
create policy "anyone reads packages" on public.packages for select to anon, authenticated using (true);
create policy "staff manage packages" on public.packages for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- bookings (tables, tickets, guestlists, private events) ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  type text not null check (type in ('table','ticket','guestlist','private')),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  date date not null,
  time text not null default '',
  guests integer not null check (guests between 1 and 500),
  event_id uuid references public.events(id) on delete set null,
  details jsonb not null default '{}',
  status text not null default 'Requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index bookings_date_idx on public.bookings (date);
create index bookings_phone_idx on public.bookings (phone);
alter table public.bookings enable row level security;
create policy "staff read bookings" on public.bookings for select to authenticated using (public.is_staff());
create policy "staff update bookings" on public.bookings for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete bookings" on public.bookings for delete to authenticated using (public.is_staff());

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create or replace function public.new_code(prefix text) returns text
language sql volatile set search_path = public as $$
  select prefix || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6)
$$;

-- Public: create a booking of any type. Validates input and prices on the server.
create or replace function public.create_booking(
  p_type text, p_name text, p_phone text, p_date date, p_time text,
  p_guests integer, p_event uuid default null, p_details jsonb default '{}'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_ref text; v_ev public.events; v_pkg public.packages; v_details jsonb := coalesce(p_details,'{}');
  v_status text := 'Requested'; v_date date := p_date; v_recent integer;
begin
  if p_type not in ('table','ticket','guestlist','private') then raise exception 'Unknown booking type'; end if;
  if coalesce(trim(p_name),'') = '' or char_length(p_name) > 80 then raise exception 'Please add your name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a 10-digit Indian mobile number'; end if;
  select count(*) into v_recent from public.bookings where phone = p_phone and created_at > now() - interval '1 hour';
  if v_recent >= 8 then raise exception 'Too many requests from this number. Please call +91 89565 80661'; end if;

  if p_type in ('ticket','guestlist') then
    select * into v_ev from public.events where id = p_event;
    if not found then raise exception 'This event is no longer listed'; end if;
    v_date := v_ev.date;
    if p_type = 'ticket' then
      if v_ev.price <= 0 then raise exception 'This event has no tickets'; end if;
      if p_guests < 1 or p_guests > 20 then raise exception 'Choose between 1 and 20 tickets'; end if;
      v_details := v_details || jsonb_build_object('event_title', v_ev.title, 'amount', v_ev.price * p_guests, 'rate', v_ev.price);
      v_status := 'Confirmed';
    else
      if not v_ev.guestlist then raise exception 'The guestlist for this event is closed'; end if;
      if p_guests < 1 or p_guests > 12 then raise exception 'Guestlist parties are up to 12'; end if;
      v_details := v_details || jsonb_build_object('event_title', v_ev.title);
      v_status := 'Pending';
    end if;
  elsif p_type = 'table' then
    if p_guests < 1 or p_guests > 30 then raise exception 'For more than 30 guests, see Private events'; end if;
  elsif p_type = 'private' then
    if p_guests < 15 then raise exception 'Packages start at a minimum guarantee of 15 guests'; end if;
    select * into v_pkg from public.packages where id = v_details->>'package';
    if not found then raise exception 'Choose a package'; end if;
    v_details := v_details || jsonb_build_object('package_name', v_pkg.name, 'rate', v_pkg.rate, 'estimate', v_pkg.rate * greatest(p_guests,15));
  end if;

  if v_date < public.ist_today() then raise exception 'Choose today or a later date'; end if;

  loop
    v_ref := public.new_code('RL');
    exit when not exists (select 1 from public.bookings where ref = v_ref);
  end loop;

  insert into public.bookings (ref, type, name, phone, date, time, guests, event_id, details, status)
  values (v_ref, p_type, trim(p_name), p_phone, v_date, coalesce(p_time, coalesce(v_ev.time,'')), p_guests, p_event, v_details, v_status);

  return json_build_object('ref', v_ref, 'status', v_status, 'date', v_date, 'details', v_details);
end $$;

-- Public: look up bookings by reference + phone. Both are required, so a phone number alone reveals nothing.
create or replace function public.lookup_bookings(p_phone text, p_refs text[])
returns table (ref text, kind text, on_date date, at_time text, guests integer, status text, title text, amount integer)
language sql stable security definer set search_path = public as $$
  select b.ref, b.type, b.date, b.time, b.guests, b.status,
         coalesce(b.details->>'event_title', b.details->>'package_name', ''),
         nullif(coalesce(b.details->>'amount', b.details->>'estimate'),'')::integer
  from public.bookings b
  where b.phone = p_phone
    and b.date >= public.ist_today()
    and b.ref = any(p_refs)
  order by b.date, b.time
  limit 20
$$;

-- Public: cancel an open booking with its reference and phone.
create or replace function public.cancel_booking(p_ref text, p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where ref = upper(trim(p_ref)) and phone = p_phone;
  if not found then raise exception 'No booking matches that reference and number'; end if;
  if b.date < public.ist_today() then raise exception 'Past bookings cannot be cancelled'; end if;
  if b.type = 'private' and b.status <> 'Requested' then raise exception 'Please call +91 89565 80661 to change a confirmed event'; end if;
  if b.status not in ('Requested','Pending','Confirmed','Approved') then raise exception 'This booking is already %', lower(b.status); end if;
  update public.bookings set status = 'Cancelled', cancelled_at = now() where id = b.id;
  return 'Cancelled';
end $$;

-- ---------- Lane Club ----------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  birthday date,
  anniversary date,
  consent boolean not null default false,
  user_id uuid unique references auth.users(id) on delete set null,
  last_spin date,
  bday_year integer,
  anniv_year integer,
  joined_at timestamptz not null default now()
);
alter table public.members enable row level security;
create policy "staff read members" on public.members for select to authenticated using (public.is_staff());
create policy "staff update members" on public.members for update to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  delta integer not null,
  bill_amount numeric(12,2),
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index points_member_idx on public.points_ledger (member_id);
alter table public.points_ledger enable row level security;
create policy "staff read ledger" on public.points_ledger for select to authenticated using (public.is_staff());

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  code text not null unique,
  title text not null,
  source text not null default '',
  issued_at timestamptz not null default now(),
  expires_on date,
  used_at timestamptz,
  used_by uuid references auth.users(id)
);
create index vouchers_member_idx on public.vouchers (member_id);
alter table public.vouchers enable row level security;
create policy "staff read vouchers" on public.vouchers for select to authenticated using (public.is_staff());

-- Tier rules: Silver from 0, Gold from 1,000 (+5%), Black from 3,000 (+10%) lifetime points.
create or replace function public.tier_of(lifetime integer) returns text
language sql immutable as $$
  select case when lifetime >= 3000 then 'Black' when lifetime >= 1000 then 'Gold' else 'Silver' end
$$;
create or replace function public.tier_mult(lifetime integer) returns numeric
language sql immutable as $$
  select case when lifetime >= 3000 then 1.10 when lifetime >= 1000 then 1.05 else 1.00 end
$$;

create or replace view public.member_summary with (security_invoker = true) as
select m.*,
  coalesce(sum(l.delta),0)::integer as balance,
  coalesce(sum(l.delta) filter (where l.delta > 0),0)::integer as lifetime,
  count(l.id) filter (where l.bill_amount is not null)::integer as visits,
  public.tier_of(coalesce(sum(l.delta) filter (where l.delta > 0),0)::integer) as tier
from public.members m left join public.points_ledger l on l.member_id = m.id
group by m.id;

create or replace function public.issue_voucher(p_member uuid, p_title text, p_source text, p_expires date) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  loop v_code := public.new_code('RL-'); exit when not exists (select 1 from public.vouchers where code = v_code); end loop;
  insert into public.vouchers (member_id, code, title, source, expires_on) values (p_member, v_code, p_title, p_source, p_expires);
  return v_code;
end $$;
revoke execute on function public.issue_voucher(uuid,text,text,date) from public, anon, authenticated;

-- Public: enrol with a mobile number.
create or replace function public.enrol_member(p_name text, p_phone text, p_birthday date default null, p_anniversary date default null, p_consent boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_name),'') = '' then raise exception 'Please add your name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a 10-digit Indian mobile number'; end if;
  if exists (select 1 from public.members where phone = p_phone) then return 'exists'; end if;
  insert into public.members (name, phone, birthday, anniversary, consent) values (trim(p_name), p_phone, p_birthday, p_anniversary, coalesce(p_consent,false)) returning id into v_id;
  perform public.issue_voucher(v_id, 'A welcome dessert', 'Welcome', public.ist_today() + 30);
  return 'created';
end $$;

-- Signed-in member (phone OTP): link account, issue monthly rewards, return the dashboard.
create or replace function public.my_member() returns json
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := right(regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g'),10);
  m public.members; s record; v_year integer := extract(year from public.ist_today()); v_month integer := extract(month from public.ist_today());
  v_month_end date := (date_trunc('month', public.ist_today()) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is null or v_phone = '' then return null; end if;
  select * into m from public.members where phone = v_phone;
  if not found then return json_build_object('enrolled', false, 'phone', v_phone); end if;
  if m.user_id is null then update public.members set user_id = auth.uid() where id = m.id; end if;
  select * into s from public.member_summary where id = m.id;

  if m.birthday is not null and extract(month from m.birthday) = v_month and coalesce(m.bday_year,0) <> v_year then
    perform public.issue_voucher(m.id, case s.tier when 'Black' then 'A birthday dessert, a cocktail and a celebration platter' when 'Gold' then 'A birthday dessert and a cocktail' else 'A birthday dessert' end, 'Birthday month', v_month_end);
    update public.members set bday_year = v_year where id = m.id;
  end if;
  if s.tier <> 'Silver' and m.anniversary is not null and extract(month from m.anniversary) = v_month and coalesce(m.anniv_year,0) <> v_year then
    perform public.issue_voucher(m.id, case s.tier when 'Black' then 'Anniversary dessert for two and two house cocktails' else 'Anniversary dessert for two' end, 'Anniversary month', v_month_end);
    update public.members set anniv_year = v_year where id = m.id;
  end if;

  return json_build_object(
    'enrolled', true,
    'name', m.name, 'phone', m.phone, 'tier', s.tier, 'balance', s.balance, 'lifetime', s.lifetime, 'visits', s.visits,
    'drawn_today', m.last_spin = public.ist_today(),
    'vouchers', coalesce((select json_agg(json_build_object('code',v.code,'title',v.title,'source',v.source,'expires_on',v.expires_on,'used',v.used_at is not null) order by v.issued_at desc) from public.vouchers v where v.member_id = m.id), '[]'::json),
    'history', coalesce((select json_agg(x) from (select l.delta, l.note, l.created_at from public.points_ledger l where l.member_id = m.id order by l.created_at desc limit 12) x), '[]'::json)
  );
end $$;

-- Signed-in member: the evening's draw, once per day, decided on the server.
create or replace function public.spin_draw() returns json
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := right(regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g'),10);
  m public.members; prizes text[] := array['A mocktail','10% off','50 points','A dessert','Next time','Bar snack','Priority entry','Double points'];
  idx integer; v_code text;
begin
  select * into m from public.members where phone = v_phone and auth.uid() is not null;
  if not found then raise exception 'Sign in as a Lane Club member'; end if;
  if m.last_spin = public.ist_today() then raise exception 'Today''s draw is done'; end if;
  idx := floor(random() * array_length(prizes,1))::integer;
  update public.members set last_spin = public.ist_today() where id = m.id;
  if prizes[idx+1] <> 'Next time' then
    v_code := public.issue_voucher(m.id, prizes[idx+1], 'Evening''s draw', public.ist_today() + 30);
  end if;
  return json_build_object('index', idx, 'prize', prizes[idx+1], 'code', v_code);
end $$;

-- ---------- staff actions ----------
create or replace function public.am_i_staff() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('staff', exists(select 1 from public.staff where user_id = auth.uid()),
    'name', (select name from public.staff where user_id = auth.uid()),
    'role', (select role from public.staff where user_id = auth.uid()))
$$;

create or replace function public.staff_credit(p_phone text, p_bill numeric, p_redeem integer default 0) returns json
language plpgsql security definer set search_path = public as $$
declare m public.members; s record; v_earn integer := 0;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into m from public.members where phone = p_phone;
  if not found then raise exception 'No member is enrolled with this number'; end if;
  select * into s from public.member_summary where id = m.id;
  if coalesce(p_redeem,0) < 0 or coalesce(p_redeem,0) % 500 <> 0 then raise exception 'Points are redeemed in blocks of 500'; end if;
  if coalesce(p_redeem,0) > s.balance then raise exception 'The member holds % points', s.balance; end if;
  if coalesce(p_bill,0) > 0 then
    v_earn := floor(p_bill / 10 * public.tier_mult(s.lifetime));
    insert into public.points_ledger (member_id, delta, bill_amount, note, created_by) values (m.id, v_earn, p_bill, 'Bill ₹' || to_char(p_bill,'FM99,99,99,990'), auth.uid());
  end if;
  if coalesce(p_redeem,0) > 0 then
    insert into public.points_ledger (member_id, delta, note, created_by) values (m.id, -p_redeem, 'Redeemed ₹' || p_redeem || ' off', auth.uid());
  end if;
  select * into s from public.member_summary where id = m.id;
  return json_build_object('earned', v_earn, 'redeemed', coalesce(p_redeem,0), 'balance', s.balance, 'tier', s.tier);
end $$;

create or replace function public.staff_redeem_voucher(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v public.vouchers;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into v from public.vouchers where code = upper(trim(p_code));
  if not found then raise exception 'No voucher with this code'; end if;
  if v.used_at is not null then raise exception 'Already redeemed on %', to_char(v.used_at at time zone 'Asia/Kolkata','DD Mon'); end if;
  if v.expires_on is not null and v.expires_on < public.ist_today() then raise exception 'This voucher expired on %', to_char(v.expires_on,'DD Mon'); end if;
  update public.vouchers set used_at = now(), used_by = auth.uid() where id = v.id;
  return v.title;
end $$;

-- ---------- grants ----------
revoke all on all tables in schema public from anon;
grant select on public.events, public.offers, public.packages to anon;
-- Signed-in users: row level security above decides what each one can actually see or change.
grant select, insert, update, delete on public.events, public.offers, public.packages, public.bookings, public.members, public.vouchers to authenticated;
grant select on public.staff, public.points_ledger, public.member_summary to authenticated;
revoke all on public.member_summary from anon;
grant execute on function public.create_booking(text,text,text,date,text,integer,uuid,jsonb) to anon, authenticated;
grant execute on function public.lookup_bookings(text,text[]) to anon, authenticated;
grant execute on function public.cancel_booking(text,text) to anon, authenticated;
grant execute on function public.enrol_member(text,text,date,date,boolean) to anon, authenticated;
grant execute on function public.my_member() to authenticated;
grant execute on function public.spin_draw() to authenticated;
grant execute on function public.am_i_staff() to authenticated;
grant execute on function public.staff_credit(text,numeric,integer) to authenticated;
grant execute on function public.staff_redeem_voucher(text) to authenticated;

-- live updates for the staff console
alter publication supabase_realtime add table public.bookings, public.members, public.points_ledger;
