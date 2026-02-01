# Cloudflare Worker Stack

Optimized for Cloudflare Workers with D1, R2, KV, and Queues.

## Stack Overview

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Database**: D1 (SQLite at the edge)
- **Storage**: R2 (S3-compatible object storage)
- **Cache**: KV (Key-Value store)
- **Queues**: Background processing
- **Language**: TypeScript
- **Framework**: Hono or native Workers

## Project Structure

```
my-worker/
├── src/
│   ├── index.ts           # Worker entry point
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   └── utils/             # Utilities
├── tests/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── migrations/            # D1 migrations
├── wrangler.toml          # Worker configuration
├── opencode.json          # OpenCode config
└── AGENTS.md              # Agent guidelines
```

## Essential Commands

```bash
# Development
npm run dev                 # Start local dev server
npm run check              # Lint + type check + test
npm run check:fast         # Lint + type only

# Database
npm run db:migrate         # Run D1 migrations
npm run db:generate        # Generate new migration

# Deployment
npm run deploy:safe        # Safe deployment with validation
npm run deploy:staging     # Deploy to staging

# Testing
npm run test               # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Monitoring
npm run logs               # Tail production logs
npm run ops:health         # Health dashboard
```

## Stack-Specific Agents

| Agent | Purpose |
|-------|---------|
| @cloudflare-expert | Workers, D1, R2, KV, Queues patterns |
| @queue-guardian | Queue message validation |
| @storage-guardian | D1/R2/KV boundary protection |

## Configuration

### wrangler.toml

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "..."

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-bucket"

[[kv_namespaces]]
binding = "CACHE"
id = "..."
```

### opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "extends": "~/.config/opencode/opencode.json",
  "agent": {
    "queue-guardian": {
      "model": "opencode/glm-4.7",
      "prompt": "Guardian of Worker to Queue boundary",
      "mode": "subagent"
    },
    "storage-guardian": {
      "model": "opencode/glm-4.7",
      "prompt": "Guardian of Worker to D1/R2/KV boundary",
      "mode": "subagent"
    }
  }
}
```

## Guardrails (Stack-Specific)

1. **NEVER modify queue messages in-flight** - Immutable once sent
2. **NEVER assume R2+D1 operations are atomic** - Use 3-phase WAL pattern
3. **NEVER send unvalidated messages** - QueueMessageSchema required
4. **ALWAYS validate internal endpoints** - Use INTERNAL_SECRET
5. **ALWAYS handle D1 migrations carefully** - Test in staging first

## Best Practices

### Workers
- Use Hono for routing (cleaner than native)
- Implement proper error handling with generic messages
- Use structured logging (never log sensitive data)

### D1
- Use migrations for schema changes
- Implement connection pooling
- Handle SQLite's single-writer limitation

### R2
- Use presigned URLs for client uploads
- Implement proper content-type handling
- Consider eventual consistency (~60s)

### Queues
- Validate all messages with schemas
- Implement exponential backoff
- Handle permanent failures appropriately

## Example Agent Usage

```bash
# Review Workers code
@cloudflare-expert review my route handlers for best practices

# Validate queue messages
@queue-guardian check my QueueMessageSchema

# Review database access
@storage-guardian review my D1 repository layer
```

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Queues Documentation](https://developers.cloudflare.com/queues/)
