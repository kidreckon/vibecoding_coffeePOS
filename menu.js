// Sample menu (IDR). Edited on the phone in Settings; this is only the starting point.

export const SAMPLE_MENU = {
  addons: [
    { id: 'iced', name: 'Iced', price: 0 },
    { id: 'hot', name: 'Hot', price: 0 },
    { id: 'oat', name: 'Oat milk', price: 5000 },
    { id: 'shot', name: 'Extra shot', price: 6000 },
    { id: 'vanilla', name: 'Vanilla syrup', price: 4000 },
    { id: 'caramel', name: 'Caramel syrup', price: 4000 },
    { id: 'lesssugar', name: 'Less sugar', price: 0 },
    { id: 'large', name: 'Large', price: 5000 },
  ],
  items: [
    { id: 'espresso', name: 'Espresso', price: 18000, cat: 'Coffee', addons: ['shot'] },
    { id: 'americano', name: 'Americano', price: 22000, cat: 'Coffee', addons: ['iced', 'hot', 'shot', 'large'] },
    { id: 'latte', name: 'Cafe Latte', price: 28000, cat: 'Coffee', addons: ['iced', 'hot', 'oat', 'shot', 'vanilla', 'caramel', 'large'] },
    { id: 'cappuccino', name: 'Cappuccino', price: 28000, cat: 'Coffee', addons: ['iced', 'hot', 'oat', 'shot', 'large'] },
    { id: 'flatwhite', name: 'Flat White', price: 30000, cat: 'Coffee', addons: ['oat', 'shot'] },
    { id: 'kopisusu', name: 'Kopi Susu Aren', price: 25000, cat: 'Coffee', addons: ['iced', 'hot', 'oat', 'shot', 'lesssugar', 'large'] },
    { id: 'mocha', name: 'Mocha', price: 32000, cat: 'Coffee', addons: ['iced', 'hot', 'oat', 'shot', 'lesssugar'] },
    { id: 'matcha', name: 'Matcha Latte', price: 30000, cat: 'Non-coffee', addons: ['iced', 'hot', 'oat', 'lesssugar', 'large'] },
    { id: 'choco', name: 'Chocolate', price: 28000, cat: 'Non-coffee', addons: ['iced', 'hot', 'oat', 'lesssugar'] },
    { id: 'tea', name: 'Lemon Tea', price: 18000, cat: 'Non-coffee', addons: ['iced', 'hot', 'lesssugar'] },
    { id: 'croissant', name: 'Croissant', price: 25000, cat: 'Food', addons: [] },
    { id: 'bananabread', name: 'Banana Bread', price: 22000, cat: 'Food', addons: [] },
  ],
};
