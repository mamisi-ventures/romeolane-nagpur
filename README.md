# Romeo Lane Nagpur — website

Owned and operated by Mamisi Ventures Private Limited.

This folder is the complete public website. It is plain HTML, CSS and JavaScript, so any static host can serve it. Bookings, guestlists, private-event enquiries and the Lane Club are stored in Supabase.

## What is in this folder

| File | Purpose |
|---|---|
| `index.html` | The website: Home, This week, Private events, Lane Club, Reserve, Menu, Gallery, Visit, Staff |
| `app.js` | How the site talks to the database |
| `config.js` | The Supabase address and key, and the member sign-in switch |
| `img/`, `*.png` | Photographs, logo, leaf ornament and icons |
| `supabase/001_schema.sql` | Database tables, security rules and functions (already applied) |
| `supabase/002_seed.sql` | The five party packages and sample events and offers (already applied) |

## 1. Put the site online (about 5 minutes)

The simplest route is Netlify, which has a free plan.

1. Go to **app.netlify.com/drop** and sign up with the Mamisi Ventures email.
2. Drag this whole folder onto the page. Netlify gives you a working address such as `romeo-lane-nagpur.netlify.app`.
3. In Netlify, open **Site configuration → Change site name** and choose `romeolanenagpur`.

Cloudflare Pages and Vercel work the same way if you prefer them.

To publish a change later, drag the updated folder onto **Deploys** in the same Netlify site.

## 2. Connect your domain

1. Buy the domain (for example `romeolanenagpur.com`) from GoDaddy, Hostinger, Namecheap or similar.
2. In Netlify, open **Domain management → Add a domain** and enter it.
3. Netlify shows the DNS records to add at your domain registrar. Add them; HTTPS is switched on automatically within about an hour.
4. If your domain is not `www.romeolanenagpur.com`, replace that address in `index.html` (it appears in the lines starting `<link rel="canonical"`, `og:image`, `og:url` and the `application/ld+json` block) so Google and WhatsApp previews point to the right place.
5. In Supabase, open **Authentication → URL Configuration** and set **Site URL** to your domain.

## 3. Add staff accounts

Staff sign in on the **Staff** tab (also linked as "Staff sign-in" in the footer).

1. In Supabase, open **Authentication → Users → Add user → Create new user**. Enter the staff member's email and a password, and tick **Auto confirm user**.
2. Open **SQL Editor** and run, with their email and name:

```sql
insert into public.staff (user_id, name, role)
select id, 'Rahul', 'manager' from auth.users where email = 'rahul@example.com';
```

Roles are `staff`, `manager` or `owner`; all three can use the console. To remove someone, delete their row from `public.staff`.

What the console does:

- **Tables, Private events, Tickets, Guestlist:** filter by Today, Upcoming, Past or All. Confirm, decline or mark guests as arrived. Message a guest on WhatsApp with their booking status. Export any list as a CSV for Excel.
- **Members:** at billing, enter the member's mobile number and the bill amount before tax to credit points. Gold earns 5% extra and Black 10% extra, automatically. Redeem points in blocks of 500 (₹500 off). Redeem vouchers by tapping them, or type the code the guest shows.
- **Events and Offers:** publish and remove them. They appear on the site immediately.

New bookings appear live while the console is open.

## 4. Member sign-in by SMS (optional)

Members can already enrol, earn points at billing and use vouchers through staff. Signing in to see their own card, vouchers and the daily draw needs SMS codes, which need an SMS provider:

1. Choose a provider supported by Supabase: Twilio, MessageBird, Vonage or Textlocal.
2. Indian SMS rules require a DLT registration for your sender ID and the OTP message template. The provider guides you through this; it usually takes a few days.
3. In Supabase, open **Authentication → Providers → Phone**, enable it and enter the provider's credentials.
4. In `config.js`, change `memberSignIn: false` to `memberSignIn: true` and publish the folder again.

## 5. How guest bookings work

- Every booking returns a reference such as `RL7K3P9Q`. Guests can check or cancel it under **Reserve → My bookings** with the reference and their mobile number. Bookings made on the same phone appear there automatically.
- A phone number on its own reveals nothing: the reference is always required.
- Prices for tickets and private events are worked out by the database, not the browser, so they cannot be altered by a guest.
- Each mobile number can make up to 8 requests an hour, which stops spam.
- If the booking system is ever unreachable, the site gives the guest a ready-made message to send you, plus your phone numbers.

## 6. Things to know

- **Supabase plan:** the free plan pauses a project after a week with no visitors, and keeps no backups. For a live business, upgrade the Mamisi Ventures organization to **Pro** (about US$25 a month) in Supabase → Organization → Billing.
- **Party package prices** live in the `packages` table. Change a rate in Supabase → Table Editor → packages, and the site and quotes update.
- **Sample events and offers** are marked sample in the console. Remove them once your own are published.
- The Lane Club benefits, birthday rewards and voucher terms on the site are proposals. Review them before launch.
