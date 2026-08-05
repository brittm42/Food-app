-- Run this in the Supabase dashboard's SQL Editor. Adds a broader set of
-- well-known world cuisines to cuisine_colors beyond the original 14
-- (Mediterranean/Mexican/Asian/Indian/Italian/Thai/Chinese/Japanese/
-- Korean/Vietnamese/Middle Eastern/Greek/French/American). The AI can
-- already correctly introduce a genuinely new cuisine on its own (verified
-- live for Filipino/Peruvian/Ethiopian/Moroccan/Cajun) — this just means it
-- needs to less often, since a day-one match is more reliable than relying
-- on that judgment call every time. onConflict-safe to re-run.
insert into public.cuisine_colors (name, color) values
  ('Filipino', 'coral'),
  ('Peruvian', 'gold'),
  ('Moroccan', 'sage'),
  ('Ethiopian', 'coral'),
  ('Cajun', 'red'),
  ('Creole', 'plum'),
  ('Spanish', 'gold'),
  ('Caribbean', 'teal'),
  ('Cuban', 'coral'),
  ('Brazilian', 'sage'),
  ('German', 'plum'),
  ('British', 'teal'),
  ('Southern', 'red'),
  ('Hawaiian', 'gold'),
  ('Indonesian', 'coral'),
  ('Malaysian', 'sage'),
  ('Lebanese', 'gold'),
  ('Turkish', 'red'),
  ('Persian', 'plum'),
  ('Portuguese', 'teal'),
  ('Argentinian', 'coral'),
  ('Colombian', 'gold'),
  ('Jamaican', 'sage'),
  ('West African', 'red'),
  ('Nigerian', 'coral'),
  ('South African', 'plum'),
  ('Russian', 'teal'),
  ('Polish', 'sage'),
  ('Scandinavian', 'teal'),
  ('Tex-Mex', 'red')
on conflict (name) do nothing;
