-- Run this in the Supabase dashboard's SQL Editor.
-- The "Your Salmon" tab/category was renamed to "Just for Me" (id: solo) —
-- salmon was always meant to be the illustrative example of "stuff that's
-- just for me," not the definition of the tab. This updates the 5 existing
-- salmon recipes' category to match the renamed id; their names/content are
-- untouched, since they're genuinely salmon dishes.
update public.recipes set category = 'solo' where category = 'salmon';
