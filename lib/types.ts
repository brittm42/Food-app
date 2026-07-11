export type Ingredient = {
  name: string;
  core: boolean;
  quantity: string | null; // free text, e.g. "1", "1/2", "2-3", "handful", "to taste" — not numeric
  unit: string | null; // e.g. "cup", "tbsp", "clove", "can", "whole" — null if quantity has no unit
  quantity_value?: number | null; // canonical numeric amount, derived from `quantity`; null if not cleanly parseable ("to taste", ranges, etc.)
  quantity_unit?: string | null; // canonical unit from lib/units.ts's fixed vocabulary, derived from `unit`; null if unmatched. Ingredients missing either field (including all pre-existing rows) are simply excluded from pantry reconciliation.
  category?: string | null; // grocery-aisle category (lib/categories.ts's CATEGORIES) — drives Shopping List's "Buy Fresh" aisle grouping. Assigned by AI (generate-recipe.ts) or auto-categorized server-side on manual save; null only for not-yet-backfilled rows.
};

export type Recipe = {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  cuisines: string[];
  emoji: string | null;
  hint: string | null;
  recipe: string | null; // deprecated: legacy prose instructions, superseded by `steps`
  steps: string[];
  prep_time_minutes: number | null;
  source: string | null;
  servings: number | null;
  protein: number | null;
  fiber: number | null;
  cal: number | null;
  tags: string[];
  ingredients: Ingredient[] | null;
  is_seed: boolean;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type RatingValue = "up" | "down";

export type Rating = {
  id: string;
  user_id: string;
  recipe_id: string;
  rating: RatingValue;
  created_at: string;
  updated_at: string;
};

export type RecipeWithRating = Recipe & {
  rating: RatingValue | null;
  queued: boolean;
  editable: boolean;
};

export type WeekQueueItem = {
  id: string;
  user_id: string;
  recipe_id: string;
  added_at: string;
};

export type MealType = "breakfast" | "lunch" | "snacks" | "dinner" | "solo";

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snacks", label: "Snacks" },
  { id: "dinner", label: "Dinner" },
  { id: "solo", label: "Just for Me" },
];

// "oats" is not a recipe category in the `recipes` table — it's the
// hardcoded OAT_FLAVORS grid below (see PRD: Overnight Oats Pick-2).
export const SUB_CATEGORIES: Record<MealType, { id: string; label: string }[]> = {
  breakfast: [
    { id: "oats", label: "Overnight Oats" },
    { id: "smoothie", label: "Smoothies" },
    { id: "hot", label: "Hot Breakfasts" },
    { id: "quick", label: "Quick Grabs" },
    { id: "guilty", label: "Guilty Pleasures" },
  ],
  lunch: [
    { id: "bowls", label: "Bowls" },
    { id: "wraps", label: "Wraps" },
    { id: "soups", label: "Soups" },
    { id: "lquick", label: "Quick Plates" },
  ],
  snacks: [{ id: "snacks", label: "Snacks" }],
  dinner: [
    { id: "family", label: "Family Mains" },
    { id: "sides", label: "Better Sides" },
  ],
  solo: [{ id: "solo", label: "Just for Me" }],
};

export const CUISINE_LABELS: Record<string, string> = {
  med: "Mediterranean",
  mex: "Mexican",
  asi: "Asian",
  ind: "Indian",
  ita: "Italian",
  tha: "Thai",
  chn: "Chinese",
  jpn: "Japanese",
  kor: "Korean",
  viet: "Vietnamese",
  mideast: "Middle Eastern",
  gre: "Greek",
  fre: "French",
  amr: "American",
};

export type TagColor = { name: string; color: string };

export const TAG_COLOR_OPTIONS = ["teal", "coral", "gold", "plum", "sage", "red"] as const;

export const TAG_COLOR_CLASSES: Record<string, string> = {
  teal: "bg-teal-light text-teal",
  coral: "bg-coral-light text-coral",
  gold: "bg-gold-light text-gold",
  plum: "bg-plum-light text-plum",
  sage: "bg-sage-light text-sage",
  red: "bg-red-light text-red",
};

export function mealTypeForCategory(category: string): MealType {
  for (const meal of MEAL_TYPES) {
    if (SUB_CATEGORIES[meal.id].some((sub) => sub.id === category)) {
      return meal.id;
    }
  }
  return "snacks";
}

export const OAT_BASE =
  "1/2 cup rolled oats + 3/4 cup milk + 2 tbsp chia seeds + pinch salt. The flavor layer is what changes. Make 3-4 jars of each pick.";

export type OatFlavor = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  vibe: string;
  recipe: string;
};

export const OAT_FLAVORS: OatFlavor[] = [
  {
    id: "pbj",
    emoji: "🍇",
    name: "PB&J",
    desc: "Peanut butter, strawberry jam, banana slices",
    vibe: "Sweet & nostalgic",
    recipe:
      "<strong>Add to base:</strong> 1 tbsp peanut butter, 1 tbsp strawberry jam, stir well. Top in the morning with sliced banana and a drizzle of extra PB. The jam melts in overnight — tastes like dessert.",
  },
  {
    id: "choco",
    emoji: "🍫",
    name: "Dark Chocolate Raspberry",
    desc: "Cocoa powder, frozen raspberries, honey",
    vibe: "Rich & dessert-y",
    recipe:
      "<strong>Add to base:</strong> 1 tbsp cocoa powder, 1 tsp honey, handful of frozen raspberries (they thaw overnight). Top with a few dark chocolate chips. Feels indulgent, isn't.",
  },
  {
    id: "peach",
    emoji: "🍑",
    name: "Peach Cobbler",
    desc: "Canned peaches, brown sugar, cinnamon, vanilla",
    vibe: "Warm & cozy",
    recipe:
      "<strong>Add to base:</strong> ¼ tsp cinnamon, ¼ tsp vanilla extract, 1 tsp brown sugar. Stir in a few spoonfuls of canned diced peaches (in juice, not syrup). Top with granola in the morning for the \"cobbler crunch.\"",
  },
  {
    id: "tropical",
    emoji: "🥭",
    name: "Tropical",
    desc: "Coconut milk, mango, lime zest",
    vibe: "Bright & fresh",
    recipe:
      "<strong>Swap base milk for:</strong> ½ coconut milk + ¼ regular milk. Add frozen mango chunks, squeeze of lime. Tastes nothing like \"health food.\"",
  },
  {
    id: "apple",
    emoji: "🍎",
    name: "Apple Pie",
    desc: "Grated apple, cinnamon, maple syrup, walnuts",
    vibe: "Warm & sweet",
    recipe:
      "<strong>Add to base:</strong> ½ grated apple (softens overnight), ½ tsp cinnamon, 1 tsp maple syrup. Top with crushed walnuts. Add a pinch of nutmeg if you have it.",
  },
  {
    id: "matcha",
    emoji: "🍵",
    name: "Matcha Honey",
    desc: "Matcha powder, honey, vanilla, white chocolate chips",
    vibe: "Earthy & interesting",
    recipe:
      "<strong>Add to base:</strong> 1 tsp matcha powder, 1 tsp honey, ¼ tsp vanilla. Whisk the matcha into a little warm milk first so it dissolves, then stir into the jar. Top with a few white chocolate chips.",
  },
];
