# PRD: Britt's Food System (Web App)
**Version**: 1.0
**Date**: June 26, 2026
**Author**: Britt
**Status**: Ready for Claude Code
**Target stack**: Next.js (App Router) + Supabase (Postgres + Auth) + Tailwind, deployed on Vercel

---

## How to Use This Document

This is the full handoff for rebuilding my existing prototype as a real, persistent, multi-device web app. I have a working single-file HTML prototype (all the recipe content, the design system, and the interaction patterns are already proven there). This document captures everything Claude Code needs to rebuild it properly with a real database so my data persists across my phone and laptop.

**Read this whole doc before writing code.** The data model and the "why this stack" section matter most — get those right and the rest follows.

---

## Overview

### What Is This?
A personal food system web app: a browsable recipe library, a thumbs up/down rating system, a pantry tracker, a loose weekly meal queue, and an auto-generated shopping list. It's the cure for "I open the fridge and nothing feels safe and I don't know what to make."

### Problem It Solves
My eating falls apart for two reasons: **variety fatigue** (bored of the same meals) and **ingredient misalignment** (I have food, but never the right combination to make something). This app fixes both — it gives me a deep, filterable library so I'm never stuck for ideas, and a Core Pantry vs Weekly Fresh system so my kitchen is always stocked to actually make what's in the library.

### Emotional Core
Calm, not overwhelming. Opening this app should feel like relief, not another decision to make. The single most important feeling: "I've got this." Minimal friction, fast, never naggy. When I'm in a "nothing feels safe" spiral, this app should talk me down, not pile on.

### Who It's For
Just me (Britt). Single user. But put a light auth layer on it since it'll be live on the internet, and structure the data so a second user (Jason) could be added later without a rebuild.

---

## Platform & Tech Stack

| Dimension | Decision |
|-----------|----------|
| Platform | Responsive web app (mobile-first, works great on laptop too) |
| Framework | **Next.js (App Router)** |
| Styling | **Tailwind CSS** (design tokens below) |
| Backend | **Supabase** (no separate Express server needed) |
| Auth | **Supabase Auth** — email magic link, single user |
| Database | **Supabase Postgres** |
| AI | None for v1 (deferred — see backlog) |
| Deployment | **Vercel**, connected to GitHub repo, auto-deploy on push |

### Why This Stack (read this — it's a deliberate departure from my Polymarket build)

My Polymarket app uses React + Vite + Node/Express + SQLite because it has a server doing real work (browsing markets, running AI analysis). **This app does not need a server doing work** — it needs to store my data somewhere not tied to one device. Given that:

- **Next.js over Vite + Express**: One framework holds both the UI and the small amount of backend logic (data reads/writes). Far less wiring than standing up a separate Express server. Any server-side logic lives in Next.js route handlers or server actions.
- **Supabase over SQLite**: SQLite is a file on disk, which does not survive serverless deployment (the file resets between requests on Vercel). Supabase is hosted Postgres — it persists across every device automatically, has a generous free tier, gives a clean dashboard to inspect my data, and includes auth basically for free.
- **Vercel**: Free, connects straight to GitHub, gives a live URL I can open on my phone, auto-deploys when I push. Keeps my existing daily git workflow (pull -> claude -> add/commit/push) exactly the same.

**Do not** add a separate Express backend or SQLite. If something feels like it needs a server, use a Next.js route handler or a Supabase query.

### Key Technical Constraints
- Free-tier friendly — Supabase free tier and Vercel hobby tier should comfortably cover a single-user app. Don't introduce paid services.
- Must work well on mobile Safari (my phone) AND desktop Chrome (my laptop). Mobile-first.
- Keep patterns simple and readable over clever — I'm building my technical fluency and need to understand the code I ship.

### Architecture Notes for Future Features (build with these in mind, don't build them yet)
- **Multi-user**: Every data row should be scoped to a `user_id` from day one, even though there's only one user. This makes "add Jason" trivial later. Supabase Row Level Security (RLS) policies should enforce that a user only sees their own rows.
- **AI recipe suggestions**: A later version may call the Claude API to suggest meals based on what's in my pantry / what I've rated highly. Keep recipe data clean and structured so it can be fed to a model later.
- **Cross-device sync is the whole point of this rebuild** — it should "just work" because the data lives in Postgres, not local storage.

---

## MVP Feature Set

### Feature 1: Recipe Library
**Description**: A browsable library of recipes, organized by meal type and sub-category, with cuisine tags.
**Structure**:
- Top-level meal types: Breakfast, Lunch, Snacks, Dinner, Your Salmon
- Breakfast sub-categories: Overnight Oats, Smoothies, Hot Breakfasts, Quick Grabs, Guilty Pleasures
- Lunch sub-categories: Bowls, Wraps, Soups, Quick Plates
- Dinner sub-categories: Family Mains, Better Sides
- Cuisine tags: Mediterranean, Mexican, Asian, Indian (a recipe may have one or none)
**Behavior**: Tap a recipe card to expand and see the full recipe + macros (protein/fiber/cal where known). Cards show name, emoji icon, a short hint line, cuisine badge, and dietary tags (High protein, High fiber, No-cook, Batch cook, Britt only).
**Acceptance Criteria**: All seed recipes (provided below) load from the database and display in the correct categories. Expanding a card shows the recipe text.

### Feature 2: Thumbs Up / Down Rating
**Description**: Rate any recipe 👍 (favorite) or 👎 (not for me).
**Behavior**:
- 👍 marks a recipe as a favorite — it gets a star, floats to the top of its category, and appears when the "Favorites" filter is active.
- 👎 soft-hides it — dims the card and sorts it to the bottom. Still accessible, just deprioritized. Never fully deleted.
- Tapping the same rating again clears it (toggle).
- Ratings persist to the database and sync across devices.
**Acceptance Criteria**: Rating a recipe on my laptop shows the same rating when I open the app on my phone.

### Feature 3: Favorites Filter
**Description**: A toggle on each category to show only favorited (👍) recipes.
**Behavior**: Default view shows the full library (favorites sorted to top). Toggling "Favorites" narrows to only thumbs-upped recipes in that category. This is the "I want a sure thing, not variety" mode.
**Acceptance Criteria**: Filter correctly shows only favorites; toggling off restores the full list.

### Feature 4: This Week (Meal Queue)
**Description**: A loose, unstructured list of meals I'm planning to make this week. NOT a rigid Monday–Sunday grid — just a running queue.
**Behavior**:
- Every recipe card has an "add to this week" control (calendar icon in the prototype).
- The This Week view lists everything queued, grouped loosely by meal type, with a remove control on each.
- A "Clear this week" action empties the queue (with confirmation).
- Persists to the database and syncs across devices.
**Acceptance Criteria**: Adding a meal to This Week on one device shows it on the other.

### Feature 5: Smart Shopping List
**Description**: Auto-generated shopping list built from what's in This Week, cross-referenced against the Core Pantry.
**Behavior**:
- A "Generate Shopping List from This Week" action collects the ingredients for every queued meal.
- Ingredients are split into two groups: **Buy Fresh** (things I need to purchase) and **Check Core Pantry** (staples I should already have — just a reminder to verify, not buy).
- Each recipe has an associated ingredient list (provided in seed data) tagging which ingredients are Core staples vs Fresh.
- The list has tappable checkboxes that persist (so I can check things off mid-store and not lose progress if I refresh).
- A persistent "Weekly Fresh — Always Buy" section is always shown regardless of the queue.
**Acceptance Criteria**: Queuing 3 meals and generating produces a correct, de-duplicated list split into Fresh vs Core. Checkbox state persists across refresh and devices.

### Feature 6: Pantry System
**Description**: Two-tier pantry tracker — Core Pantry (always stocked) and Weekly Fresh (rotates).
**Behavior**:
- Core Pantry: a categorized checklist (Canned Goods, Grains & Dried, Sauces & Condiments, Spices, Freezer Always, Pantry Snacks & Extras) of staples I keep stocked. Checking an item = "I have this."
- Weekly Fresh: the rotating list of fresh items I buy each week.
- Checkbox state persists and syncs.
- The framing: "If Core Pantry is stocked, you can always make something." This is the Sunday-scan tool.
**Acceptance Criteria**: Checkbox state persists across refresh and devices. Categories render correctly.

### Feature 7: Add Your Own Recipe
**Description**: A form to add new recipes to the library from inside the app.
**Behavior**:
- Fields: name, category (dropdown of all sub-categories), cuisine (optional dropdown), emoji, hint line, recipe instructions (multi-line), protein (g), fiber (g), dietary tags (multi-select chips).
- On save, the recipe is written to the database and immediately appears in the right category alongside the seed recipes.
- Ideally also let me optionally add an ingredient list for shopping-list generation (can be a simple comma-separated input for v1).
**Acceptance Criteria**: A recipe I add on my phone appears on my laptop. It behaves identically to seed recipes (ratable, queueable).

### Feature 8: Overnight Oats "Pick 2"
**Description**: A special interactive module in the Overnight Oats section — pick 2 flavors for the week.
**Behavior**: Six oat flavors shown as a grid. Tapping picks a flavor (max 2; picking a 3rd bumps the oldest). Picked flavors reveal their recipe and persist. A counter guides me ("1 of 2 picked", "your 2 picks are ready").
**Acceptance Criteria**: Picks persist across sessions and devices.

---

## Post-MVP Feature Backlog

Document now so the architecture accounts for them. Do NOT build these in v1.

| Feature | Description | Why Deferred |
|---------|-------------|--------------|
| AI meal suggestions | Claude API suggests meals from my pantry + highly-rated recipes | Adds API cost + complexity; nail the core loop first |
| Multi-user (Jason) | Second login with his own data | Not needed yet; data is already user-scoped so it's a small lift later |
| Sunday Prep guide | A prep checklist generated from what's in This Week | Want to see how I use This Week first |
| Kid-friendly filter | Tag + filter for meals the kids will eat | Lower priority than core loop |
| Recipe photos | Image upload per recipe | Nice-to-have; emoji icons are fine for v1 |
| "What did I make" history/log | Track what I actually cooked over time | Explicitly didn't want a history log in v1 |
| Macro targets / daily totals | Sum protein/fiber across the day | Out of scope; this is a planning tool, not a tracker |

---

## Data Model

All tables scoped by `user_id` (uuid, FK to Supabase auth.users). RLS policies: a user can only read/write their own rows. Use `created_at` / `updated_at` timestamps on everything.

### `recipes`
The library. Seed recipes are inserted for the user on first run (or shared as global rows with `user_id` null + user-owned rows for custom additions — your call, but simplest is to seed per-user on signup).
- `id`: uuid (pk)
- `user_id`: uuid (fk) — owner; null allowed if you choose a global-seed approach
- `name`: text
- `category`: text — enum-like: smoothie, hot, quick, guilty, bowls, wraps, soups, lquick, snacks, family, sides, salmon, oats
- `cuisine`: text nullable — med, mex, asi, ind
- `emoji`: text
- `hint`: text — short description line
- `recipe`: text — full instructions (may contain light HTML/markdown for bold)
- `protein`: int nullable
- `fiber`: int nullable
- `cal`: int nullable
- `tags`: text[] — e.g. {High protein, High fiber, No-cook, Batch cook, Britt only}
- `ingredients`: jsonb nullable — array of { name: text, core: bool } for shopping-list generation
- `is_seed`: bool — distinguishes seed content from user-added (useful for re-seeding logic)

### `ratings`
- `id`: uuid (pk)
- `user_id`: uuid (fk)
- `recipe_id`: uuid (fk to recipes)
- `rating`: text — 'up' or 'down'
- unique constraint on (user_id, recipe_id)

### `week_queue`
The This Week list.
- `id`: uuid (pk)
- `user_id`: uuid (fk)
- `recipe_id`: uuid (fk to recipes)
- `added_at`: timestamp

### `pantry_state`
Tracks which pantry/fresh items are checked. The item catalog itself can be a static config in the codebase (it rarely changes); this table just stores checked state by item key.
- `id`: uuid (pk)
- `user_id`: uuid (fk)
- `item_key`: text — stable key for the pantry/fresh item (e.g. 'core:Black beans (4 cans)')
- `checked`: bool

### `shopping_state`
Persisted checkbox state for the generated shopping list.
- `id`: uuid (pk)
- `user_id`: uuid (fk)
- `item_key`: text
- `checked`: bool

### `oat_picks`
- `id`: uuid (pk)
- `user_id`: uuid (fk)
- `oat_id`: text — e.g. 'pbj', 'choco'
- `picked_at`: timestamp — used to evict the oldest when a 3rd is picked

### Storage Strategy
Everything lives in Supabase Postgres. No local storage for persistent data (that was the whole reason for the rebuild — local storage doesn't cross devices). Optionally use optimistic UI updates so taps feel instant, then reconcile with the DB.

---

## UX & Design Direction

### Core UX Principles
1. **Calm over comprehensive** — never overwhelm. When in doubt, show less.
2. **Mobile-first** — I use this most on my phone, often standing in the kitchen or at the store. Big tap targets, thumb-reachable controls.
3. **Fast and frictionless** — no multi-step flows for simple actions. One tap to rate, one tap to queue.
4. **Variety on demand, certainty on demand** — the full library when I'm bored, the Favorites filter when I just want a known win.
5. **Never naggy** — no streaks, no guilt, no "you haven't logged today." This is a helper, not a nag.

### Key Screens / Views
- **Recipes** (default) — the library with meal-type tabs, sub-category pills, and cuisine/favorites filters
- **This Week** — the meal queue
- **Shopping** — generated list + always-on Weekly Fresh section
- **Pantry** — Core + Weekly Fresh checklists
- **Add Recipe** — the form

### Aesthetic Direction
Preserve the prototype's design system exactly — it's already dialed in and I love it. Port these tokens to Tailwind config:

**Colors**
- Background: `#F5F2ED` (warm off-white)
- Surface: `#FFFFFF` / warm surface `#EDE9E2`
- Ink (text): `#1E1B17`, mid `#4A4540`, light `#8A837A`
- Border: `#DDD8D0`
- Teal (primary): `#1F7A6E`, light `#E3F2F0`, mid `#A8D5CF`
- Coral (accent): `#C94F30`, light `#FAEAE5`
- Gold (favorites/warm): `#B8842A`, light `#FBF3E3`
- Plum: `#6B3F7A`, light `#F0EAF5`
- Sage: `#4A7A5A`, light `#E8F2EB`
- Cuisine badges: Med green `#2E6B3E`/`#E8F4E8`, Mex orange `#B06020`/`#FEF0E0`, Asian blue `#2A4A8A`/`#E8EEF8`, Indian red `#8A2A2A`/`#FBE8E8`

**Typography**
- Display: **Fraunces** (light weight, occasional italic) — used for titles
- Body: **DM Sans**
- Mono/utility (labels, eyebrows): **DM Mono**

**Feel**: rounded cards (12–14px radius), soft warm palette, teal as the primary action color, gold reserved for favorites. Generous spacing. A small toast for confirmations ("Added to favorites", "Added to this week").

### Accessibility
- Visible focus states for keyboard nav
- Respect `prefers-reduced-motion`
- Tap targets at least 44px on mobile

---

## Flavor & Content Constraints (my personal preferences — bake into seed data, already applied)
- **No Greek yogurt, no cottage cheese** anywhere. (Hard no.)
- **Ginger** can be a background note, never the dominant flavor. Audit any recipe where ginger leads.
- **Coconut flavor is fine, coconut flakes are not** (texture). No recipes that rely on coconut flakes as a featured element.
- **No Asian-cuisine breakfasts.** Asian is great for lunch/dinner, never morning.
- **Jackson (my son) has an egg allergy** — any egg-forward recipe is tagged "Britt only" and must never be framed as a family meal.
- **Salmon is mine; the family doesn't eat it** — the salmon system is a "cook one fillet alongside the family's meal" pattern, not a separate dinner.
- Cuisine focus: Mediterranean, Mexican, Asian, occasional Indian/masala.
- Keep the honest, warm, slightly funny copy voice from the prototype (e.g. "Bacon isn't the problem. Bacon + nothing else is.").

---

## Success Criteria

### MVP Is Done When:
- [ ] I can open the app on my phone AND laptop and see the same data (ratings, queue, pantry, custom recipes all synced)
- [ ] All seed recipes load from Supabase and display in correct categories
- [ ] I can rate recipes 👍/👎 and favorites float to top + filter works
- [ ] I can add meals to This Week and they persist
- [ ] I can generate a shopping list from This Week, split into Fresh vs Core, with persistent checkboxes
- [ ] I can check off Core Pantry / Weekly Fresh items and state persists
- [ ] I can add my own recipe and it behaves like a seed recipe
- [ ] Overnight Oats "Pick 2" works and persists
- [ ] It's deployed live on Vercel at a URL I can bookmark on my phone
- [ ] It's behind a simple login so my data isn't public

### Most Important Thing to Get Right
**Cross-device persistence.** The entire reason for this rebuild is that the prototype's data was trapped on one device. If ratings, queue, and pantry state sync cleanly between my phone and laptop, this is a success. Everything else is polish.

### Explicitly Out of Scope (v1)
- AI features of any kind
- Multi-user / Jason's login (but keep data user-scoped)
- History/logging of what I cooked
- Macro tracking / daily totals
- Recipe photos
- Sunday Prep guide
- Kid-friendly filter

---

## Claude Code Handoff Notes

- **Start with the data layer and one vertical slice.** Get Supabase set up, the `recipes` table seeded, and the Recipes view reading from it — deployed and synced — before building the other tabs. Prove the persistence loop works end to end on two devices first. Then add ratings, then This Week, then Shopping, then Pantry, then Add Recipe. Don't build all the UI against local state and wire the DB last.
- **I'm building my technical fluency.** Favor clear, conventional patterns over clever ones. Leave short comments explaining non-obvious choices. When you make an architectural decision, tell me what and why in plain language so I learn.
- **The prototype is the source of truth for content and design.** I have a working single-file HTML version with all the recipe content, the exact color/type tokens, and the interaction patterns. I'll provide it. Port the content and design faithfully; don't redesign.
- **Seed data is provided separately** (see the companion `seed-recipes.json` file) so you can load it straight into Supabase rather than transcribing from the prototype.
- **Keep my git workflow intact**: I work daily with pull -> claude -> add/commit/push. Set up the repo and Vercel so a push auto-deploys.
- **Auth should be the lightest thing that works** — Supabase email magic link is fine. I don't need social login. Just enough that my data isn't sitting on a public URL.
- **Apply the 4D framework as we work**: prompt me on what I should own vs. hand to you (Delegation), push back if my requests get vague (Description), make me actually evaluate the output rather than rubber-stamp it (Discernment), and keep us honest about correctness, especially around the data model and auth (Diligence).

---

## First Claude Code Session — Suggested Opening Prompt

Paste something like this to start:

> I'm building a personal food-system web app. I have a complete PRD (this document) and a seed-recipes.json file. Stack: Next.js App Router + Supabase + Tailwind, deploying to Vercel. 
>
> Let's start by scaffolding the Next.js project, setting up Supabase (auth + the `recipes` table), seeding it from seed-recipes.json, and getting the Recipes view reading live from the database. I want to deploy this thin slice to Vercel and confirm it loads on my phone before we build anything else. Walk me through the Supabase setup steps I need to do in their dashboard, and explain decisions as you go — I'm building my fluency.

---

*End of PRD. Companion file: seed-recipes.json (all recipe + pantry content, ready to import).*
