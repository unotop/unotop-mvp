# Backlog: Slider Component Polish (PR-5.3)

Goal: elevate visual & interaction quality of numeric sliders used in SmallField / MixField contexts.

## Current Issues

- Thin track lacks hierarchy vs surrounding inputs.
- Thumb contrast inconsistent on dark background.
- No focus ring standardization; keyboard affordance subtle.
- No value preview on drag (user must watch number field only).

## Proposed Enhancements

1. Thicker track (2px -> 4px effective) with subtle inner glow.
2. Gradient or dual-tone track fill (active vs remaining) with smooth transition.
3. Thumb redesign:
   - 14px circle -> 16px with 1px border + soft shadow.
   - State layers: default, hover (brighten), active (scale 1.05), focus (outline 2px #6366f1 + offset).
4. Optional value bubble while dragging (portal / absolutely positioned) with tabular-nums.
5. Accessible labels: aria-valuetext mapping (e.g. add unit symbol) when appropriate.
6. Reduced motion support: disable bubble animation if prefers-reduced-motion.
7. Theming tokens: `--slider-track`, `--slider-track-active`, `--slider-thumb`, `--slider-focus-outline`.
8. Precision step hint: on Shift+Arrow smaller increments.

## Implementation Notes

- Consider extracting `<Slider>` component wrapping native `<input type="range">`.
- Use CSS custom properties for dynamic fill: `background: linear-gradient(to right, var(--active) X%, var(--rest) 0);` where X computed inline style.
- Debounce external onChange for heavy recalcs.
- Provide `compact` prop for ultra density mode (thumb 12px, track 3px, no bubble).

## Testing

- Keyboard interaction (Arrow, Shift+Arrow) adjusts value correctly.
- Focus ring visible and meets contrast.
- Bubble hidden in ultra density / reduced motion.

## Open Questions

- Should we allow direct number overlay editing near the thumb? (future)
- Integrate haptic feedback for mobile? (low priority)

---

Status: Planned. Not yet scheduled for implementation.
