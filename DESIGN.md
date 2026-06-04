# Content Co-op — Design System

> Warm minimalism for industrial creative. Cream canvas, serif authority, periwinkle precision.

---

## 1. Visual Theme & Atmosphere

Content Co-op produces video for industrial and energy brands. The design language balances editorial warmth with technical credibility. We never look like a generic SaaS startup or an overly playful consumer brand.

- **Mood**: Confident, warm, precise, understated luxury
- **Density**: Sparse. Generous whitespace. One idea per screen.
- **Motion**: Slow, cinematic. No bouncy animations.
- **Photography**: Full-bleed industrial imagery with warm gradients. Human scale against massive infrastructure.

---

## 2. Color Palette & Roles

| Token | Hex | Role |
|-------|-----|------|
| `--cc-cream` | `#f5f0e8` | Primary background |
| `--cc-cream-warm` | `#f3ede2` | Gradient shifts, hover states |
| `--cc-navy` | `#0c1322` | Primary text, footer background |
| `--cc-navy-deep` | `#081324` | Dark accents, hero overlays |
| `--cc-periwinkle` | `#4c8ef5` | CTA, links, active states, accent italic |
| `--cc-periwinkle-purple` | `#a78bf5` | Gradient mid-point, decorative |
| `--cc-teal` | `#2dd4bf` | Success, gradient end, confirmation |
| `--cc-text` | `#1a1a1a` | Body text on cream |
| `--cc-text-muted` | `#666666` | Secondary text, captions |
| `--cc-border` | `rgba(0,0,0,0.08)` | Subtle dividers, card borders |
| `--cc-border-hover` | `rgba(0,0,0,0.15)` | Hover states |

### Gradient Accent
`linear-gradient(90deg, #4c8ef5, #a78bf5, #2dd4bf)` — used sparingly for progress bars, decorative lines, and emphasis.

---

## 3. Typography Rules

| Role | Font | Weight | Size | Letter-Spacing |
|------|------|--------|------|----------------|
| Display H1 | Fraunces | 400 | clamp(2.5rem, 5vw, 4rem) | -0.02em |
| Display H1 italic accent | Fraunces | 500 italic | inherit | inherit |
| H2 | Fraunces | 500 | clamp(1.5rem, 3vw, 2.25rem) | -0.01em |
| H3 | Fraunces | 500 | clamp(1.25rem, 2vw, 1.5rem) | 0 |
| Body | Plus Jakarta Sans | 400 | 1rem | 0 |
| Body small | Plus Jakarta Sans | 400 | 0.875rem | 0 |
| Label / Kicker | Plus Jakarta Sans | 600 | 0.75rem | 0.15em |
| Button | Plus Jakarta Sans | 600 | 0.875rem | 0.08em |
| Nav link | Plus Jakarta Sans | 500 | 0.875rem | 0.1em |

- **Line height**: 1.5 for body, 1.1–1.2 for display
- **Text transform**: Kicker labels are UPPERCASE
- **Max width**: Body text max 65ch for readability

---

## 4. Component Stylings

### Buttons

**Primary (filled)**
- Background: `--cc-periwinkle`
- Text: white
- Padding: 0.875rem 1.75rem
- Border-radius: 999px (pill)
- Hover: darken 8%, translateY(-1px)
- Shadow: none (no glows)

**Secondary (ghost)**
- Background: transparent
- Border: 1px solid `--cc-navy`
- Text: `--cc-navy`
- Padding: 0.875rem 1.75rem
- Border-radius: 999px
- Hover: background `--cc-cream-warm`

**Tertiary (text link)**
- No background, no border
- Text: `--cc-periwinkle`
- Hover: underline

### Cards

**Light card (standard)**
- Background: white or `--cc-cream`
- Border: 1px solid `--cc-border`
- Border-radius: 16px
- Padding: 1.5rem
- Shadow: none
- Hover: border-color `--cc-border-hover`, translateY(-2px)

**Active/selected card**
- Border: 2px solid `--cc-periwinkle`
- Background: `rgba(76, 142, 245, 0.04)`

### Inputs

- Background: white
- Border: 1px solid `--cc-border`
- Border-radius: 12px
- Padding: 0.875rem 1rem
- Focus: border `--cc-periwinkle`, box-shadow `0 0 0 3px rgba(76,142,245,0.1)`
- Placeholder: `--cc-text-muted`

### Chips / Pills

- Background: transparent
- Border: 1px solid `--cc-border`
- Border-radius: 999px
- Padding: 0.5rem 1rem
- Active: border `--cc-periwinkle`, background `rgba(76,142,245,0.08)`

### Progress Bar

- Track: `rgba(0,0,0,0.06)`
- Fill: gradient `#4c8ef5 → #a78bf5 → #2dd4bf`
- Height: 3px
- Border-radius: 999px

### Navigation

- Background: `--cc-cream` with `backdrop-filter: blur(12px)`
- Height: 64px
- Logo: left
- Links: right, uppercase, letter-spacing 0.1em
- Active link: `--cc-periwinkle` underline
- Mobile: hamburger, full-screen overlay

### Footer

- Background: `--cc-navy`
- Text: `rgba(255,255,255,0.6)`
- Links: `rgba(255,255,255,0.8)`
- Hover: white

---

## 5. Layout Principles

- **Container max-width**: 1200px for nav, 900px for content pages
- **Padding scale**: 1rem, 1.5rem, 2rem, 3rem, 4rem, 6rem
- **Grid**: CSS Grid or Flexbox. No complex 12-column grid needed.
- **Whitespace**: Generous. Sections separated by 4–6rem.
- **Responsive breakpoints**: 640px, 768px, 1024px

---

## 6. Depth & Elevation

**NO drop shadows on cards.** Elevation is communicated through:
- Border color shifts (subtle → visible)
- Background shifts (cream → white)
- Scale (hover translateY)

The only acceptable shadow is on the primary button hover, and it must be soft and natural:
`0 4px 12px rgba(12, 19, 34, 0.08)`

---

## 7. Do's and Don'ts

### ✅ Do
- Use cream backgrounds for all public pages
- Use Fraunces for all headings
- Use periwinkle for CTAs, links, and accent italic words
- Keep layouts single-column for content pages
- Use generous whitespace
- Use uppercase + letter-spacing for labels and kickers

### ❌ Don't
- Use dark navy gradient backgrounds on public pages
- Use glass-morphism or frosted cards
- Use blue glow shadows
- Use dark glass inputs
- Use complex multi-column layouts for forms
- Use bouncy or fast animations
- Use neon or overly vibrant colors

---

## 8. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| < 640px | Single column, full-width cards, stacked nav |
| 640–1024px | Two-column where appropriate, nav collapses to hamburger |
| > 1024px | Full layout, max-width containers centered |

---

## 9. Agent Prompt Guide

When building a new page for Content Co-op:

1. Start with cream background (`#f5f0e8`)
2. Use Fraunces for headings, Plus Jakarta Sans for body
3. Use periwinkle (`#4c8ef5`) for CTAs and accent words
4. Use light bordered cards, NOT dark glass
5. Use pill-shaped buttons with 999px radius
6. Keep forms single-column with generous spacing
7. Add a kicker label above headings: uppercase, periwinkle, em-dash prefix
8. End with the dark navy footer

**Quick reference:**
- Background: `#f5f0e8`
- Text: `#1a1a1a`
- Accent: `#4c8ef5`
- Heading font: `Fraunces, Georgia, serif`
- Body font: `"Plus Jakarta Sans", system-ui, sans-serif`
