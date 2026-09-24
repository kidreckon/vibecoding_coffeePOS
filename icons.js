// Small line icons (inline SVG, stroke = currentColor).

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  hot: svg('<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.6.8.6 1.7 0 2.5M11 3.5c-.6.8.6 1.7 0 2.5M14 3.5c-.6.8.6 1.7 0 2.5"/>'),
  iced: svg('<path d="M6 7h12l-1.4 12.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z"/><path d="M13 7l2-4"/><rect x="9" y="10" width="3" height="3" rx=".6"/><rect x="12.5" y="13" width="3" height="3" rx=".6"/>'),
  food: svg('<path d="M4 15c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M3 15h18v1.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M9 11l1 4M15 11l-1 4"/>'),
  money: svg('<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>'),
  receipt: svg('<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  cup: svg('<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
};

// Pick a tile icon from the item's name/category.
export function itemIcon(item) {
  const s = `${item.name} ${item.cat || ''}`.toLowerCase();
  if (/food|bread|cake|croissant|cookie|pastry|toast|snack/.test(s)) return ICONS.food;
  if (/iced|ice|cold|es |frappe/.test(s)) return ICONS.iced;
  return ICONS.hot;
}
