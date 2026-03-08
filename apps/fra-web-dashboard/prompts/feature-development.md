# Feature Development Prompt Template

Use this template when requesting new feature development from the AI work team.

---

## Feature Request

**Feature Name:** [Name]

**Priority:** [Critical / High / Medium / Low]

**Target Users:** [admin / facilitator / participant / all]

## Description

[Clear description of what the feature should do]

## User Story

As a [role], I want to [action] so that [benefit].

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Considerations

**Affected Areas:**
- [ ] Frontend components
- [ ] Backend/Supabase
- [ ] Authentication
- [ ] Real-time features

**Dependencies:**
- [List any dependencies]

## Compliance Requirements

- [ ] WCAG 2.1 AA accessibility
- [ ] British English spelling
- [ ] GDPR data handling
- [ ] Security review needed

## Example Usage

```
[Provide example of how the feature should work]
```

---

## AI Team Notes

When implementing:
1. Review existing patterns in `/src/components` and `/src/hooks`
2. Use shadcn/ui components where possible
3. Follow TypeScript strict mode
4. Add appropriate types to `/src/types/workshop.ts`
5. Test across all user roles
