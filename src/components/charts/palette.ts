// Validated categorical palette (light-mode hexes) — see the dataviz skill's
// references/palette.md. Order is fixed and never cycled/sorted by value:
// slot N always means "the Nth category in this chart's data array", so the
// same category keeps the same color across renders. Passes
// scripts/validate_palette.js (CVD ΔE, normal-vision floor, lightness band)
// for up to 8 adjacent series; three categorical slots below 3:1 contrast
// (aqua/yellow/magenta) are used with visible direct labels per the
// validator's relief-rule WARN, never color alone.
export const CATEGORICAL_PALETTE = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]
}
