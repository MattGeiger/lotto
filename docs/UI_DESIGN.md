# UI Design Standards: Shadcn/UI Reference Guide
**Last Updated:** November 2025 (updated with generator palette + Shadcn refresh)  
**Versions:** Shadcn/UI v2.5+, Tailwind CSS v4, React 19, Next.js 16+

## Philosophy & Core Principles

Shadcn/UI is not a traditional component library - it's a code distribution platform where you own the component code directly. Components are copied into your project, giving you full control to customize without library constraints.

### Key Principles:
1. **Open Code**: Full access to component source for modification
2. **Composition**: Shared, predictable interfaces across all components
3. **Accessibility**: WCAG-compliant, built-in accessibility
4. **Beautiful Defaults**: Production-ready styling out of the box
5. **AI-Ready**: Consistent patterns for LLM integration

---

## Project Structure

Organize components by purpose to maintain clarity and scalability:

```
/components
  /ui              # Shadcn components (Card, Button, Badge, etc.)
  /layout          # Navbar, footer, sidebar
  /forms           # Reusable form components
  /shared          # General reusable components
```

**Critical Rule**: Keep business logic separate from UI components. No API calls or state management inside UI components.

---

## Theming: CSS Variables

Shadcn uses CSS variables for theming, allowing color changes without updating class names. Variables must be defined without color space functions.

### Color Tokens & @theme (Tailwind v4)

We use the generator OKLCH palette and map it with `@theme inline` so Tailwind utilities resolve the variables. No `tailwind.config.js` needed.

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.5078 0.1369 257.6669);
  --primary: oklch(0.5078 0.1369 257.6669);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.7221 0.0815 206.8111);
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.9751 0.0127 244.2507);
  --muted-foreground: oklch(0.551 0.0234 264.364);
  --accent: oklch(0.8828 0.1811 94.4604);
  --accent-foreground: oklch(0.5078 0.1369 257.6669);
  --destructive: oklch(0.5771 0.2152 27.3250);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.9276 0.0058 264.5313);
  --input: oklch(0.9670 0.0029 264.5419);
  --ring: oklch(0.5078 0.1369 257.6669);
  --radius: 0.5rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

Custom WTH tokens (status, ticket gradients, display/admin gradients) live alongside these core tokens.

### Display/QR Styling
- Display background and serving text gradients are exposed as utilities (`bg-gradient-display`, `bg-gradient-serving-text`) instead of inline styles.
- Ticket states use utility classes mapped to tokens (`ticket-serving`, `ticket-served`, `ticket-upcoming`) with dedicated text/border/background tokens (including `--ticket-served-text`).
- Public display QR uses a canvas implementation (`qrcode` library) to avoid SVG viewBox scaling issues on long URLs; the QR points to the admin-configured `displayUrl` when set, falling back to the current origin.
- Serving headline uses `bg-gradient-serving-text`; blue gradient in light mode, gold gradient in dark mode for readability and brand fit.

### Adding Custom Colors (Tailwind v4)

**Modern approach:** Use `@theme inline` directive (CSS-first configuration):

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

---

## Tailwind CSS v4 Integration

### Key Changes from v3:
- **No tailwind.config.js** - configuration now in CSS using `@theme inline`
- **OKLCH colors** - more accessible, perceptually uniform
- **New sizing:** `size-10` replaces `w-10 h-10`
- **Imports:** `@import "tailwindcss"` replaces `@tailwind` directives

Keep styles minimal and utility-driven:

### ✅ Good Practice
- Use Shadcn components as generated (`npx shadcn add ...`), with semantic variants (`primary`, `secondary`, `outline`, `destructive`, plus custom badge `success|warning|danger` mapped to status tokens).
- Keep sizing utilities modern (`size-*`), colors semantic (`bg-primary`, `text-muted-foreground`), and gradients via tokens.
- Prefer utility classes over inline styles:
  - Use `bg-gradient-display`, `bg-gradient-serving-text` for display gradients.
  - Use `bg-gradient-card-info` / `bg-gradient-card-accent` for gradient cards.
  - Use `badge-success` (and other status variants) instead of per-instance CSS variables.

### ❌ Avoid
- Custom CSS overrides for colors/hover where Shadcn variants exist
- Inline hard-coded colors; prefer semantic tokens/status variables
- Old sizing patterns (`w-10 h-10`) or legacy imports/config files

---

## Component Composition

Use slot-based composition for maximum reusability:

```tsx
// Card with composition slots
export function Card({ title, children }) {
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}
```

### Standard Shadcn Components

#### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

#### Badge
```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Label</Badge>
<Badge variant="secondary">Label</Badge>
<Badge variant="destructive">Label</Badge>
<Badge variant="outline">Label</Badge>
```

#### New Components (Added Oct 2025)
```tsx
// Spinner - loading indicator
import { Spinner } from "@/components/ui/spinner";
<Spinner />

// Kbd - keyboard shortcuts
import { Kbd } from "@/components/ui/kbd";
<Kbd>⌘K</Kbd>

// Field - complete form field wrapper
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
<Field>
  <FieldLabel>Email</FieldLabel>
  <FieldInput type="email" />
</Field>
```

#### Button
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Click me</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Subtle</Button>
<Button variant="link">Link style</Button>
```

---

## Styling Patterns

### Spacing
Use Tailwind's spacing scale consistently:
- `gap-{n}` for flex/grid gaps
- `space-y-{n}` for vertical stack spacing
- `p-{n}` for padding
- `m-{n}` for margins

### Typography
```tsx
// Headings
className="text-3xl font-bold tracking-tight"
className="text-2xl font-semibold"
className="text-lg font-medium"

// Body text
className="text-sm text-muted-foreground"
className="text-base"

// Labels
className="text-xs uppercase tracking-wide text-muted-foreground"
```

### Layout
```tsx
// Flex containers
className="flex items-center justify-between gap-4"

// Grid layouts
className="grid grid-cols-3 gap-6"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Responsive containers
className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"

// Modern sizing (v4)
className="size-10"  // Replaces w-10 h-10
className="size-full" // Replaces w-full h-full
```

---

## Accessibility Requirements

All components must be built with accessibility in mind, ensuring usability by users with disabilities.

### Checklist:
- ✅ Semantic HTML elements
- ✅ Proper ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Focus indicators visible
- ✅ Color contrast meets WCAG AA standards (4.5:1 for text)
- ✅ Screen reader compatibility

### Example:
```tsx
<button 
  aria-label="Close dialog"
  className="focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
  <X className="h-4 w-4" />
</button>
```

---

## Dark Mode

Toggle dark mode by changing classes on root HTML element. All color variables should have both light and dark mode definitions.

```tsx
// Tailwind dark mode class
<div className="bg-background text-foreground">
  {/* Automatically switches based on .dark class on <html> */}
</div>
```

---

## TypeScript Support (React 19 Updates)

**forwardRef is deprecated** in React 19. Use direct props instead:

```tsx
// ❌ Old (React 18)
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, ...props }, ref) => <div ref={ref} {...props} />
);

// ✅ New (React 19)
interface CardProps extends React.ComponentProps<'div'> {
  title?: string;
  variant?: "default" | "outline";
}

export function Card({ title, variant = "default", ...props }: CardProps) {
  return <div data-slot="card" {...props} />;
}
```

**data-slot attribute:** All primitives now use `data-slot` for targeted styling.

---

## Performance Best Practices (2025)

**React Server Components (RSC)** are default in Next.js 15+. Only add `"use client"` when needed:

```tsx
// Server Component (default in Next.js App Router)
export default function Page() {
  return (
    <div>
      <Card>
        {/* No "use client" needed */}
      </Card>
    </div>
  );
}

// Client Component (only when needed)
'use client';

export function InteractiveCard() {
  const [count, setCount] = useState(0);
  return <Card onClick={() => setCount(c => c + 1)} />;
}
```

---

## Common Anti-Patterns to Avoid (2025 Update)

1. **❌ Using old Tailwind v3 patterns**
   ```tsx
   // Bad
   className="w-10 h-10"  // v3 style
   
   // Good
   className="size-10"    // v4 style
   ```

2. **❌ Using HSL colors**
   ```css
   /* Bad - HSL (deprecated) */
   --primary: 220 70% 50%;
   
   /* Good - OKLCH (current standard) */
   --primary: oklch(0.6 0.15 250);
   ```

3. **❌ Using forwardRef in new components**
   - React 19 removed forwardRef need

4. **❌ Mixing custom CSS with Tailwind**
   - Use Tailwind utilities consistently
   
2. **❌ Hard-coded colors**
   ```tsx
   // Bad
   className="bg-[#0b0b0b] text-[#fff]"
   
   // Good
   className="bg-card text-card-foreground"
   ```

3. **❌ Nested ternaries in className**
   ```tsx
   // Bad
   className={isActive ? isPrimary ? "bg-blue-500" : "bg-gray-500" : "bg-white"}
   
   // Good
   const bgColor = isActive 
     ? isPrimary ? "bg-primary" : "bg-secondary"
     : "bg-background";
   ```

4. **❌ Inline styles**
   ```tsx
   // Bad
   <div style={{ marginTop: 18, backgroundColor: '#0b0b0b' }}>
   
   // Good
   <div className="mt-[18px] bg-card">
   ```

---

## Migration Checklist (2025)

When converting existing components to current Shadcn standards:

### Code Updates
- [ ] Remove styled-jsx, emotion, CSS-in-JS
- [ ] Replace custom CSS with Tailwind utilities
- [ ] Use semantic color tokens (`bg-background`, `text-foreground`)
- [ ] Import Shadcn components (`Card`, `Badge`, `Button`, etc.)
- [ ] Remove `React.forwardRef` (React 19)
- [ ] Add `data-slot` attributes to primitives
- [ ] Update `w-* h-*` to `size-*`
- [ ] Add proper TypeScript types

### Color & Theming
- [ ] Convert HSL to OKLCH colors
- [ ] Update to `@theme inline` directive
- [ ] Remove `tailwind.config.js` (move to CSS)
- [ ] Test in both light and dark modes

### Accessibility & Testing
- [ ] Ensure ARIA attributes present
- [ ] Verify keyboard navigation
- [ ] Check contrast ratios (WCAG AA)
- [ ] Verify responsive behavior

---

## 2025 Updates Summary

**Major Changes:**
- **Tailwind v4** is now standard (CSS-first configuration)
- **OKLCH colors** replace HSL (March 2025)
- **React 19** - forwardRef removed
- **New style:** "new-york" is default ("default" deprecated)
- **New components:** Spinner, Kbd, Field, Button Group, Input Group, Item, Empty
- **Animation:** tw-animate-css replaces tailwindcss-animate
- **CLI improvements:** Cross-framework support, custom registries

## Resources

- Official Docs: https://ui.shadcn.com/docs
- Tailwind v4 Guide: https://ui.shadcn.com/docs/tailwind-v4
- v4 Demo: https://v4.shadcn.com
- Changelog: https://ui.shadcn.com/docs/changelog
- Components: https://ui.shadcn.com/docs/components
- Theming: https://ui.shadcn.com/docs/theming
