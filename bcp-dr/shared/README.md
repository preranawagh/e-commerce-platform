# Shared local helpers

Small CommonJS package used by the five local services. It is not a cloud library.

It contains:

- standard success/error JSON helpers
- Express error and 404 handlers
- JWT authentication middleware
- `authorize(role)` authorization middleware
- internal-or-admin middleware for inventory reserve/release
- express-validator wrapper
- Sequelize factory (PostgreSQL in development, SQLite in tests)
- HTTP client for service-to-service calls
- environment file loading

Each service depends on it with:

```json
"@cloudresilience/shared": "file:../../shared"
```

When you later containerize a service, copy this folder into that service or publish it as a private package. Do not introduce cloud configuration here.
