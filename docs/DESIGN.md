# CASIO.RADAR — Design System Specification

Adapted from Google Stitch (`Archive Technical Catalog`):

## Brand & Style Philosophy
This design system channels an industrial minimalist editorial archive aesthetic inspired by 20th-century German industrial design, Dieter Rams’ Braun cataloging, Teenage Engineering hardware manuals, and Swiss graphic design rationalism. It treats archival hardware, vintage acoustics, and precision optics as curated artifacts.

### Aesthetic Pillars
- **Swiss International Typographic Style**: Rigid adherence to visual axes, monospaced indexing, strict hierarchy, and bold, monumental headline proportions.
- **Industrial Precision**: Raw technical coordinates, zero border radius, structural grid hair lines, model spec tags (`MOD: 5611`), and segmented numerical indicators (`01 / 07`).
- **Tactile Paper Materiality**: Crisp off-white matte substrate reminiscent of 180gsm archival uncoated stock offset by stark carbon-black typography and subtle anodized aluminum neutral accents.

---

## Color Tokens

| Token | Hex | Role |
|---|---|---|
| `background` / `surface` | `#F5F5F3` / `#F9F9F7` | Authentic warm off-white museum archive substrate |
| `surface-pure` | `#FFFFFF` | Isolated product card background |
| `border-hairline` | `#E2E2DF` | 1px planar grid division lines |
| `border-dark` / `ink` | `#111111` | Stark carbon-black typography and active control framing |
| `ink-muted` | `#666666` | Technical parameters, indices, secondary telemetry |
| `ink-faint` | `#999999` | Passive labels and placeholders |
| `accent-red` | `#E02A1D` | Functional recording indicator and discount percentage cut badge |
| `accent-red-faint` | `#FBEBEA` | Accent red background tint |

---

## Typography Hierarchy

- **Monumental Headline**: `Space Grotesk`, Bold/Black, uppercase, tight tracking (`-0.05em`).
- **Technical & Metadata**: `JetBrains Mono`, 500/600/700 weight, uppercase, tracking (`0.06em` to `0.16em`). Used for indexing, prices, SKUs, and telemetry.
- **Body & Captions**: `Work Sans`, 400/500 weight, neutral grotesque typography.

---

## Form Factor & Components
- **Zero Border Radius**: All buttons, cards, tags, and inputs feature strict `0px` radius (90-degree industrial machining).
- **Hairline Borders**: `1px solid #E2E2DF` grid division.
- **Card Matrix**: Product photography centered on white isolations with crossed-out MRPs in Indian Rupees (`₹`), discount cut tags (`-50% CUT`), and direct action links.
