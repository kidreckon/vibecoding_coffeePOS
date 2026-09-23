// Default menu (IDR). Edited on the phone in Settings.
// Bump MENU_VERSION when changing this file: phones with an older version get this menu
// once on next launch (replacing the menu stored on the phone).

export const MENU_VERSION = 2;

export const SAMPLE_MENU = {
  addons: [
    { id: 'shot', name: 'Extra shot', price: 6000 },
    { id: 'oat', name: 'Oat milk', price: 5000 },
    { id: 'lesssugar', name: 'Less sugar', price: 0 },
    { id: 'lessice', name: 'Less ice', price: 0 },
  ],
  items: [
    { id: 'spanish-iced', name: 'Spanish Latte (Iced)', price: 35000, cat: 'Coffee', addons: ['shot', 'oat', 'lesssugar', 'lessice'] },
    { id: 'spanish-hot', name: 'Hot Spanish Latte', price: 35000, cat: 'Coffee', addons: ['shot', 'oat', 'lesssugar'] },
    { id: 'dirty-latte', name: 'Dirty Latte (Cold)', price: 35000, cat: 'Coffee', addons: ['shot', 'oat'] },
    { id: 'latte-hot', name: 'Hot Caffè Latte', price: 25000, cat: 'Coffee', addons: ['shot', 'oat'] },
    { id: 'latte-iced', name: 'Iced Caffè Latte', price: 25000, cat: 'Coffee', addons: ['shot', 'oat', 'lessice'] },
    { id: 'americano-hot', name: 'Hot Americano', price: 20000, cat: 'Coffee', addons: ['shot'] },
    { id: 'americano-iced', name: 'Iced Americano', price: 20000, cat: 'Coffee', addons: ['shot', 'lessice'] },
  ],
};
