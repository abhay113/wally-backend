# System Architecture - Stellar Wallet Backend

## Executive Summary

This is a production-grade, custodial P2P payment system built on Stellar Testnet, architected like Paytm but using blockchain infrastructure instead of traditional banking rails.

## Core Principles

### 1. Atomicity Guarantee

**Every transaction is atomic** - blockchain operations either fully succeed or do nothing. The database always reflects blockchain truth.

```
CREATED → PENDING → SUCCESS | FAILED
```

No partial debits. Ever.

### 2. Failure Safety

- Transactions can fail, but failures are explicit (status: FAILED)
- No stuck transactions in PENDING state
- Retry logic with exponential backoff
- After max retries, marked FAILED with reason

### 3. Observability

- Structured logging (Pino)
- Audit logs for all critical operations
- Transaction lifecycle tracking
- Admin statistics dashboard

## System Components

### 1. API Server (Fastify)

**Responsibilities:**

- Handle HTTP requests
- Validate input (Zod schemas)
- Authenticate users (Keycloak JWT)
- Enforce authorization (RBAC)
- Create transaction records
- Enqueue jobs to BullMQ
- Return responses immediately

**Does NOT:**

- Wait for blockchain confirmation
- Block on slow operations
- Process transactions directly

### 2. Transaction Worker (BullMQ)

**Responsibilities:**

- Pick up queued transactions
- Validate pre-conditions
- Decrypt wallet secret keys
- Submit to Stellar blockchain
- Poll for confirmation
- Update transaction status
- Sync wallet balances
- Retry on failure

**Key Features:**

- Concurrent processing (configurable)
- Automatic retries (max 3)
- Exponential backoff
- Job persistence (Redis)

### 3. Database (PostgreSQL via Prisma)

**Tables:**

- `users`: User identity and status
- `wallets`: Encrypted keypairs and balances
- `transactions`: Complete transaction lifecycle
- `audit_logs`: All critical operations
- `system_config`: System configuration
- `distributed_locks`: For distributed coordination

**Guarantees:**

- ACID transactions
- Foreign key constraints
- Indexed queries
- Audit trail

### 4. Cache & Queue (Redis)

**Uses:**

- BullMQ job queue
- Distributed locks
- Rate limiting state
- Session caching (future)

### 5. Blockchain (Stellar Testnet)

**Operations:**

- Account creation (via Friendbot)
- XLM payments
- Transaction confirmation
- Balance queries
- Payment streaming (monitoring)

**Why Stellar:**

- Fast (3-5 seconds finality)
- Cheap (0.00001 XLM per transaction)
- Simple payment operations
- Built-in atomic transactions
- Good testnet support

### 6. Identity (Keycloak)

**Provides:**

- User authentication
- JWT token issuance
- Role management (USER, ADMIN)
- Token refresh
- Single sign-on capability

**Integration:**

- Backend validates JWT signatures
- Extracts user identity
- Enforces role-based access

## Data Flow

### User Registration Flow

```
1. User registers/logs in via Keycloak
2. User gets JWT token
3. User calls /api/v1/users/me
4. Backend checks if user exists in DB
5. If not, creates user + wallet
6. Generates Stellar keypair
7. Encrypts secret key
8. Stores in database
9. Returns user profile
```

### Wallet Funding Flow (Testnet)

```
1. User calls POST /wallet/fund
2. Backend checks rate limits
3. Backend checks daily cap
4. Backend calls Stellar Friendbot
5. Friendbot creates/funds account
6. Backend waits 2 seconds
7. Backend queries Stellar for balance
8. Backend updates wallet balance
9. Returns new balance
```

### P2P Payment Flow

```
1. User calls POST /transactions/send
   - recipientHandle: "alice"
   - amount: "100.50"

2. API validates input
3. API resolves handle → user → wallet
4. API checks balances
5. API checks limits
6. API checks wallet/user status
7. API creates transaction (CREATED)
8. API enqueues job
9. API returns transaction ID immediately

--- Worker picks up job ---

10. Worker updates to PENDING
11. Worker gets sender's secret key
12. Worker submits Stellar payment
    - From: sender's public key
    - To: receiver's public key
    - Amount: 100.50 XLM
    - Memo: transaction ID
13. Stellar processes payment
14. Worker gets transaction hash
15. Worker updates to SUCCESS
16. Worker syncs balances
17. User polls GET /transactions/:id
18. User sees SUCCESS status
```

### Failure Scenarios

**Insufficient Balance:**

```
1. User sends payment
2. Validation fails at step 4
3. API returns 400 error
4. No transaction created
```

**Stellar Network Error:**

```
1. Worker submits to Stellar (step 12)
2. Network timeout
3. Worker retries (attempt 2)
4. Still fails
5. Worker retries (attempt 3)
6. Still fails
7. Worker marks FAILED
8. Transaction record shows reason
```

**User Blocked Mid-Flight:**

```
1. Transaction created (CREATED)
2. Admin blocks user
3. Worker picks up job
4. Pre-validation fails
5. Worker marks FAILED
6. No blockchain submission
```

## Security Model

### Encryption at Rest

- **Algorithm**: AES-256-GCM
- **Key**: 32-byte hex string in env var
- **IV**: Random per wallet, stored in DB
- **Auth Tag**: Validates integrity
- **Encrypted Data**: Stellar secret keys

### Authentication Flow

```
1. Client authenticates with Keycloak
2. Keycloak returns JWT
3. Client sends JWT in header
4. Backend validates signature
5. Backend checks expiration
6. Backend extracts claims
7. Backend grants access
```

### Authorization Model

- **USER**: Can manage own wallet, send/receive, view own transactions
- **ADMIN**: Can list users, block users, freeze wallets, view statistics

### Rate Limiting

- **Global**: 100 requests/minute
- **Funding**: 3 times/day per wallet
- **Transactions**: Daily limit configurable

## Error Handling Strategy

### Error Types

```typescript
AppError (base)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── ValidationError (400)
├── NotFoundError (404)
├── InsufficientBalanceError (400)
├── WalletFrozenError (403)
├── UserBlockedError (403)
├── RateLimitExceededError (429)
├── LimitExceededError (400)
├── StellarError (500)
├── TransactionFailedError (500)
├── ConflictError (409)
└── InternalServerError (500)
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance. Required: 100, Available: 50",
    "metadata": {
      "required": "100",
      "available": "50"
    }
  }
}
```

## Observability

### Logging Levels

- **DEBUG**: Request/response details (dev only)
- **INFO**: Normal operations, transaction lifecycle
- **WARN**: Retries, rate limits, validation failures
- **ERROR**: Exceptions, failed transactions, system errors

### Audit Logs

Every critical operation logged:

- User registration
- Wallet creation
- Wallet funding
- Transactions (all statuses)
- Admin actions (block user, freeze wallet)
- Configuration changes

### Metrics to Monitor

- Transaction success rate
- Average transaction time
- Queue depth (BullMQ)
- Database query performance
- API response times
- Error rates by type
- User registrations
- Daily transaction volume

## Scalability Considerations

### Horizontal Scaling

**API Servers:**

- Stateless design
- Can run multiple instances
- Load balance across instances

**Workers:**

- Can run multiple instances
- BullMQ distributes jobs
- Concurrency per worker configurable

**Database:**

- Read replicas for queries
- Write master for transactions
- Connection pooling (Prisma)

**Redis:**

- Redis Cluster for HA
- Sentinel for failover

### Vertical Scaling

- Increase worker concurrency
- Increase database connections
- Optimize query indexes
- Cache frequent queries

## Production Checklist

### Security

- [ ] HTTPS enforced
- [ ] Secrets in vault (not env files)
- [ ] Database encryption at rest
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] DDoS protection

### Reliability

- [ ] Database backups
- [ ] Redis persistence
- [ ] Worker health monitoring
- [ ] Auto-restart on failure
- [ ] Circuit breakers
- [ ] Graceful degradation

### Compliance

- [ ] KYC/AML procedures
- [ ] Transaction monitoring
- [ ] Suspicious activity alerts
- [ ] Regulatory reporting
- [ ] Data retention policies
- [ ] Privacy compliance (GDPR, etc.)

### Operations

- [ ] Monitoring dashboards
- [ ] Alert rules
- [ ] On-call procedures
- [ ] Incident response plan
- [ ] Disaster recovery plan
- [ ] Capacity planning

## Future Enhancements

### Short Term

1. **Webhooks**: Push transaction status updates
2. **Email Notifications**: Transaction confirmations
3. **Transaction History Export**: CSV download
4. **Memo Support**: User-provided payment notes

### Medium Term

1. **Multi-Asset Support**: Other Stellar tokens
2. **Scheduled Payments**: Recurring transfers
3. **Payment Links**: One-time payment requests
4. **QR Codes**: Mobile payment integration

### Long Term

1. **Mainnet Support**: Real XLM transactions
2. **Fiat On/Off Ramps**: Bank integration
3. **Merchant API**: Business accounts
4. **Mobile SDK**: Native app integration
5. **Lightning Network**: Cross-chain payments

## Known Limitations

### Testnet Constraints

- No real value
- Can be reset by Stellar
- Friendbot rate limits
- May have downtime

### System Constraints

- Single currency (XLM only)
- No transaction reversals
- Custodial model (not self-custody)
- Synchronous balance updates

### Stellar Constraints

- Minimum account balance (base reserve)
- Transaction fees (minimal but present)
- Memo size limits (28 bytes)
- Account creation requires funding

## Performance Targets

### API Response Times

- GET requests: < 100ms
- POST requests: < 200ms
- Transaction creation: < 500ms

### Transaction Processing

- Queue pickup: < 1 second
- Stellar submission: < 5 seconds
- Total time (CREATED → SUCCESS): < 10 seconds

### Availability

- API uptime: 99.9%
- Worker uptime: 99.9%
- Database uptime: 99.99%

## Testing Strategy

### Unit Tests

- Service layer logic
- Encryption/decryption
- Validation schemas
- Error handling

### Integration Tests

- API endpoints
- Database operations
- Redis operations
- Stellar integration

### E2E Tests

- Complete user flows
- Payment scenarios
- Error scenarios
- Admin operations

### Load Tests

- Concurrent users
- Transaction throughput
- Queue processing rate
- Database performance

## Conclusion

This system is designed as a **production-ready fintech backend**, not a demo. Every component is built with:

- **Reliability**: No partial state, explicit failures
- **Security**: Encryption, authentication, authorization
- **Scalability**: Async processing, horizontal scaling
- **Observability**: Logging, metrics, audit trails

The architecture is **failure-safe by design** - transactions either succeed completely or fail explicitly. There is no middle ground, no partial debits, no data loss.
