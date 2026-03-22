---
name: api-design
description: Design RESTful or GraphQL APIs with consistent patterns. Generates endpoint specs, request/response schemas, and error contracts. Use when designing new APIs or reviewing API changes.
allowed-tools: Read, Bash, Write
---

# API Design Skill

## Process

### 1. Requirements
- What resources are being exposed?
- Who are the consumers? (frontend, mobile, third-party, internal)
- What operations are needed? (CRUD, search, aggregate, real-time)
- Performance requirements? (latency, throughput, caching)

### 2. Design Output
For each endpoint, produce:

```yaml
# Example
POST /api/v1/orders
  Description: Create a new order
  Auth: Bearer token (role: customer)
  Rate limit: 10/min per user
  
  Request:
    Content-Type: application/json
    Body:
      items: [{product_id: string, quantity: integer(1-100)}]  # required
      shipping_address_id: string  # required
      notes: string(0-500)  # optional
  
  Response 201:
    {id, status, items, total, created_at}
  
  Errors:
    400: Invalid request body
    401: Missing/invalid auth
    404: Product or address not found
    409: Insufficient stock
    422: Order validation failed (min amount, etc.)
```

### 3. Consistency Checks
- [ ] Naming: plural nouns, consistent casing
- [ ] Pagination on all list endpoints
- [ ] Error format consistent across all endpoints
- [ ] Auth requirements documented
- [ ] Rate limits defined
- [ ] Breaking change? → version bump needed

### 4. Generate Artifacts
- OpenAPI 3.0 spec (YAML)
- TypeScript/Python/Java types from spec
- Example curl commands for testing
