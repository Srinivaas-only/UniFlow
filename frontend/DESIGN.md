# Midnight Amethyst Design System

**UniFlow — Universal Student Design System**

---

## Brand & Style

UniFlow is a warm, premium, and inclusive companion for all university students. It rejects cold, rigid "tech-only" aesthetics in favor of a Sophisticated Studio Atmosphere.

## Shapes & Style

- **Main cards & widgets:** Use `rounded-lg` (24px) or `rounded-md` (16px).
- **Mode:** Dark only — rich midnight amethyst and violet tones.
- **Containers:** No harsh 1px borders. Use smooth background depth drops instead.

---

## Design tokens

```yaml
name: UniFlow Universal Student Design System
colors:
  background: '#12111A'
  surface: '#1A1825'
  surface-dim: '#15141F'
  surface-bright: '#272437'
  surface-container-lowest: '#0D0C13'
  surface-container-low: '#1E1B2C'
  surface-container: '#232033'
  surface-container-high: '#2E2A42'
  surface-container-highest: '#3A3552'
  on-surface: '#F1EFF5'
  on-surface-variant: '#D0CBE1'
  outline: '#9E97B3'
  outline-variant: '#554F68'
  primary: '#D6C4FF'
  on-primary: '#321078'
  primary-container: '#B696FF'
  on-primary-container: '#220057'
  secondary: '#A3DAFF'
  on-secondary: '#002E47'
  secondary-container: '#48B7FF'
  tertiary: '#FFC2DC'
  on-tertiary: '#520033'
  error: '#FFB4AB'
typography:
  display-lg:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 46px
    fontWeight: '700'
    lineHeight: 54px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
rounded:
  sm: 0.375rem
  DEFAULT: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
```

### Color reference

| Token | Hex | Use |
|-------|-----|-----|
| background | `#12111A` | Page background |
| surface | `#1A1825` | Cards, panels |
| primary | `#D6C4FF` | CTAs, accents |
| secondary | `#A3DAFF` | Links, highlights |
| on-surface | `#F1EFF5` | Body text |

### Typography

| Style | Size / weight | Use |
|-------|----------------|-----|
| display-lg | 46px / 700 | Hero titles |
| headline-lg | 30px / 600 | Section headings |
| body-lg | 18px / 400 | Lead copy |
| body-md | 16px / 400 | Default body |

**Font:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — load from Google Fonts in every HTML screen.

---

## Layout Rules (Non-Negotiable)

- **Fixed Header Offset:** Every page with a fixed TopAppBar (`h-20` = 80px) MUST include `pt-20` on the `<main>` element or its first content child. No content may ever be hidden behind the header. No exceptions.
- **Sidebar Offset:** Every page with the fixed SideNavBar (280px) MUST include `md:ml-[280px]` on `<main>`. The `md:` prefix is non-negotiable — on mobile (<768px) the sidebar is hidden and content must be full-width. Never use bare `ml-[280px]`.
- **Rule:** If a page has a fixed-position element, the scrollable content below it MUST have matching top/side padding to prevent overlap. This is non-negotiable for every screen.
