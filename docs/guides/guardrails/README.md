# Guardrails & Safety

Understanding and using the guardrails system to maintain code quality and safety.

## What Are Guardrails?

Guardrails are automated safety checks that prevent common mistakes and enforce best practices. They run automatically or on demand to catch issues early.

## Guardrail Categories

### Security Guardrails

Protect against security vulnerabilities.

**No Secrets in Code**
- Detects hardcoded API keys, passwords, tokens
- Checks for private keys, AWS credentials
- Fails CI/CD if secrets found

**SQL Injection Prevention**
- Validates query parameterization
- Checks for string concatenation in queries
- Ensures ORM usage (Drizzle)

**XSS Protection**
- Validates output sanitization
- Checks for dangerous HTML insertion
- Ensures proper escaping

### Data Integrity Guardrails

Prevent data loss and corruption.

**Field Mapping Validation (P04)**
- Enforces transformer usage (no direct mapping)
- Validates fieldId matches API names
- Prevents silent data loss

**Migration Safety**
- Detects destructive migrations
- Requires explicit approval for data loss
- Validates backward compatibility

**Referential Integrity**
- Validates foreign key constraints
- Checks cascade behavior
- Prevents orphaned records

### Code Quality Guardrails

Maintain code standards.

**Type Safety**
- Enforces strict TypeScript
- Validates type coverage
- Checks for any types

**Test Coverage**
- Minimum coverage thresholds (80%)
- Tracks coverage trends
- Fails builds if below threshold

**Complexity Limits**
- Maximum cyclomatic complexity (10)
- Maximum function length (50 lines)
- Maximum file length (500 lines)

### Architecture Guardrails

Enforce architectural patterns.

**Circular Dependency Prevention**
- Detects import cycles
- Suggests refactoring
- Blocks commits with cycles

**Layer Violation Detection**
- Enforces clean architecture
- Prevents UI → DB direct calls
- Validates dependency direction

**API Consistency**
- Enforces naming conventions
- Validates endpoint structure
- Checks REST/tRPC standards

## Running Guardrails

### Automatic Execution

Guardrails run automatically:
- Pre-commit hooks
- CI/CD pipelines
- Before deployments

### Manual Execution

Run specific guardrails:

```bash
# Run all guardrails
@guardrail-validator run all

# Run specific category
@guardrail-validator run security

# Run specific guardrail
@guardrail-validator run no-secrets-in-code
```

### IDE Integration

Guardrails can integrate with:
- VS Code extensions
- Pre-commit hooks
- GitHub Actions

## Configuration

Enable/disable guardrails in config:

```json
{
  "guardrails": {
    "security": {
      "no-secrets-in-code": "error",
      "sql-injection-prevention": "error",
      "xss-protection": "warning"
    },
    "data-integrity": {
      "field-mapping-validation": "error",
      "migration-safety": "error"
    },
    "quality": {
      "type-safety": "error",
      "test-coverage": {
        "level": "warning",
        "threshold": 80
      }
    }
  }
}
```

**Levels:**
- `error` - Fails the build, blocks commit
- `warning` - Reports issue, allows override
- `off` - Disabled

## Common Guardrail Violations

### Security

**Violation**: Hardcoded API key
```typescript
// ❌ VIOLATION
const API_KEY = 'sk-1234567890abcdef'

// ✅ CORRECT
const API_KEY = process.env.API_KEY
```

**Violation**: Unparameterized query
```typescript
// ❌ VIOLATION
const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`)

// ✅ CORRECT
const result = await db.select().from(users).where(eq(users.id, userId))
```

### Data Integrity

**Violation**: Direct field mapping
```typescript
// ❌ VIOLATION - P04
const workout = { ...dbRecord, id: dbRecord.workoutId }

// ✅ CORRECT
const workout = toWorkoutUI(dbRecord)
```

**Violation**: Destructive migration
```sql
-- ❌ VIOLATION
DROP TABLE users;

-- ✅ CORRECT
-- Add migration with data preservation
ALTER TABLE users ADD COLUMN new_field;
```

### Quality

**Violation**: Missing types
```typescript
// ❌ VIOLATION
function processData(data) {
  // No types!
}

// ✅ CORRECT
function processData(data: UserData): ProcessedResult {
  // Typed!
}
```

## Bypassing Guardrails

Sometimes you need to bypass a guardrail:

### With Justification

```typescript
// guardrail-disable: no-secrets-in-code
// Reason: This is a test API key for development only
const TEST_API_KEY = 'test-key-123'
// guardrail-enable: no-secrets-in-code
```

### For Specific Lines

```typescript
const result = await db.query(
  `SELECT * FROM users WHERE id = ${userId}` // guardrail-disable-line: sql-injection
)
```

**Note**: Bypasses require approval in CI/CD.

## Creating Custom Guardrails

### 1. Define Guardrail

Create `guardrail.yaml`:

```yaml
name: my-custom-guardrail
severity: error
description: What this guardrail checks

triggers:
  - pre-commit
  - ci-cd
  - manual

patterns:
  - type: regex
    pattern: "bad-pattern-here"
    message: "Explain the issue"

exclude:
  - "**/*.test.ts"
  - "**/test/**"
```

### 2. Implement Check

Create `guardrail.js`:

```javascript
module.exports = {
  name: 'my-custom-guardrail',
  
  check: async (files, context) => {
    const violations = []
    
    for (const file of files) {
      const content = await readFile(file)
      
      if (content.includes('bad-pattern')) {
        violations.push({
          file,
          line: findLineNumber(content, 'bad-pattern'),
          message: 'Found bad pattern',
          severity: 'error'
        })
      }
    }
    
    return violations
  }
}
```

### 3. Register Guardrail

Add to configuration:

```json
{
  "guardrails": {
    "custom": {
      "my-custom-guardrail": "error"
    }
  }
}
```

## Guardrail Reports

### CLI Output

```
🔍 Running Guardrails
====================

Security:
  ✅ No secrets in code
  ✅ SQL injection prevention
  ⚠️  XSS protection (3 warnings)

Data Integrity:
  ✅ Field mapping validation
  ❌ Migration safety (1 error)
    → migration-001.sql:12: DROP TABLE without backup

Quality:
  ✅ Type safety
  ⚠️  Test coverage (78% < 80%)

Results: 1 error, 4 warnings
```

### CI/CD Integration

Guardrails publish reports as:
- GitHub PR comments
- Build status checks
- Slack notifications

## Best Practices

### 1. Never Disable Without Reason

Always document why you're bypassing a guardrail.

### 2. Fix Root Causes

Don't just bypass - fix the underlying issue.

### 3. Start Strict, Relax Gradually

Begin with all guardrails as errors, adjust based on team needs.

### 4. Review Guardrail Reports

Regularly review reports to identify patterns.

### 5. Update Guardrails

Keep guardrails current with evolving threats and patterns.

## Troubleshooting

### Guardrail False Positives

If a guardrail incorrectly flags valid code:
1. Check if it's a known issue
2. Use targeted bypass with comment
3. Report to maintainers

### Performance Issues

If guardrails slow down development:
1. Run only in CI/CD, not pre-commit
2. Optimize guardrail implementations
3. Use caching

## Further Reading

- [Architecture Proposal](../../architecture/PROPOSAL.md) - Guardrails vision
- [Contributing Guide](../../development/contributing.md) - Adding guardrails
