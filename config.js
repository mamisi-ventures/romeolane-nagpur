/* Romeo Lane Nagpur — site settings.
   supabaseUrl and supabaseKey come from Supabase → Project Settings → API.
   The publishable key is safe to publish: the database's own rules decide what it can do. */
window.RL_CONFIG = {
  supabaseUrl: "https://lvcjdpcperdrqquokxyd.supabase.co",
  supabaseKey: "sb_publishable_ICx-HLvZrWniLFc2ZJEgiA_LsjKoWM3",
  /* Turn on after an SMS provider is set up in Supabase → Authentication → Providers → Phone. */
  memberSignIn: false
};
