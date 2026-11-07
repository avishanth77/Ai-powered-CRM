# Design System Defaults

## Tokens
- **Spacing**: 4px base scale (4, 8, 12, 16, 24, 32, 48, 64).
- **Type**: one sans family (Inter, Geist, or system). Scale 12/14/16/20/24/32; body 14-16px, line-height 1.4-1.6; max 2 weights in UI.
- **Radius**: 6-8px controls, 12px cards.
- **Color**: neutral gray scale (9-10 steps) + 1 brand/primary + semantic (success, warning, danger, info). Check AA contrast. Support dark mode via variables.
- **Elevation**: border-first, light shadows for overlays only.
- **Motion**: 120-200ms ease-out; respect `prefers-reduced-motion`.

## CSS variables starter
```css
:root{
  --bg:#fff; --surface:#f8fafc; --border:#e2e8f0;
  --text:#0f172a; --muted:#64748b;
  --primary:#4f46e5; --primary-contrast:#fff;
  --success:#16a34a; --warning:#d97706; --danger:#dc2626;
  --radius:8px; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
}
@media (prefers-color-scheme:dark){
  :root{--bg:#0b1020; --surface:#111936; --border:#233056; --text:#e5e9f5; --muted:#94a3b8;}
}
```

## Core components (define each with variants, states, usage)
Button (primary/secondary/ghost/danger; default, hover, focus, active, disabled, loading) · Input/Select/Checkbox/Radio/Switch · Table · Tabs · Modal/Drawer · Dropdown/Menu · Toast · Badge/Tag · Tooltip · Card · Avatar · Breadcrumb · Pagination · Skeleton · Empty state · Command palette.

## Component spec format
Name · Purpose · Anatomy · Variants · States · Behavior/keyboard · Accessibility (role, aria) · Do/Don't.

## Code guidance
Prefer semantic HTML (`button`, `nav`, `table`, `label`). Visible `:focus-visible` ring. Don't remove outlines. With React: small composable components, props for variants, controlled inputs. With Tailwind/Bootstrap: map tokens to theme config rather than hard-coding values.
