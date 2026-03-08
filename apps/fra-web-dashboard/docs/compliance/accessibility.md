# Accessibility Compliance Guide

## Standard: WCAG 2.1 Level AA

As a government-facing platform, Risk Aware must meet WCAG 2.1 AA standards.

## Key Requirements

### Perceivable

#### Text Alternatives (1.1)
- All images have meaningful `alt` text
- Decorative images use `alt=""`
- Charts have text descriptions

#### Time-based Media (1.2)
- Videos have captions
- Audio content has transcripts

#### Adaptable (1.3)
- Semantic HTML structure
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- Tables have headers and captions

#### Distinguishable (1.4)
- Colour contrast ratio minimum 4.5:1 (text)
- Colour contrast ratio minimum 3:1 (UI elements)
- Text can be resized to 200% without loss
- No information conveyed by colour alone

### Operable

#### Keyboard Accessible (2.1)
- All functionality available via keyboard
- No keyboard traps
- Focus order logical
- Focus indicators visible

#### Enough Time (2.2)
- Timed sessions can be extended
- Users warned before timeout
- Auto-updating content can be paused

#### Seizures (2.3)
- No content flashes more than 3 times/second

#### Navigable (2.4)
- Skip links available
- Page titles descriptive
- Focus order meaningful
- Link purpose clear from text

### Understandable

#### Readable (3.1)
- Language of page declared
- Unusual words explained
- Abbreviations expanded

#### Predictable (3.2)
- Navigation consistent
- Components behave consistently
- No unexpected context changes

#### Input Assistance (3.3)
- Error identification clear
- Labels and instructions provided
- Error prevention for legal/financial

### Robust

#### Compatible (4.1)
- Valid HTML
- Name, role, value for custom components
- Status messages announced to screen readers

## Testing Checklist

### Automated Testing
- [ ] Run axe-core or similar
- [ ] Check colour contrast
- [ ] Validate HTML

### Manual Testing
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader (VoiceOver/NVDA)
- [ ] Zoom to 200%
- [ ] High contrast mode
- [ ] Reduced motion preference

### User Testing
- [ ] Test with users who have disabilities
- [ ] Gather feedback on pain points
- [ ] Iterate based on feedback

## Common Issues in This Codebase

### shadcn/ui Components
Most are accessible by default, but verify:
- Custom styling doesn't break contrast
- Dialogs trap focus correctly
- Tooltips accessible to keyboard users

### Charts (Recharts)
- Add text descriptions
- Consider data tables as alternative
- Ensure legends are accessible

### Interactive Workshop Elements
- Quiz questions announce results
- Progress indicators readable
- Scenario choices keyboard navigable

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [GOV.UK Accessibility Requirements](https://www.gov.uk/guidance/accessibility-requirements-for-public-sector-websites-and-apps)
- [axe DevTools](https://www.deque.com/axe/devtools/)
