# Z-Index Hierarchy (PR-10 Task H)

Oficiálna z-index mapa pre stabilné layering:

## Base Layers (0-999)

- **Content (default)**: `z-0` to `z-10`
- **SuccessFeedback**: `z-[200]` (toast-like notifications)

## Application Layers (1000-1199)

- **StickyBottomBar**: `z-[1000]` (bottom toolbar)
  - Pravidlo: Dimmed (`opacity: 0.4`) keď `body.modal-open`
  - Safe area: `padding-bottom: max(env(safe-area-inset-bottom), 12px)`

- **Modals (standard)**: `z-[1100]`
  - ContactModal
  - PrivacyModal
  - ReserveWizard (PR-10: upgraded from z-[1000] → z-[1100])
  - ToastStack

## System Layers (9000+)

- **OnboardingTour**: `z-[9998]` (overlay), `z-[9999]` (content)
- **WelcomeModal**: `z-[9999]` (intro modal)
- **SubmissionWarningModal**: `z-[9999]` (critical warnings)

## Legacy (Phase Out)

- **LegacyApp modals**: `z-[100]`, `z-[101]` (migrate to z-[1100])

## Global CSS Rules

```css
/* Prevent scroll when modal is open */
body.modal-open {
  overflow: hidden;
}

/* Dim StickyBottomBar when modal is open */
body.modal-open .sticky-bottom-bar {
  pointer-events: none;
  opacity: 0.4;
  transition: opacity 200ms ease;
}
```

## Testing Checklist

- [ ] StickyBottomBar visible below modals (not clickable when modal open)
- [ ] ContactModal → GDPR link → PrivacyModal (no overlap)
- [ ] ReserveWizard above StickyBottomBar
- [ ] WelcomeModal/OnboardingTour above everything
- [ ] No modal/toolbar overlap on any breakpoint (mobile, tablet, desktop)

## PR-10 Changes

1. **ReserveWizard**: z-[1000] → z-[1100] (eliminate collision with StickyBottomBar)
2. **Verified**: All modals use z-[1100] or higher (consistent)
3. **Verified**: global.css rules work correctly (body.modal-open)
