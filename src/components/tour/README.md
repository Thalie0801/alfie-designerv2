# Interactive Tour System

A comprehensive, SSR-safe, mobile-adaptive tour system for onboarding users.

## Features

- ✅ **Auto-start on first login** - Automatically launches for new users
- ✅ **User-specific persistence** - Tour completion tracked per email
- ✅ **Mobile-responsive** - Adaptive bubble placement and sizing
- ✅ **SSR-safe** - Works with Next.js, Remix, and CSR apps
- ✅ **DOM-ready detection** - Waits for targets before starting
- ✅ **Timeout protection** - Gracefully handles missing targets
- ✅ **Accessible** - Keyboard navigation and screen reader friendly

## Architecture

```
tour/
├── InteractiveTour.tsx          # Main component (Provider, Bubble, Launcher)
├── DashboardTourAutoStart.tsx   # Auto-start logic component
├── InteractiveTour.test.tsx     # Unit tests
└── README.md                    # This file
```

## How It Works

### 1. Persistence by User Email

Tour completion is stored in `localStorage` with a user-specific key:
```typescript
const key = `alfie.tour.completed:${normalizeEmail(user.email)}`;
```

This ensures each user gets the tour once, even if they log out and back in.

### 2. Mobile Detection

The system detects mobile devices using:
```typescript
const isMobile = window.matchMedia('(max-width: 767px)').matches;
```

On mobile:
- Default placement: `bottom` (easier for thumb reach)
- Max bubble width: `min(320px, 90vw)` (prevents overflow)
- Larger offsets: 14px vs 10px (prevents finger occlusion)

### 3. DOM Target Detection

`DashboardTourAutoStart` uses `MutationObserver` to wait for tour targets:
```typescript
const targets = [
  '[data-tour-id="nav-dashboard"]',
  '[data-tour-id="btn-create"]',
  // ...
];

const hasAllTargets = () => targets.every(sel => !!document.querySelector(sel));
```

Once all targets exist, the tour starts automatically. If targets don't appear within 8 seconds, the observer disconnects gracefully.

### 4. SSR Safety

All browser APIs are guarded:
```typescript
if (typeof window === 'undefined') return null;
```

This prevents crashes during server-side rendering.

### 5. Tour Flow

1. User logs in → `DashboardTourAutoStart` mounted
2. Check `localStorage` → tour completed? → Skip
3. Wait for DOM targets → MutationObserver
4. All targets ready → `start()` called
5. User navigates through steps → state managed by `TourProvider`
6. User completes/closes tour → marked completed in `localStorage`

## Usage

### Basic Setup (React Router / Vite)

```tsx
// App.tsx or main layout
import { TourProvider } from '@/components/tour/InteractiveTour';
import { DashboardTourAutoStart } from '@/components/tour/DashboardTourAutoStart';
import { useAuth } from '@/hooks/useAuth';

function App() {
  const { user } = useAuth();

  return (
    <TourProvider options={{ userEmail: user?.email }}>
      <DashboardTourAutoStart />
      {/* Your app content */}
    </TourProvider>
  );
}
```

### Next.js Setup

```tsx
// app/layout.tsx
import { TourProvider } from '@/components/tour/InteractiveTour';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TourProvider>
          {children}
        </TourProvider>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx
import { DashboardTourAutoStart } from '@/components/tour/DashboardTourAutoStart';

export default function Dashboard() {
  return (
    <>
      <DashboardTourAutoStart />
      {/* Dashboard content */}
    </>
  );
}
```

### Adding Tour Targets

Mark elements with `data-tour-id` or `data-sidebar-id` attributes:

```tsx
<div data-tour-id="nav-dashboard">
  <h1>Dashboard</h1>
</div>

<NavLink data-sidebar-id="chat">
  Chat Alfie
</NavLink>

<Button data-tour-id="btn-create">
  Create Content
</Button>

<div data-tour-id="quotas">
  <QuotasDisplay />
</div>

<div data-tour-id="brand-kit">
  <h2>Brand Kits</h2>
</div>

<div data-tour-id="quick-actions">
  <QuickActions />
</div>
```

Current tour targets (Dashboard):
- `[data-tour-id="nav-dashboard"]` - Dashboard link
- `[data-sidebar-id="studio"]` - Studio Solo link in sidebar
- `[data-sidebar-id="studio-multi"]` - Studio Multi link in sidebar
- `[data-sidebar-id="chat"]` - Chat Alfie link (mode exploration)
- `[data-tour-id="btn-create"]` - Créateur button (mode expert)
- `center` - Central bubble for explanations (e.g., Chat vs Créateur)
- `[data-tour-id="quotas"]` - Quotas & Woofs display
- `[data-tour-id="quick-actions"]` - Quick actions section
- `[data-tour-id="brand-kit"]` - Brand kit section
- `[data-tour-id="add-brand"]` - Add brand button
- `[data-sidebar-id="library"]` - Library link in sidebar
- `[data-tour-id="news"]` - News section
- `[data-tour-id="suggest"]` - Suggestion button
- `[data-sidebar-id="affiliate"]` - Affiliate link in sidebar

### Studio Solo targets (`/studio`)
- `[data-tour-id="studio-header"]` - Titre de Studio Solo
- `[data-tour-id="studio-image-card"]` - Card création image
- `[data-tour-id="studio-carousel-card"]` - Card création carrousel
- `[data-tour-id="studio-video-card"]` - Card création vidéo
- `[data-tour-id="studio-platform-select"]` - Sélecteur de plateforme
- `[data-tour-id="studio-brandkit-toggle"]` - Toggle Brand Kit

### Studio Multi targets (`/studio/multi`)
- `[data-tour-id="studio-multi-header"]` - Titre de Studio Multi
- `[data-tour-id="studio-multi-presets"]` - Packs prédéfinis (Lancement, Evergreen, Promo)
- `[data-tour-id="studio-multi-tabs"]` - Tabs Mini-Film / Pack Campagne
- `[data-tour-id="mini-film-tab"]` - Tab Mini-Film
- `[data-tour-id="pack-campaign-tab"]` - Tab Pack Campagne

### Custom Tour Steps

```tsx
const customSteps = [
  {
    selector: '[data-tour-id="my-feature"]',
    title: '🎉 New Feature',
    content: 'Check out this amazing new feature!',
    placement: 'bottom',
  },
  // ...
];

<TourProvider steps={customSteps}>
  {/* ... */}
</TourProvider>
```

### Manual Tour Launch

Add a help button anywhere in your app:

```tsx
import { HelpLauncher } from '@/components/tour/InteractiveTour';

function MyHeader() {
  return (
    <header>
      <HelpLauncher />
    </header>
  );
}
```

### Advanced Options

```tsx
<TourProvider 
  options={{
    userEmail: user?.email,
    autoStart: 'on-first-login', // 'on-first-login' | 'always' | 'never'
    skipForAdmins: true,          // Skip tour for admin users
  }}
>
  {/* ... */}
</TourProvider>
```

## Testing

Run unit tests:
```bash
npm test src/components/tour/InteractiveTour.test.tsx
```

Manual testing checklist:
- [ ] Tour starts automatically on first login
- [ ] Tour doesn't restart after completion
- [ ] Tour works on mobile (placement, sizing)
- [ ] Tour works on desktop
- [ ] Tour handles missing targets gracefully
- [ ] Tour stops when clicking overlay or X button
- [ ] Navigation buttons work (Next, Prev, Finish)
- [ ] Progress dots update correctly
- [ ] HelpLauncher can restart tour manually

## Troubleshooting

### Tour doesn't start
- Check that all `data-tour-id` attributes exist in DOM
- Verify user email is passed to `TourProvider`
- Check browser console for debug logs
- Ensure `DashboardTourAutoStart` is mounted

### Tour restarts on every login
- Check `localStorage` for completion key: `alfie.tour.completed:<email>`
- Verify email normalization is consistent
- Check that tour is actually completing (not just closing)

### Bubble positioned incorrectly
- Verify target element has layout (not `display: none`)
- Check viewport size vs bubble size
- Ensure target selector matches actual DOM element

### SSR errors
- All browser API usage should be guarded with `typeof window !== 'undefined'`
- Report any unguarded usage as a bug

## API Reference

### `TourProvider`
Main provider component that manages tour state.

**Props:**
- `children: ReactNode` - App content
- `steps?: TourStep[]` - Custom tour steps (optional)
- `options?: TourOptions` - Configuration options (optional)

### `useTour()`
Hook to access tour context.

**Returns:**
- `isActive: boolean` - Whether tour is currently active
- `currentStep: number` - Current step index
- `totalSteps: number` - Total number of steps
- `start: () => void` - Start the tour
- `stop: () => void` - Stop the tour
- `next: () => void` - Go to next step
- `prev: () => void` - Go to previous step
- `goTo: (step: number) => void` - Jump to specific step

### `DashboardTourAutoStart`
Component that auto-starts tour when targets are ready.

**Props:**
- `targets?: string[]` - Custom selectors to wait for
- `maxWaitMs?: number` - Max wait time (default: 8000ms)

### `HelpLauncher`
Button component to manually launch tour.

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support
- IE11: ❌ Not supported (uses modern APIs)

## Performance

- Bundle size: ~8KB gzipped
- No external dependencies (except React)
- Efficient DOM observation with `MutationObserver`
- Debounced position updates with `requestAnimationFrame`

## License

Internal use only - Part of Alfie Designer platform.
