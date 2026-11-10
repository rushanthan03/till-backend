import { ProductUnitType } from '../infrastructure/database/entities/product.entity';

export interface SeedProduct {
  name: string;
  department: string;
  category: string;
  brand: string;
  price: number; // VAT-inclusive shelf price
  cost: number;
  vat: 0 | 5 | 20;
  age?: number;
  unit?: ProductUnitType;
  stock: number;
  reorder: number;
}

/** Builds a valid EAN-13 from a 12-digit base (adds the check digit). */
export function ean13(base12: string): string {
  const digits = base12.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + ((10 - (sum % 10)) % 10);
}

const W = ProductUnitType.WEIGHT;

// Demo catalogue. Prices are VAT-inclusive; sample data only.
export const DEMO_PRODUCTS: SeedProduct[] = [
  // Bakery (0% VAT on most basic bread)
  { name: 'White Sliced Loaf 800g', department: 'Bakery', category: 'Bread', brand: 'Baker\'s Best', price: 1.15, cost: 0.7, vat: 0, stock: 40, reorder: 12 },
  { name: 'Wholemeal Loaf 800g', department: 'Bakery', category: 'Bread', brand: 'Baker\'s Best', price: 1.25, cost: 0.78, vat: 0, stock: 32, reorder: 10 },
  { name: 'Butter Croissant 4 Pack', department: 'Bakery', category: 'Pastry', brand: 'Baker\'s Best', price: 1.9, cost: 1.1, vat: 0, stock: 18, reorder: 6 },
  { name: 'Chocolate Muffin 2 Pack', department: 'Bakery', category: 'Cakes', brand: 'Baker\'s Best', price: 2.0, cost: 1.15, vat: 20, stock: 15, reorder: 5 },
  // Dairy & Eggs
  { name: 'Whole Milk 2L', department: 'Dairy & Eggs', category: 'Milk', brand: 'Farm Fresh', price: 1.65, cost: 1.1, vat: 0, stock: 60, reorder: 20 },
  { name: 'Semi Skimmed Milk 2L', department: 'Dairy & Eggs', category: 'Milk', brand: 'Farm Fresh', price: 1.65, cost: 1.1, vat: 0, stock: 55, reorder: 20 },
  { name: 'Salted Butter 250g', department: 'Dairy & Eggs', category: 'Butter', brand: 'Meadow', price: 2.1, cost: 1.5, vat: 0, stock: 30, reorder: 10 },
  { name: 'Mature Cheddar 400g', department: 'Dairy & Eggs', category: 'Cheese', brand: 'Meadow', price: 3.5, cost: 2.4, vat: 0, stock: 24, reorder: 8 },
  { name: 'Free Range Eggs 12 Pack', department: 'Dairy & Eggs', category: 'Eggs', brand: 'Farm Fresh', price: 2.85, cost: 2.0, vat: 0, stock: 36, reorder: 12 },
  { name: 'Natural Yoghurt 500g', department: 'Dairy & Eggs', category: 'Yoghurt', brand: 'Meadow', price: 1.2, cost: 0.75, vat: 0, stock: 28, reorder: 10 },
  // Fruit & Veg
  { name: 'Bananas (per kg)', department: 'Fruit & Veg', category: 'Fruit', brand: 'Loose', price: 1.1, cost: 0.65, vat: 0, unit: W, stock: 45, reorder: 15 },
  { name: 'Apples Gala (per kg)', department: 'Fruit & Veg', category: 'Fruit', brand: 'Loose', price: 2.4, cost: 1.5, vat: 0, unit: W, stock: 38, reorder: 12 },
  { name: 'Tomatoes (per kg)', department: 'Fruit & Veg', category: 'Vegetables', brand: 'Loose', price: 2.8, cost: 1.8, vat: 0, unit: W, stock: 22, reorder: 8 },
  { name: 'Potatoes 2.5kg Bag', department: 'Fruit & Veg', category: 'Vegetables', brand: 'Farm Fresh', price: 2.2, cost: 1.4, vat: 0, stock: 26, reorder: 8 },
  { name: 'Carrots 1kg', department: 'Fruit & Veg', category: 'Vegetables', brand: 'Farm Fresh', price: 0.9, cost: 0.5, vat: 0, stock: 30, reorder: 10 },
  { name: 'Onions 1kg', department: 'Fruit & Veg', category: 'Vegetables', brand: 'Farm Fresh', price: 1.0, cost: 0.6, vat: 0, stock: 34, reorder: 10 },
  // Meat & Fish
  { name: 'Chicken Breast Fillets 1kg', department: 'Meat & Fish', category: 'Poultry', brand: 'Prime Cuts', price: 6.5, cost: 4.8, vat: 0, stock: 14, reorder: 6 },
  { name: 'Beef Mince 500g', department: 'Meat & Fish', category: 'Beef', brand: 'Prime Cuts', price: 3.9, cost: 2.9, vat: 0, stock: 16, reorder: 6 },
  { name: 'Smoked Back Bacon 300g', department: 'Meat & Fish', category: 'Pork', brand: 'Prime Cuts', price: 2.75, cost: 1.9, vat: 0, stock: 20, reorder: 8 },
  { name: 'Salmon Fillets 2 Pack', department: 'Meat & Fish', category: 'Fish', brand: 'Ocean Catch', price: 4.5, cost: 3.2, vat: 0, stock: 10, reorder: 4 },
  // Frozen
  { name: 'Garden Peas 900g', department: 'Frozen', category: 'Vegetables', brand: 'FrostPak', price: 1.8, cost: 1.1, vat: 0, stock: 25, reorder: 8 },
  { name: 'Oven Chips 1.5kg', department: 'Frozen', category: 'Potato', brand: 'FrostPak', price: 2.5, cost: 1.6, vat: 0, stock: 20, reorder: 8 },
  { name: 'Margherita Pizza 350g', department: 'Frozen', category: 'Pizza', brand: 'Napoli', price: 2.2, cost: 1.4, vat: 0, stock: 22, reorder: 8 },
  { name: 'Vanilla Ice Cream 2L', department: 'Frozen', category: 'Ice Cream', brand: 'Creamy', price: 3.0, cost: 1.9, vat: 20, stock: 18, reorder: 6 },
  // Grocery
  { name: 'Basmati Rice 1kg', department: 'Grocery', category: 'Rice & Pasta', brand: 'Golden Grain', price: 2.6, cost: 1.7, vat: 0, stock: 40, reorder: 12 },
  { name: 'Spaghetti 500g', department: 'Grocery', category: 'Rice & Pasta', brand: 'Napoli', price: 1.1, cost: 0.65, vat: 0, stock: 44, reorder: 14 },
  { name: 'Baked Beans 400g', department: 'Grocery', category: 'Tinned', brand: 'Heinz-Style', price: 0.95, cost: 0.55, vat: 0, stock: 70, reorder: 20 },
  { name: 'Chopped Tomatoes 400g', department: 'Grocery', category: 'Tinned', brand: 'Napoli', price: 0.7, cost: 0.4, vat: 0, stock: 64, reorder: 20 },
  { name: 'Plain Flour 1.5kg', department: 'Grocery', category: 'Baking', brand: 'Golden Grain', price: 1.3, cost: 0.8, vat: 0, stock: 26, reorder: 8 },
  { name: 'Granulated Sugar 1kg', department: 'Grocery', category: 'Baking', brand: 'Golden Grain', price: 1.35, cost: 0.85, vat: 0, stock: 30, reorder: 10 },
  { name: 'Sunflower Oil 1L', department: 'Grocery', category: 'Oils', brand: 'Golden Grain', price: 2.3, cost: 1.5, vat: 0, stock: 24, reorder: 8 },
  { name: 'Cornflakes 500g', department: 'Grocery', category: 'Cereal', brand: 'Morning Crunch', price: 2.1, cost: 1.3, vat: 0, stock: 28, reorder: 10 },
  // Drinks (soft)
  { name: 'Cola 2L', department: 'Drinks', category: 'Soft Drinks', brand: 'Fizz', price: 1.85, cost: 1.1, vat: 20, stock: 48, reorder: 16 },
  { name: 'Still Water 6 x 1.5L', department: 'Drinks', category: 'Water', brand: 'Clearspring', price: 2.3, cost: 1.4, vat: 0, stock: 36, reorder: 12 },
  { name: 'Orange Juice 1L', department: 'Drinks', category: 'Juice', brand: 'Sunny', price: 1.7, cost: 1.05, vat: 0, stock: 30, reorder: 10 },
  { name: 'Tea Bags 80 Pack', department: 'Drinks', category: 'Tea & Coffee', brand: 'Brew', price: 2.6, cost: 1.7, vat: 0, stock: 34, reorder: 10 },
  { name: 'Instant Coffee 200g', department: 'Drinks', category: 'Tea & Coffee', brand: 'Brew', price: 4.5, cost: 3.1, vat: 0, stock: 20, reorder: 6 },
  { name: 'Energy Drink 500ml', department: 'Drinks', category: 'Energy', brand: 'Volt', price: 1.35, cost: 0.8, vat: 20, age: 16, stock: 42, reorder: 12 },
  // Snacks & Confectionery
  { name: 'Ready Salted Crisps 6 Pack', department: 'Snacks & Confectionery', category: 'Crisps', brand: 'Crunchy', price: 1.8, cost: 1.1, vat: 20, stock: 50, reorder: 16 },
  { name: 'Milk Chocolate Bar 100g', department: 'Snacks & Confectionery', category: 'Chocolate', brand: 'Cocoa Co', price: 1.2, cost: 0.7, vat: 20, stock: 60, reorder: 20 },
  { name: 'Digestive Biscuits 400g', department: 'Snacks & Confectionery', category: 'Biscuits', brand: 'Crumb', price: 1.4, cost: 0.85, vat: 0, stock: 38, reorder: 12 },
  // Household
  { name: 'Toilet Roll 9 Pack', department: 'Household', category: 'Paper', brand: 'SoftTouch', price: 4.5, cost: 3.0, vat: 20, stock: 26, reorder: 8 },
  { name: 'Washing Up Liquid 500ml', department: 'Household', category: 'Cleaning', brand: 'Sparkle', price: 1.4, cost: 0.8, vat: 20, stock: 30, reorder: 10 },
  { name: 'Laundry Detergent 1.5L', department: 'Household', category: 'Laundry', brand: 'Sparkle', price: 5.5, cost: 3.6, vat: 20, stock: 18, reorder: 6 },
  { name: 'Carrier Bag (Large)', department: 'Household', category: 'Bags', brand: 'Store', price: 0.1, cost: 0.04, vat: 20, stock: 500, reorder: 100 },
  // Health & Beauty
  { name: 'Toothpaste 100ml', department: 'Health & Beauty', category: 'Oral Care', brand: 'BrightSmile', price: 1.9, cost: 1.1, vat: 20, stock: 26, reorder: 8 },
  { name: 'Shampoo 400ml', department: 'Health & Beauty', category: 'Hair', brand: 'Silk', price: 2.8, cost: 1.7, vat: 20, stock: 20, reorder: 6 },
  // Alcohol / Tobacco (age restricted)
  { name: 'Lager 4 x 440ml', department: 'Alcohol', category: 'Beer', brand: 'Golden Lager', price: 5.5, cost: 3.6, vat: 20, age: 18, stock: 32, reorder: 10 },
  { name: 'Red Wine 75cl', department: 'Alcohol', category: 'Wine', brand: 'Valle', price: 7.5, cost: 4.9, vat: 20, age: 18, stock: 24, reorder: 8 },
  { name: 'Vodka 70cl', department: 'Alcohol', category: 'Spirits', brand: 'Frost', price: 16.0, cost: 12.0, vat: 20, age: 18, stock: 12, reorder: 4 },
  { name: 'Cigarettes 20 Pack', department: 'Tobacco', category: 'Cigarettes', brand: 'Regal-Style', price: 13.5, cost: 12.4, vat: 20, age: 18, stock: 40, reorder: 12 },
  { name: 'Disposable Lighter', department: 'Tobacco', category: 'Accessories', brand: 'Flame', price: 1.0, cost: 0.4, vat: 20, age: 18, stock: 60, reorder: 15 },
  // Extended catalogue
  { name: 'Seeded Batch Loaf 800g', department: 'Bakery', category: 'Bread', brand: "Baker's Best", price: 1.45, cost: 0.9, vat: 0, stock: 30, reorder: 10 },
  { name: 'Cinnamon Swirl 2 Pack', department: 'Bakery', category: 'Pastry', brand: "Baker's Best", price: 1.8, cost: 1.0, vat: 20, stock: 14, reorder: 5 },
  { name: 'Plain Bagels 5 Pack', department: 'Bakery', category: 'Bread', brand: "Baker's Best", price: 1.35, cost: 0.8, vat: 0, stock: 20, reorder: 6 },
  { name: 'Soft Dinner Rolls 6 Pack', department: 'Bakery', category: 'Bread', brand: "Baker's Best", price: 1.1, cost: 0.65, vat: 0, stock: 26, reorder: 8 },
  { name: 'Skimmed Milk 2L', department: 'Dairy & Eggs', category: 'Milk', brand: 'Farm Fresh', price: 1.65, cost: 1.1, vat: 0, stock: 40, reorder: 15 },
  { name: 'Mozzarella 125g', department: 'Dairy & Eggs', category: 'Cheese', brand: 'Meadow', price: 1.0, cost: 0.6, vat: 0, stock: 22, reorder: 8 },
  { name: 'Greek Yoghurt 500g', department: 'Dairy & Eggs', category: 'Yoghurt', brand: 'Meadow', price: 1.7, cost: 1.1, vat: 0, stock: 24, reorder: 8 },
  { name: 'Double Cream 300ml', department: 'Dairy & Eggs', category: 'Cream', brand: 'Meadow', price: 1.6, cost: 1.05, vat: 0, stock: 18, reorder: 6 },
  { name: 'Pears 4 Pack', department: 'Fruit & Veg', category: 'Fruit', brand: 'Orchard', price: 1.75, cost: 1.1, vat: 0, stock: 25, reorder: 8 },
  { name: 'Broccoli Each', department: 'Fruit & Veg', category: 'Veg', brand: 'Orchard', price: 0.85, cost: 0.5, vat: 0, stock: 30, reorder: 10 },
  { name: 'Red Onions 1kg', department: 'Fruit & Veg', category: 'Veg', brand: 'Orchard', price: 1.2, cost: 0.7, vat: 0, stock: 35, reorder: 10 },
  { name: 'Strawberries 400g', department: 'Fruit & Veg', category: 'Fruit', brand: 'Orchard', price: 2.5, cost: 1.6, vat: 0, stock: 20, reorder: 8 },
  { name: 'Cucumber Each', department: 'Fruit & Veg', category: 'Veg', brand: 'Orchard', price: 0.8, cost: 0.45, vat: 0, stock: 28, reorder: 8 },
  { name: 'Grapes Red 500g', department: 'Fruit & Veg', category: 'Fruit', brand: 'Orchard', price: 2.2, cost: 1.4, vat: 0, stock: 22, reorder: 8 },
  { name: 'Chicken Thighs 1kg', department: 'Meat & Fish', category: 'Poultry', brand: 'Prime Cuts', price: 4.0, cost: 2.9, vat: 0, stock: 18, reorder: 6 },
  { name: 'Beef Mince 500g', department: 'Meat & Fish', category: 'Beef', brand: 'Prime Cuts', price: 3.5, cost: 2.6, vat: 0, stock: 20, reorder: 6 },
  { name: 'Cod Fillets 2 Pack', department: 'Meat & Fish', category: 'Fish', brand: 'Prime Cuts', price: 4.25, cost: 3.0, vat: 0, stock: 12, reorder: 4 },
  { name: 'Pork Sausages 8 Pack', department: 'Meat & Fish', category: 'Pork', brand: 'Prime Cuts', price: 2.8, cost: 1.9, vat: 0, stock: 24, reorder: 8 },
  { name: 'Garden Peas 900g', department: 'Frozen', category: 'Veg', brand: 'Arctic', price: 1.5, cost: 0.9, vat: 0, stock: 30, reorder: 10 },
  { name: 'Cheese Pizza 400g', department: 'Frozen', category: 'Ready Meals', brand: 'Arctic', price: 2.5, cost: 1.5, vat: 20, stock: 22, reorder: 8 },
  { name: 'Vanilla Ice Cream 1L', department: 'Frozen', category: 'Dessert', brand: 'Arctic', price: 2.3, cost: 1.4, vat: 20, stock: 18, reorder: 6 },
  { name: 'Oven Chips 1.5kg', department: 'Frozen', category: 'Potato', brand: 'Arctic', price: 2.4, cost: 1.5, vat: 0, stock: 20, reorder: 6 },
  { name: 'Spaghetti 500g', department: 'Grocery', category: 'Pasta', brand: 'Pantry', price: 1.0, cost: 0.55, vat: 0, stock: 45, reorder: 12 },
  { name: 'Basmati Rice 1kg', department: 'Grocery', category: 'Rice', brand: 'Pantry', price: 2.2, cost: 1.4, vat: 0, stock: 30, reorder: 10 },
  { name: 'Chopped Tomatoes 400g', department: 'Grocery', category: 'Tins', brand: 'Pantry', price: 0.7, cost: 0.4, vat: 0, stock: 60, reorder: 20 },
  { name: 'Baked Beans 415g', department: 'Grocery', category: 'Tins', brand: 'Pantry', price: 0.8, cost: 0.45, vat: 0, stock: 55, reorder: 18 },
  { name: 'Cornflakes 500g', department: 'Grocery', category: 'Cereal', brand: 'Pantry', price: 2.1, cost: 1.3, vat: 0, stock: 26, reorder: 8 },
  { name: 'Tomato Ketchup 460g', department: 'Grocery', category: 'Condiments', brand: 'Pantry', price: 1.9, cost: 1.15, vat: 20, stock: 24, reorder: 8 },
  { name: 'Plain Flour 1.5kg', department: 'Grocery', category: 'Baking', brand: 'Pantry', price: 1.4, cost: 0.85, vat: 0, stock: 22, reorder: 8 },
  { name: 'Sunflower Oil 1L', department: 'Grocery', category: 'Oil', brand: 'Pantry', price: 2.6, cost: 1.8, vat: 20, stock: 20, reorder: 6 },
  { name: 'Cola 2L', department: 'Drinks', category: 'Soft Drinks', brand: 'Fizz', price: 1.8, cost: 1.0, vat: 20, stock: 40, reorder: 12 },
  { name: 'Still Water 6 x 500ml', department: 'Drinks', category: 'Water', brand: 'Spring', price: 1.5, cost: 0.8, vat: 0, stock: 36, reorder: 12 },
  { name: 'Orange Juice 1L', department: 'Drinks', category: 'Juice', brand: 'Orchard', price: 1.9, cost: 1.2, vat: 0, stock: 30, reorder: 10 },
  { name: 'Tea Bags 80 Pack', department: 'Drinks', category: 'Hot Drinks', brand: 'Brew', price: 2.2, cost: 1.4, vat: 0, stock: 34, reorder: 10 },
  { name: 'Instant Coffee 100g', department: 'Drinks', category: 'Hot Drinks', brand: 'Brew', price: 3.5, cost: 2.4, vat: 0, stock: 20, reorder: 6 },
  { name: 'Energy Drink 250ml', department: 'Drinks', category: 'Energy', brand: 'Surge', price: 1.1, cost: 0.6, vat: 20, stock: 50, reorder: 16 },
  { name: 'Ready Salted Crisps 6 Pack', department: 'Snacks & Confectionery', category: 'Crisps', brand: 'Crunchy', price: 1.6, cost: 0.9, vat: 20, stock: 40, reorder: 12 },
  { name: 'Milk Chocolate Bar 100g', department: 'Snacks & Confectionery', category: 'Chocolate', brand: 'Cocoa', price: 1.2, cost: 0.7, vat: 20, stock: 50, reorder: 15 },
  { name: 'Digestive Biscuits 400g', department: 'Snacks & Confectionery', category: 'Biscuits', brand: 'Crumbs', price: 1.4, cost: 0.8, vat: 20, stock: 30, reorder: 10 },
  { name: 'Fruit Gums 160g', department: 'Snacks & Confectionery', category: 'Sweets', brand: 'Cocoa', price: 1.0, cost: 0.55, vat: 20, stock: 36, reorder: 10 },
  { name: 'Washing Up Liquid 500ml', department: 'Household', category: 'Cleaning', brand: 'Sparkle', price: 1.3, cost: 0.7, vat: 20, stock: 30, reorder: 10 },
  { name: 'Toilet Roll 9 Pack', department: 'Household', category: 'Paper', brand: 'Soft', price: 4.5, cost: 3.0, vat: 20, stock: 24, reorder: 8 },
  { name: 'Laundry Capsules 30', department: 'Household', category: 'Laundry', brand: 'Sparkle', price: 6.5, cost: 4.5, vat: 20, stock: 16, reorder: 6 },
  { name: 'Toothpaste 100ml', department: 'Health & Beauty', category: 'Oral', brand: 'Fresh', price: 1.8, cost: 1.0, vat: 20, stock: 30, reorder: 10 },
  { name: 'Shampoo 400ml', department: 'Health & Beauty', category: 'Hair', brand: 'Silk', price: 2.9, cost: 1.8, vat: 20, stock: 20, reorder: 6 },
  { name: 'Shower Gel 250ml', department: 'Health & Beauty', category: 'Body', brand: 'Silk', price: 1.9, cost: 1.1, vat: 20, stock: 24, reorder: 8 },
  { name: 'Pale Ale 4 x 440ml', department: 'Alcohol', category: 'Beer', brand: 'Golden Lager', price: 6.0, cost: 4.0, vat: 20, age: 18, stock: 24, reorder: 8 },
  { name: 'White Wine 75cl', department: 'Alcohol', category: 'Wine', brand: 'Valle', price: 7.0, cost: 4.6, vat: 20, age: 18, stock: 20, reorder: 6 },
];

export function buildSeedRows(storeId: string) {
  return DEMO_PRODUCTS.map((p, i) => ({
    storeId,
    name: p.name,
    // 50-prefixed EAN-13 with a valid check digit (demo barcodes)
    barcode: ean13('50000000' + String(i + 1).padStart(4, '0')),
    sku: `${p.department.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
    department: p.department,
    category: p.category,
    brand: p.brand,
    unitType: p.unit ?? ProductUnitType.EACH,
    price: p.price,
    costPrice: p.cost,
    vatRate: p.vat,
    ageRestriction: p.age ?? 0,
    stockQuantity: p.stock,
    reorderLevel: p.reorder,
    isActive: true,
  }));
}
