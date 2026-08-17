import type { Category } from "@/lib/categories";

// Curated, universal common-staples list — one list for every household, no
// per-diet/allergy tailoring. Seeded silently at onboarding time (see
// lib/kitchen-prepopulate.ts) and available as a one-time retroactive
// backfill for existing households (applyCommonPantryStaples in
// app/actions/pantry.ts). Researched against general pantry/household-
// essentials checklists, not just one household's own list, since the
// whole point is covering staples a household hasn't thought to add yet.
export const STARTER_STAPLES: { name: string; category: Category }[] = [
  // Produce
  { name: "Bananas", category: "Produce" },
  { name: "Apples", category: "Produce" },
  { name: "Avocados", category: "Produce" },
  { name: "Baby spinach", category: "Produce" },
  { name: "Garlic", category: "Produce" },
  { name: "Onions", category: "Produce" },
  { name: "Lemons", category: "Produce" },
  { name: "Bell peppers", category: "Produce" },
  { name: "Carrots", category: "Produce" },
  { name: "Tomatoes", category: "Produce" },
  { name: "Cucumber", category: "Produce" },
  { name: "Broccoli", category: "Produce" },
  { name: "Potatoes", category: "Produce" },

  // Dairy & Eggs
  { name: "Milk", category: "Dairy & Eggs" },
  { name: "Eggs", category: "Dairy & Eggs" },
  { name: "Butter", category: "Dairy & Eggs" },
  { name: "Shredded cheese", category: "Dairy & Eggs" },
  { name: "Greek yogurt", category: "Dairy & Eggs" },
  { name: "Sour cream", category: "Dairy & Eggs" },

  // Meat & Seafood
  { name: "Chicken breast", category: "Meat & Seafood" },
  { name: "Ground beef", category: "Meat & Seafood" },

  // Deli
  { name: "Deli meat", category: "Deli" },
  { name: "Hummus", category: "Deli" },

  // Bakery
  { name: "Sandwich bread", category: "Bakery" },
  { name: "Tortillas", category: "Bakery" },

  // Frozen
  { name: "Frozen mixed vegetables", category: "Frozen" },
  { name: "Frozen berries", category: "Frozen" },
  { name: "Ice cream", category: "Frozen" },

  // Canned Goods
  { name: "Black beans", category: "Canned Goods" },
  { name: "Chickpeas", category: "Canned Goods" },
  { name: "Diced tomatoes", category: "Canned Goods" },
  { name: "Tomato sauce", category: "Canned Goods" },
  { name: "Tomato paste", category: "Canned Goods" },
  { name: "Chicken broth", category: "Canned Goods" },
  { name: "Vegetable broth", category: "Canned Goods" },
  { name: "Corn", category: "Canned Goods" },
  { name: "Tuna", category: "Canned Goods" },

  // Grains & Dried
  { name: "Rice", category: "Grains & Dried" },
  { name: "Pasta", category: "Grains & Dried" },
  { name: "Rolled oats", category: "Grains & Dried" },
  { name: "Dried lentils", category: "Grains & Dried" },
  { name: "Quinoa", category: "Grains & Dried" },

  // Baking
  { name: "All-purpose flour", category: "Baking" },
  { name: "White sugar", category: "Baking" },
  { name: "Brown sugar", category: "Baking" },
  { name: "Baking soda", category: "Baking" },
  { name: "Baking powder", category: "Baking" },
  { name: "Cornstarch", category: "Baking" },
  { name: "Vanilla extract", category: "Baking" },

  // Sauces & Condiments
  { name: "Olive oil", category: "Sauces & Condiments" },
  { name: "Vegetable oil", category: "Sauces & Condiments" },
  { name: "Soy sauce", category: "Sauces & Condiments" },
  { name: "Ketchup", category: "Sauces & Condiments" },
  { name: "Mustard", category: "Sauces & Condiments" },
  { name: "Mayonnaise", category: "Sauces & Condiments" },
  { name: "Hot sauce", category: "Sauces & Condiments" },
  { name: "White vinegar", category: "Sauces & Condiments" },
  { name: "Apple cider vinegar", category: "Sauces & Condiments" },
  { name: "Salad dressing", category: "Sauces & Condiments" },
  { name: "Peanut butter", category: "Sauces & Condiments" },
  { name: "Jam or jelly", category: "Sauces & Condiments" },
  { name: "Worcestershire sauce", category: "Sauces & Condiments" },
  { name: "BBQ sauce", category: "Sauces & Condiments" },

  // Spices
  { name: "Salt", category: "Spices" },
  { name: "Black pepper", category: "Spices" },
  { name: "Garlic powder", category: "Spices" },
  { name: "Onion powder", category: "Spices" },
  { name: "Chili powder", category: "Spices" },
  { name: "Cinnamon", category: "Spices" },
  { name: "Paprika", category: "Spices" },
  { name: "Italian seasoning", category: "Spices" },
  { name: "Cumin", category: "Spices" },

  // Beverages
  { name: "Coffee", category: "Beverages" },
  { name: "Tea", category: "Beverages" },

  // Snacks
  { name: "Crackers", category: "Snacks" },
  { name: "Mixed nuts", category: "Snacks" },

  // Cleaning Supplies
  { name: "All-purpose cleaner", category: "Cleaning Supplies" },
  { name: "Dish soap", category: "Cleaning Supplies" },
  { name: "Dishwasher detergent", category: "Cleaning Supplies" },
  { name: "Disinfecting wipes", category: "Cleaning Supplies" },
  { name: "Sponges", category: "Cleaning Supplies" },
  { name: "Trash bags", category: "Cleaning Supplies" },
  { name: "Glass cleaner", category: "Cleaning Supplies" },
  { name: "Bathroom cleaner", category: "Cleaning Supplies" },

  // Paper Goods
  { name: "Paper towels", category: "Paper Goods" },
  { name: "Toilet paper", category: "Paper Goods" },
  { name: "Napkins", category: "Paper Goods" },
  { name: "Tissues", category: "Paper Goods" },
  { name: "Storage bags", category: "Paper Goods" },
  { name: "Aluminum foil", category: "Paper Goods" },
  { name: "Plastic wrap", category: "Paper Goods" },

  // Laundry
  { name: "Laundry detergent", category: "Laundry" },
  { name: "Fabric softener", category: "Laundry" },
  { name: "Dryer sheets", category: "Laundry" },
  { name: "Stain remover", category: "Laundry" },

  // Toiletries & Personal Care
  { name: "Toothpaste", category: "Toiletries & Personal Care" },
  { name: "Toothbrushes", category: "Toiletries & Personal Care" },
  { name: "Shampoo", category: "Toiletries & Personal Care" },
  { name: "Conditioner", category: "Toiletries & Personal Care" },
  { name: "Body wash", category: "Toiletries & Personal Care" },
  { name: "Hand soap", category: "Toiletries & Personal Care" },
  { name: "Deodorant", category: "Toiletries & Personal Care" },
  { name: "Cotton swabs", category: "Toiletries & Personal Care" },
  { name: "Band-aids", category: "Toiletries & Personal Care" },

  // Other Household
  { name: "Batteries", category: "Other Household" },
  { name: "Light bulbs", category: "Other Household" },
  { name: "Air freshener", category: "Other Household" },
];
