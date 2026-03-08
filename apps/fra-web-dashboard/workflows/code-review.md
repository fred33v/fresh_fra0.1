# Code Review Workflow

## Pre-Review Checklist

Before requesting AI team code review:

- [ ] Code compiles without errors (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Changes are committed to a feature branch
- [ ] PR description explains the change

## Review Process

### 1. Security Review

```
Review for:
- XSS vulnerabilities in user input handling
- SQL injection (Supabase queries)
- Insecure data exposure
- Authentication/authorization gaps
- Sensitive data in logs or errors
```

### 2. Accessibility Review

```
Review for:
- Keyboard navigation
- Screen reader compatibility
- Colour contrast ratios
- Focus indicators
- ARIA labels where needed
```

### 3. Code Quality Review

```
Review for:
- TypeScript strict mode compliance
- Proper error handling
- Component reusability
- Hook dependencies correct
- No memory leaks (cleanup in useEffect)
```

### 4. Domain Compliance

```
Review for:
- British English in UI text
- Regulatory terminology accuracy
- Professional tone
- User role restrictions honoured
```

## Review Request Format

```markdown
## Code Review Request

**Branch:** feature/[name]
**Files Changed:** [list key files]
**Type:** [feature / bugfix / refactor]

### Summary
[Brief description of changes]

### Areas of Concern
[Any specific areas you want reviewed]

### Testing Done
[How you tested the changes]
```

## Post-Review Actions

1. Address all security findings immediately
2. Accessibility issues are blocking
3. Code quality issues should be resolved before merge
4. Domain compliance can be iterated if minor
