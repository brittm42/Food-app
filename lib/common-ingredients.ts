// A curated baseline of common home-cooking ingredient names, in the
// canonical form the AI should reuse whenever a recipe (drafted or
// imported) calls for the same thing. Complements — doesn't replace — the
// live "what's already in the library" list: that pool grows organically
// from whatever's been drafted/imported so far (including some genuinely
// messy entries, e.g. "Waffle mix", "Shredded cheese", "Chicken thighs or
// breast" — see [[recipe_import_via_url_shipped]] memory), so a fresh
// import has no guarantee a *correct* canonical name is available to match
// against. This list exists so one always is.
//
// Naming rules, matching what live-verification confirmed the AI should
// already be doing (see EXTRACTION_SYSTEM_PROMPT in app/actions/import-recipe.ts):
// - No brand names ("Bob's Red Mill flour" -> just "All-purpose flour").
// - No marketing/farming qualifiers ("organic", "grass-fed", "free-range").
// - No prep verbs the cook applies themselves ("diced onion" -> "Onion").
// - DO keep real product-type distinctions that change what's bought:
//   diced vs. crushed vs. whole tomatoes, kosher vs. table vs. sea salt,
//   shredded vs. block cheese, broth vs. stock, etc.

export const COMMON_INGREDIENT_NAMES: string[] = [
  // Produce — vegetables & aromatics
  "Onion", "Red onion", "Yellow onion", "White onion", "Green onions", "Shallot",
  "Garlic", "Ginger", "Carrots", "Celery",
  "Bell pepper", "Red bell pepper", "Green bell pepper", "Yellow bell pepper",
  "Jalapeño", "Poblano pepper", "Serrano pepper", "Anaheim pepper",
  "Tomatoes", "Cherry tomatoes", "Roma tomatoes", "Grape tomatoes",
  "Potatoes", "Russet potatoes", "Yukon gold potatoes", "Sweet potatoes",
  "Broccoli", "Cauliflower", "Zucchini", "Yellow squash", "Butternut squash",
  "Acorn squash", "Spaghetti squash",
  "Spinach", "Baby spinach", "Kale", "Swiss chard", "Collard greens",
  "Romaine lettuce", "Iceberg lettuce", "Mixed greens", "Arugula", "Butter lettuce",
  "Cabbage", "Red cabbage", "Napa cabbage", "Brussels sprouts",
  "Cucumber", "Avocado", "Mushrooms", "Cremini mushrooms", "Portobello mushrooms",
  "Corn", "Green beans", "Snap peas", "Snow peas", "Asparagus",
  "Eggplant", "Radishes", "Beets", "Turnips", "Parsnips",
  "Leeks", "Fennel", "Artichokes",

  // Produce — fruit
  "Lemon", "Lime", "Orange", "Grapefruit",
  "Apple", "Banana", "Pear", "Peach", "Nectarine", "Plum",
  "Strawberries", "Blueberries", "Raspberries", "Blackberries",
  "Grapes", "Pineapple", "Mango", "Papaya", "Kiwi", "Watermelon", "Cantaloupe",
  "Cherries", "Pomegranate", "Figs",

  // Produce — fresh herbs
  "Cilantro", "Parsley", "Basil", "Mint", "Dill", "Rosemary", "Thyme",
  "Sage", "Chives", "Tarragon", "Oregano (fresh)",

  // Dairy & eggs
  "Milk", "Whole milk", "2% milk", "Skim milk", "Buttermilk",
  "Heavy cream", "Half and half", "Sour cream",
  "Greek yogurt", "Plain yogurt", "Vanilla yogurt",
  "Butter", "Unsalted butter", "Salted butter",
  "Eggs", "Egg whites", "Egg yolks",
  "Cheddar cheese", "Shredded cheddar cheese",
  "Mozzarella cheese", "Shredded mozzarella cheese", "Fresh mozzarella",
  "Parmesan cheese", "Grated parmesan cheese",
  "Feta cheese", "Cream cheese", "Cottage cheese", "Ricotta cheese",
  "Cotija cheese", "Goat cheese", "Monterey Jack cheese", "Shredded Mexican cheese blend",
  "Swiss cheese", "Blue cheese", "Provolone cheese", "Brie",
  "Whipped cream",

  // Meat, poultry & seafood
  "Chicken breast", "Boneless skinless chicken breast", "Chicken thighs",
  "Boneless skinless chicken thighs", "Whole chicken", "Chicken drumsticks",
  "Chicken wings", "Ground chicken", "Rotisserie chicken",
  "Ground beef", "Ground turkey", "Ground pork", "Ground lamb",
  "Beef chuck roast", "Beef stew meat", "Steak", "Flank steak", "Sirloin steak",
  "Skirt steak", "Ribeye steak",
  "Pork chops", "Pork tenderloin", "Pork shoulder", "Pulled pork",
  "Bacon", "Pancetta", "Prosciutto",
  "Sausage", "Italian sausage", "Andouille sausage", "Chorizo", "Breakfast sausage",
  "Ham", "Deli turkey", "Deli ham",
  "Shrimp", "Salmon", "Salmon fillet", "Tilapia", "Cod", "Halibut",
  "Tuna", "Canned tuna", "Crab meat", "Scallops", "Mussels", "Clams",
  "Tofu", "Firm tofu", "Extra-firm tofu", "Silken tofu", "Tempeh",

  // Frozen
  "Frozen peas", "Frozen corn", "Frozen broccoli", "Frozen mixed vegetables",
  "Frozen spinach", "Frozen edamame", "Frozen green beans",
  "Frozen strawberries", "Frozen blueberries", "Frozen mango", "Frozen mixed berries",
  "Frozen shrimp", "Frozen chicken breast", "Frozen ground beef",
  "Frozen pizza dough", "Frozen puff pastry", "Frozen pie crust",
  "Ice cream", "Frozen waffles", "Frozen french fries",

  // Bakery
  "Bread", "White bread", "Whole wheat bread", "Sourdough bread", "Sandwich bread",
  "Tortillas", "Corn tortillas", "Flour tortillas", "Pita bread", "Naan",
  "Hamburger buns", "Hot dog buns", "Bagels", "English muffins", "Dinner rolls",
  "Baguette", "Pizza dough",

  // Canned & jarred goods
  "Diced tomatoes", "Fire-roasted diced tomatoes", "Crushed tomatoes",
  "Tomato sauce", "Tomato paste", "Whole peeled tomatoes", "Sun-dried tomatoes",
  "Black beans", "Kidney beans", "Pinto beans", "Cannellini beans",
  "Great northern beans", "Chickpeas", "Refried beans", "Black-eyed peas",
  "Corn (canned)", "Green beans (canned)",
  "Coconut milk", "Coconut cream",
  "Chicken broth", "Beef broth", "Vegetable broth", "Bone broth",
  "Chicken stock", "Beef stock", "Vegetable stock",
  "Cream of mushroom soup", "Cream of chicken soup", "Tomato soup",
  "Diced green chiles", "Roasted red peppers", "Artichoke hearts",
  "Olives", "Black olives", "Green olives", "Kalamata olives", "Capers",
  "Pickles", "Pickled jalapeños",

  // Grains, pasta & baking staples
  "All-purpose flour", "Whole wheat flour", "Bread flour", "Almond flour", "Cornmeal",
  "Cornstarch",
  "White rice", "Brown rice", "Jasmine rice", "Basmati rice", "Long grain rice",
  "Arborio rice", "Wild rice",
  "Quinoa", "Farro", "Barley", "Couscous",
  "Rolled oats", "Steel-cut oats", "Quick oats",
  "Pasta", "Spaghetti", "Penne", "Elbow macaroni", "Fettuccine", "Linguine",
  "Egg noodles", "Rice noodles", "Soba noodles", "Ramen noodles",
  "Lentils", "Red lentils", "Split peas",
  "Dried black beans", "Dried pinto beans", "Dried chickpeas",
  "Panko breadcrumbs", "Breadcrumbs",
  "Granulated sugar", "Brown sugar", "Powdered sugar", "Coconut sugar",
  "Baking powder", "Baking soda", "Active dry yeast",

  // Sauces, condiments & oils
  "Olive oil", "Extra virgin olive oil", "Vegetable oil", "Canola oil",
  "Coconut oil", "Sesame oil", "Avocado oil", "Peanut oil",
  "Soy sauce", "Tamari", "Worcestershire sauce",
  "Hot sauce", "Sriracha", "Gochujang",
  "Ketchup", "Mustard", "Dijon mustard", "Yellow mustard", "Whole grain mustard",
  "Mayonnaise", "Ranch dressing", "Italian dressing", "Caesar dressing",
  "Balsamic vinegar", "White vinegar", "Apple cider vinegar",
  "Rice vinegar", "Red wine vinegar", "White wine vinegar",
  "Honey", "Maple syrup", "Molasses", "Agave nectar",
  "Peanut butter", "Almond butter", "Tahini", "Jam", "Jelly",
  "BBQ sauce", "Salsa", "Pesto", "Marinara sauce", "Alfredo sauce",
  "Teriyaki sauce", "Fish sauce", "Oyster sauce", "Hoisin sauce",
  "Enchilada sauce", "Buffalo sauce",

  // Spices & seasonings
  "Salt", "Kosher salt", "Sea salt", "Table salt", "Flaky sea salt",
  "Black pepper", "White pepper",
  "Garlic powder", "Onion powder",
  "Paprika", "Smoked paprika",
  "Cumin", "Chili powder", "Cayenne pepper", "Red pepper flakes",
  "Italian seasoning", "Oregano (dried)", "Basil (dried)", "Thyme (dried)",
  "Rosemary (dried)", "Herbs de Provence",
  "Cinnamon", "Nutmeg", "Ginger (ground)", "Allspice", "Cloves",
  "Turmeric", "Curry powder", "Garam masala",
  "Bay leaves", "Vanilla extract", "Almond extract",
  "Ras el hanout", "Berbere spice", "Za'atar",
  "Cajun seasoning", "Taco seasoning", "Everything bagel seasoning",
  "Sesame seeds", "Poppy seeds", "Cornichons",

  // Dairy alternatives & cooking liquids
  "Almond milk", "Oat milk", "Soy milk", "Cashew milk",
  "White wine", "Red wine", "Cooking sherry", "Mirin", "Rice wine",
  "White miso", "Red miso",

  // Nuts & seeds
  "Almonds", "Sliced almonds", "Walnuts", "Pecans", "Cashews", "Peanuts",
  "Pistachios", "Pine nuts", "Sunflower seeds", "Pumpkin seeds",
  "Chia seeds", "Flaxseed", "Hemp seeds",
];
