// Theming glue for the Nivo chart components used on the Budget page.
// Nivo takes a JS theme object (not CSS), so this reads the app's existing
// Hearth/Dakboard CSS custom properties (see src/index.css, switched via
// document.documentElement's data-theme attribute) at render time rather
// than hardcoding colors twice.

import { TRANSACTION_CATEGORIES } from './googleSheets';

// Exported (not just used internally) because Nivo's `colors`/marker props
// often apply to raw SVG presentation attributes rather than an inline
// `style`, and browsers only reliably resolve `var(--x)` inside `style` —
// so any color handed directly to Nivo (as opposed to the theme object
// below, which Nivo does apply via inline style) needs to be resolved to a
// literal value first.
export function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getNivoTheme() {
  const text = cssVar('--text-primary', '#e8e8e8');
  const muted = cssVar('--text-secondary', '#999');
  const grid = cssVar('--border-divider', 'rgba(128,128,128,0.15)');
  const cardBg = cssVar('--bg-card', 'rgba(255,255,255,0.05)');

  return {
    background: 'transparent',
    text: { fill: text, fontSize: 11 },
    axis: {
      ticks: { text: { fill: muted, fontSize: 10 }, line: { stroke: grid } },
      legend: { text: { fill: muted, fontSize: 11 } },
      domain: { line: { stroke: grid } },
    },
    grid: { line: { stroke: grid, strokeWidth: 1 } },
    legends: { text: { fill: muted, fontSize: 10 } },
    tooltip: {
      container: {
        background: cardBg,
        color: text,
        fontSize: 12,
        border: `1px solid ${grid}`,
      },
    },
    labels: { text: { fill: text } },
  };
}

// One fixed color per category, stable across every chart instance so the
// same category always reads the same color whether it shows up in the
// pie, the trend lines, or the Sankey. Cycles the app's small accent
// palette rather than hand-picking 16 unique hex values, since exact hue
// doesn't matter much here as long as it's consistent and distinguishable
// enough with a legend/label alongside it.
const PALETTE = ['#6C7FE8', '#20C9A3', '#FF6B5A', '#FFD060', '#A0ADFF', '#5FD9BC', '#FF8A78', '#E8C466'];

export const CATEGORY_COLORS = Object.fromEntries(
  TRANSACTION_CATEGORIES.map((c, i) => [c, PALETTE[i % PALETTE.length]]),
);

export function colorForCategory(category) {
  return CATEGORY_COLORS[category] || '#888';
}
