# Orders & Students — Recent Updates

## 1. PUT /api/v1/students/:id — Update student class

The `PUT /students/:id` endpoint now accepts a `class` field in addition to `firstName` and `lastName`.

### Request body

```json
{
  "firstName": "Kouassi",
  "lastName": "Yao",
  "class": "CM2"
}
```

All fields are optional. An empty body is accepted (no-op).

### Validation

- `class` must be a non-empty string if provided (`""` → 400)

### Access

| Role | Allowed |
|------|---------|
| SUPER_ADMIN | ✅ |
| SCHOOL_ADMIN (own school) | ✅ |
| PARENT (linked to student) | ✅ |
| STUDENT | ❌ 403 |
| SCHOOL_ADMIN (other school) | ❌ 403 |
| PARENT (unlinked) | ❌ 403 |

---

## 2. Orders — scheduledFor

Orders can now be placed for a specific weekday (Monday to Friday). This allows students or vendors to schedule orders in advance within the week.

### New field: `scheduledFor`

Added to the `POST /api/v1/orders/vendor/:vendorId` request body.

```json
{
  "studentId": "uuid",
  "items": [{ "itemId": "uuid", "quantity": 1 }],
  "scheduledFor": "2026-06-16"
}
```

- **Optional** — defaults to today's date if not provided
- **Format** — `YYYY-MM-DD`
- **Validation** :
  - Must be a weekday (Mon–Fri) → 400 if weekend
  - Cannot be in the past → 400 if before today

`scheduledFor` is returned in the order response.

### Daily limit check

The daily spending limit (`card.dailyLimit`) is now evaluated **per scheduled day**, not per creation day.

**Before:** counted orders created today (`createdAt >= today`)  
**After:** counts orders scheduled for the same day (`scheduledFor = dto.scheduledFor`)

This means:
- Ordering 3 000 XOF for Friday and 3 000 XOF for Monday never conflict with each other, even if both are placed today
- Two orders scheduled for the same day are checked against the limit together

### Wallet reserved

`reserved` increases immediately when the order is created, regardless of `scheduledFor`. This guarantees that funds are available on the scheduled day.

```
available = balance - reserved
```

All future pending orders are factored in — a student cannot overcommit funds across multiple scheduled days.

### spentToday

`spentToday` in the wallet response is calculated dynamically: sum of PENDING + VALIDATED orders where `scheduledFor = today`. It reflects what is planned for the current day, not the creation date of the orders.

### Migration

```
1777600000000-AddScheduledForToOrders
```

Adds a `scheduledFor date NOT NULL` column to the `orders` table.
