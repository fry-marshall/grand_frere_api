# Grand Frère API — Reference Documentation

**Base URL:** `http://localhost:3000/api/v1`  
**Content-Type:** `application/json`

---

## Overview

### Response format — single object

Every successful non-list response is wrapped by `ResponseInterceptor`. The `data` field contains the actual payload:

```json
{
  "data": {
    "id": "uuid",
    "accessToken": "eyJhbGci...",
    ...
  },
  "timestamp": "2025-04-30T12:00:00.000Z"
}
```

> Throughout this document, response examples show only the **content of `data`**. Always wrap them with `{ "data": ..., "timestamp": "..." }` in practice.

### Response format — paginated list

List endpoints return a paginated object inside `data`:

```json
{
  "data": {
    "data": [
      { "id": "uuid", ... },
      { "id": "uuid", ... }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "timestamp": "2025-04-30T12:00:00.000Z"
}
```

### Error format

All errors use the same structure. The `error` field is the HTTP reason phrase:

| HTTP status | `error` value      |
|-------------|--------------------|
| 400         | `Bad Request`      |
| 401         | `Unauthorized`     |
| 403         | `Forbidden`        |
| 404         | `Not Found`        |
| 409         | `Conflict`         |

**Single-message error (401, 403, 404, 409):**

```json
{
  "statusCode": 404,
  "message": "Card not found",
  "error": "Not Found"
}
```

**Validation error (400) — message is always an array:**

```json
{
  "statusCode": 400,
  "message": [
    "phone must match /^\\+2250\\d{9}$/",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

**Business-rule conflict error (409):**

```json
{
  "statusCode": 409,
  "message": "Student already has two parents",
  "error": "Conflict"
}
```

### Pagination query parameters

All list endpoints accept:

| Param   | Type    | Default | Constraints |
|---------|---------|---------|-------------|
| `page`  | integer | `1`     | min 1       |
| `limit` | integer | `20`    | min 1, max 100 |

### Roles

| Value          | Description              |
|----------------|--------------------------|
| `SUPER_ADMIN`  | Platform administrator   |
| `SCHOOL_ADMIN` | School-level admin       |
| `VENDOR`       | Food vendor              |
| `PARENT`       | Student's parent/guardian |
| `STUDENT`      | Student cardholder       |

---

## Auth

### POST /auth/scan-card

Check card status and whether a student and parents are already registered.  
**Auth:** None

**Body:**

| Field  | Type   | Required | Constraints      |
|--------|--------|----------|------------------|
| `code` | string | yes      | non-empty string |

**Response 200:**

```json
{
  "status": "UNASSIGNED",
  "student": false,
  "parents": [false, false]
}
```

| Field     | Type                                          |
|-----------|-----------------------------------------------|
| `status`  | `UNASSIGNED \| ACTIVE \| SUSPENDED \| BLOCKED` |
| `student` | boolean — true if a student is linked         |
| `parents` | `[boolean, boolean]` — slots 1 and 2 filled  |

**Errors:**

| Code | Message         |
|------|-----------------|
| 404  | Card not found  |

---

### POST /auth/signup/parent

Register a new parent account and link it to a student via their card.  
**Auth:** None

Behavior depends on the card's current status:

| Card status   | Behavior                                                                                                 |
|---------------|----------------------------------------------------------------------------------------------------------|
| `UNASSIGNED`  | Creates a student account (no phone/password) + wallet + activates card, then creates the parent account |
| `ACTIVE`      | Links the parent to the existing student                                                                  |
| `SUSPENDED` / `BLOCKED` | Returns 409                                                                              |

**Body:**

| Field                | Type   | Required             | Constraints                     |
|----------------------|--------|----------------------|---------------------------------|
| `cardCode`           | string | yes                  | non-empty                       |
| `firstName`          | string | yes                  | non-empty (parent)              |
| `lastName`           | string | yes                  | non-empty (parent)              |
| `phone`              | string | yes                  | Ivorian format `+2250XXXXXXXXX` |
| `password`           | string | yes                  | min 8 chars                     |
| `studentFirstName`   | string | yes (UNASSIGNED only) | non-empty                      |
| `studentLastName`    | string | yes (UNASSIGNED only) | non-empty                      |
| `studentClass`       | string | no                   | e.g. `"6ème A"`                 |
| `pin`                | string | no                   | exactly 4 digits (UNASSIGNED only — sets card PIN) |

**Response 201:**

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "a3f8b2..."
}
```

**Errors:**

| Code | Message                                    |
|------|--------------------------------------------|
| 400  | Validation failed                          |
| 404  | Card not found                             |
| 409  | Card is not active                         |
| 409  | No student is linked to this card          |
| 409  | Student already has two parents            |
| 409  | Phone already exists                       |

---

### POST /auth/signup/student

Register a new student account via an unassigned card.  
**Auth:** None

**Body:**

| Field       | Type   | Required | Constraints                     |
|-------------|--------|----------|---------------------------------|
| `cardCode`  | string | yes      | non-empty                       |
| `firstName` | string | yes      | non-empty                       |
| `lastName`  | string | yes      | non-empty                       |
| `phone`     | string | yes      | Ivorian format `+2250XXXXXXXXX` |
| `password`  | string | yes      | min 8 chars                     |
| `class`     | string | no       | e.g. `"6ème A"`                 |
| `pin`       | string | no       | exactly 4 digits — sets card PIN on first activation |

**Response 201:** `AuthTokensResponseDto` (same as signup/parent)

**Errors:**

| Code | Message                                   |
|------|-------------------------------------------|
| 400  | Validation failed                         |
| 404  | Card not found                            |
| 409  | Card is not available for registration    |
| 409  | Phone already exists                      |

---

### POST /auth/signup/vendor

Register a new vendor account for a school.  
**Auth:** None

**Body:**

| Field        | Type   | Required | Constraints                   |
|--------------|--------|----------|-------------------------------|
| `firstName`  | string | yes      | non-empty                     |
| `lastName`   | string | yes      | non-empty                     |
| `phone`      | string | yes      | Ivorian format `+2250XXXXXXXXX` |
| `password`   | string | yes      | min 8 chars                   |
| `shopName`   | string | yes      | non-empty                     |
| `schoolId`   | UUID   | yes      | valid UUID                    |
| `waveNumber` | string | no       | Wave mobile money number      |

**Response 201:** `AuthTokensResponseDto`

**Errors:**

| Code | Message              |
|------|----------------------|
| 400  | Validation failed    |
| 404  | School not found     |
| 409  | Phone already exists |

---

### POST /auth/signin

Sign in with phone and password.  
**Auth:** None

**Body:**

| Field      | Type   | Required | Constraints                   |
|------------|--------|----------|-------------------------------|
| `phone`    | string | yes      | Ivorian format `+2250XXXXXXXXX` |
| `password` | string | yes      | min 8 chars                   |

**Response 200:** `AuthTokensResponseDto`

**Errors:**

| Code | Message             |
|------|---------------------|
| 400  | Validation failed   |
| 401  | Invalid credentials |

---

### POST /auth/refresh

Rotate the refresh token and get a new token pair.  
**Auth:** None

**Body:**

| Field          | Type   | Required |
|----------------|--------|----------|
| `refreshToken` | string | yes      |

**Response 200:** `AuthTokensResponseDto`

**Errors:**

| Code | Message                             |
|------|-------------------------------------|
| 400  | Validation failed                   |
| 401  | Invalid or expired refresh token    |

---

### POST /auth/signout

Revoke the current refresh token.  
**Auth:** None

**Body:**

| Field          | Type   | Required |
|----------------|--------|----------|
| `refreshToken` | string | yes      |

**Response 200:** (empty body)

---

### PUT /auth/fcm-token

Register or clear the FCM device token for push notifications.  
**Auth:** Bearer — any authenticated role

**Body:**

| Field      | Type           | Required | Description                              |
|------------|----------------|----------|------------------------------------------|
| `fcmToken` | string \| null | no       | Firebase device token. Send `null` to clear. |

**Response 200:** (empty body)

**Errors:**

| Code | Message      |
|------|--------------|
| 401  | Unauthorized |

---

## Cards

> All card endpoints require a Bearer token.

### POST /cards

Generate a batch of cards with QR codes for a school.  
**Auth:** `SUPER_ADMIN`

**Body:**

| Field      | Type    | Required | Constraints        |
|------------|---------|----------|--------------------|
| `schoolId` | UUID    | yes      | valid UUID         |
| `count`    | integer | yes      | min 1, max 100     |

**Response 201:** `CardResponseDto[]` (array)

```json
[
  {
    "id": "uuid",
    "code": "LMC-0001",
    "status": "UNASSIGNED",
    "schoolId": "uuid",
    "studentId": null,
    "dailyLimit": 1000,
    "imageUrl": null,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Errors:**

| Code | Message           |
|------|-------------------|
| 400  | Validation failed |
| 404  | School not found  |

---

### GET /cards/:code

Get card details by code.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school only)

**Path params:**

| Param  | Description        |
|--------|--------------------|
| `code` | Card code string   |

**Response 200:** `CardResponseDto`

| Field        | Type                                          |
|--------------|-----------------------------------------------|
| `id`         | UUID                                          |
| `code`       | string                                        |
| `status`     | `UNASSIGNED \| ACTIVE \| SUSPENDED \| BLOCKED` |
| `schoolId`   | UUID                                          |
| `studentId`  | UUID \| null                                  |
| `dailyLimit` | integer (XOF)                                 |
| `imageUrl`   | string \| null                                |
| `createdAt`  | ISO 8601 date                                 |

**Errors:**

| Code | Message        |
|------|----------------|
| 404  | Card not found |

---

### PUT /cards/:code/suspend

Suspend an active card.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`

**Path params:** `code`  
**Body:** none

**Response 200:** `CardResponseDto`

**Errors:**

| Code | Message                                   |
|------|-------------------------------------------|
| 404  | Card not found                            |
| 409  | Card can only be suspended when active    |

---

### PUT /cards/:code/activate

Reactivate a suspended card.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`

**Path params:** `code`  
**Body:** none

**Response 200:** `CardResponseDto`

**Errors:**

| Code | Message                                    |
|------|--------------------------------------------|
| 404  | Card not found                             |
| 409  | Card can only be activated when suspended  |

---

### PUT /cards/:code/daily-limit

Update the daily spending limit on a student's card.  
**Auth:** `PARENT`, `STUDENT` (must be linked to the card)

**Path params:** `code`

**Body:**

| Field        | Type    | Required | Constraints        |
|--------------|---------|----------|--------------------|
| `dailyLimit` | integer | yes      | min 100, max 100000 (XOF) |

**Response 200:** `CardResponseDto`

**Errors:**

| Code | Message                                       |
|------|-----------------------------------------------|
| 400  | Validation failed                             |
| 403  | Only the linked parent can update the daily limit |
| 404  | Card not found                                |

---

### POST /cards/:code/verify-pin

Verify a student's PIN. Increments failed attempts; blocks card after 3 failures.  
**Auth:** `VENDOR`

**Path params:** `code`

**Body:**

| Field | Type   | Required | Constraints        |
|-------|--------|----------|--------------------|
| `pin` | string | yes      | exactly 4 digits   |

**Response 200:** `CardResponseDto`

**Errors:**

| Code | Message                                           |
|------|---------------------------------------------------|
| 400  | Validation failed                                 |
| 401  | Invalid PIN                                       |
| 403  | Card is blocked after 3 failed PIN attempts       |
| 404  | Card not found                                    |
| 409  | Card is not active                                |

---

### PUT /cards/:code/reset-pin

Reset card PIN after verifying account password. Unblocks card if blocked.  
**Auth:** `STUDENT`, `PARENT` (must be card owner)

**Path params:** `code`

**Body:**

| Field      | Type   | Required | Constraints       |
|------------|--------|----------|-------------------|
| `password` | string | yes      | current account password |
| `newPin`   | string | yes      | exactly 4 digits  |

**Response 200:** `CardResponseDto`

**Errors:**

| Code | Message             |
|------|---------------------|
| 400  | Validation failed   |
| 401  | Invalid password    |
| 403  | Not the card owner  |
| 404  | Card not found      |

---

## Schools

> All school endpoints require a Bearer token.

### POST /schools

Create a new school.  
**Auth:** `SUPER_ADMIN`

**Body:**

| Field     | Type   | Required | Constraints                                  |
|-----------|--------|----------|----------------------------------------------|
| `name`    | string | yes      | non-empty                                    |
| `sigle`   | string | yes      | 2–10 uppercase alphanumeric chars (`A-Z0-9-`) |
| `address` | string | yes      | 5–255 chars                                  |

**Response 201:** `SchoolResponseDto`

```json
{
  "id": "uuid",
  "name": "Lycée Moderne de Cocody",
  "sigle": "LMC",
  "address": "12 Rue des Jardins, Cocody",
  "status": "ACTIVE",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:**

| Code | Message                      |
|------|------------------------------|
| 400  | Validation failed            |
| 409  | School sigle already exists  |

---

### POST /schools/:id/admin

Create a school admin for a given school.  
**Auth:** `SUPER_ADMIN`

**Path params:** `id` (school UUID)

**Body:**

| Field       | Type   | Required | Constraints                   |
|-------------|--------|----------|-------------------------------|
| `firstName` | string | yes      | non-empty                     |
| `lastName`  | string | yes      | non-empty                     |
| `phone`     | string | yes      | Ivorian format `+2250XXXXXXXXX` |
| `password`  | string | yes      | min 8 chars                   |

**Response 201:** `SchoolAdminResponseDto`

```json
{
  "id": "uuid",
  "firstName": "Kouamé",
  "lastName": "Assi",
  "phone": "+22507000000001",
  "role": "SCHOOL_ADMIN",
  "schoolId": "uuid",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Errors:**

| Code | Message              |
|------|----------------------|
| 400  | Validation failed    |
| 404  | School not found     |
| 409  | Phone already exists |

---

### GET /schools

List all schools.  
**Auth:** `SUPER_ADMIN`

**Response 200:** paginated `SchoolResponseDto[]`

---

### GET /schools/:id

Get school details.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school)

**Response 200:** `SchoolResponseDto`

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Not your school  |
| 404  | School not found |

---

### PUT /schools/:id

Update school name or address.  
**Auth:** `SUPER_ADMIN`

**Body:**

| Field     | Type   | Required | Constraints |
|-----------|--------|----------|-------------|
| `name`    | string | no       | non-empty   |
| `address` | string | no       | 5–255 chars |

**Response 200:** `SchoolResponseDto`

**Errors:**

| Code | Message           |
|------|-------------------|
| 400  | Validation failed |
| 404  | School not found  |

---

### PUT /schools/:id/suspend

Suspend an active school.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `SchoolResponseDto`

**Errors:**

| Code | Message                                    |
|------|--------------------------------------------|
| 404  | School not found                           |
| 409  | School can only be suspended when active   |

---

### PUT /schools/:id/activate

Reactivate a suspended school.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `SchoolResponseDto`

**Errors:**

| Code | Message                                     |
|------|---------------------------------------------|
| 404  | School not found                            |
| 409  | School can only be activated when suspended |

---

### GET /schools/:id/vendors

List vendors of a school.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school)  
**Query:** pagination (`page`, `limit`)

**Response 200:** paginated `SchoolVendorResponseDto[]`

```json
{
  "id": "uuid",
  "shopName": "Maquis Chez Konan",
  "waveNumber": "+2250700000000",
  "status": "ACTIVE",
  "createdAt": "...",
  "user": {
    "id": "uuid",
    "firstName": "Konan",
    "lastName": "Brou",
    "phone": "+22501000000"
  }
}
```

VendorStatus: `PENDING | ACTIVE | SUSPENDED | REJECTED`

---

### GET /schools/:id/students

List students of a school.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school)  
**Query:** pagination

**Response 200:** paginated `SchoolStudentResponseDto[]`

```json
{
  "id": "uuid",
  "class": "6ème A",
  "cardId": "uuid",
  "user": {
    "id": "uuid",
    "firstName": "Kouassi",
    "lastName": "Yao",
    "phone": "+22501000000"
  }
}
```

---

### GET /schools/:id/parents

List parents of a school.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school)  
**Query:** pagination

**Response 200:** paginated `SchoolParentResponseDto[]`

```json
{
  "id": "uuid",
  "user": {
    "id": "uuid",
    "firstName": "Aminata",
    "lastName": "Koné",
    "phone": "+22501000000"
  }
}
```

---

### GET /schools/:id/transactions

List transactions of a school with student details.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school)

**Query:**

| Param   | Type    | Description                 |
|---------|---------|-----------------------------|
| `page`  | integer | pagination                  |
| `limit` | integer | pagination                  |
| `from`  | ISO 8601 | filter from date (optional) |
| `to`    | ISO 8601 | filter to date (optional)   |

**Response 200:** paginated `SchoolTransactionResponseDto[]`

```json
{
  "id": "uuid",
  "type": "DEBIT",
  "amount": 500,
  "currency": "XOF",
  "balanceBefore": 2000,
  "balanceAfter": 1500,
  "orderId": "uuid",
  "paymentId": null,
  "createdAt": "...",
  "student": {
    "id": "uuid",
    "class": "6ème A",
    "user": { "id": "uuid", "firstName": "Kouassi", "lastName": "Yao" }
  }
}
```

TransactionType: `CREDIT | DEBIT | RESERVE | RELEASE`

---

## Students

> All student endpoints require a Bearer token.

### GET /students

List students.  
**Auth:** `SUPER_ADMIN` (all schools), `SCHOOL_ADMIN` (own school only)  
**Query:** pagination

**Response 200:** paginated `StudentResponseDto[]`

```json
{
  "id": "uuid",
  "class": "6ème A",
  "schoolId": "uuid",
  "user": {
    "id": "uuid",
    "firstName": "Kouassi",
    "lastName": "Yao",
    "phone": "+22501000000"
  },
  "card": {
    "id": "uuid",
    "code": "LMC-0001"
  }
}
```

---

### GET /students/:id

Get student by id.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school), `STUDENT` (own profile)

**Response 200:** `StudentResponseDto`

**Errors:**

| Code | Message           |
|------|-------------------|
| 403  | Access denied     |
| 404  | Student not found |

---

### GET /students/:id/parents

List a student's linked parents.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (own)

**Response 200:** `StudentParentResponseDto[]`

```json
{
  "id": "uuid",
  "user": {
    "id": "uuid",
    "firstName": "Aminata",
    "lastName": "Koné",
    "phone": "+22501000000"
  }
}
```

---

### GET /students/:id/orders

List a student's orders.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (own)  
**Query:** pagination

**Response 200:** paginated `StudentOrderResponseDto[]`

```json
{
  "id": "uuid",
  "status": "PENDING",
  "totalAmount": 500,
  "expiresAt": "...",
  "createdAt": "...",
  "vendor": {
    "id": "uuid",
    "shopName": "Maquis Chez Konan"
  }
}
```

OrderStatus: `PENDING | VALIDATED | CANCELLED | EXPIRED`

---

### GET /students/:id/transactions

List a student's wallet transactions.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (own)  
**Query:** pagination

**Response 200:** paginated `StudentTransactionResponseDto[]`

```json
{
  "id": "uuid",
  "type": "DEBIT",
  "amount": 500,
  "currency": "XOF",
  "balanceBefore": 2000,
  "balanceAfter": 1500,
  "orderId": "uuid",
  "paymentId": null,
  "createdAt": "..."
}
```

---

## Parents

> All parent endpoints require a Bearer token.

### GET /parents

List parents.  
**Auth:** `SUPER_ADMIN` (all), `SCHOOL_ADMIN` (own school)  
**Query:** pagination

**Response 200:** paginated `ParentResponseDto[]`

```json
{
  "id": "uuid",
  "user": {
    "id": "uuid",
    "firstName": "Aminata",
    "lastName": "Koné",
    "phone": "+22501000000"
  }
}
```

---

### GET /parents/:id

Get parent by id.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (own)

**Response 200:** `ParentResponseDto`

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Parent not found |

---

### GET /parents/:id/students

List a parent's linked students.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (own)

**Response 200:** `StudentResponseDto[]`

---

## Vendors

> All vendor endpoints require a Bearer token.

### GET /vendors

List vendors.  
**Auth:** `SUPER_ADMIN` (all), `SCHOOL_ADMIN` (own school)  
**Query:** pagination

**Response 200:** paginated `VendorResponseDto[]`

```json
{
  "id": "uuid",
  "shopName": "Maquis Chez Konan",
  "waveNumber": "+2250700000000",
  "status": "ACTIVE",
  "schoolId": "uuid",
  "createdAt": "...",
  "user": {
    "id": "uuid",
    "firstName": "Konan",
    "lastName": "Brou",
    "phone": "+22501000000"
  }
}
```

VendorStatus: `PENDING | ACTIVE | SUSPENDED | REJECTED`

---

### GET /vendors/:id

Get vendor by id.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (own school), `VENDOR` (own)

**Response 200:** `VendorResponseDto`

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Vendor not found |

---

### PUT /vendors/:id

Update vendor shop name or wave number.  
**Auth:** `SUPER_ADMIN`, `VENDOR` (own)

**Body:**

| Field        | Type   | Required | Constraints |
|--------------|--------|----------|-------------|
| `shopName`   | string | no       | min 2 chars |
| `waveNumber` | string | no       |             |

**Response 200:** `VendorResponseDto`

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Vendor not found |

---

### DELETE /vendors/:id

Delete a vendor.  
**Auth:** `SUPER_ADMIN`

**Response 204:** (no body)

**Errors:**

| Code | Message          |
|------|------------------|
| 404  | Vendor not found |

---

### POST /vendors/:id/approve

Approve a pending vendor.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `VendorResponseDto`

**Errors:**

| Code | Message                                 |
|------|-----------------------------------------|
| 404  | Vendor not found                        |
| 409  | Vendor can only be approved when pending |

---

### POST /vendors/:id/reject

Reject a pending vendor.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `VendorResponseDto`

**Errors:**

| Code | Message                                 |
|------|-----------------------------------------|
| 404  | Vendor not found                        |
| 409  | Vendor can only be rejected when pending |

---

### GET /vendors/:id/orders

List a vendor's orders.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (own)  
**Query:** pagination

**Response 200:** paginated `VendorOrderResponseDto[]`

```json
{
  "id": "uuid",
  "status": "PENDING",
  "totalAmount": 500,
  "expiresAt": "...",
  "createdAt": "...",
  "student": {
    "id": "uuid",
    "class": "6ème A",
    "user": { "id": "uuid", "firstName": "Kouassi", "lastName": "Yao" }
  }
}
```

---

### GET /vendors/:id/withdrawals

List a vendor's withdrawals.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (own)  
**Query:** pagination

**Response 200:** paginated `VendorWithdrawalResponseDto[]`

```json
{
  "id": "uuid",
  "status": "PENDING",
  "amount": 5000,
  "currency": "XOF",
  "waveNumber": "+2250700000000",
  "paystackRef": null,
  "createdAt": "..."
}
```

WithdrawalStatus: `PENDING | IN_PROGRESS | SUCCESS | FAILED`

---

### GET /vendors/:id/balance

Get a vendor's wallet balance.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (own)

**Response 200:** `VendorBalanceResponseDto`

```json
{
  "vendorId": "uuid",
  "balance": 12500,
  "currency": "XOF",
  "updatedAt": "..."
}
```

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Vendor not found |

---

## Wallets

> All wallet endpoints require a Bearer token.

### GET /wallets/student/:studentId

Get a student's wallet.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`

**Response 200:** `WalletResponseDto`

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "balance": 5000,
  "reserved": 500,
  "currency": "XOF"
}
```

`balance` is available funds. `reserved` is funds held pending order validation.

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Wallet not found |

---

## Payments

### GET /payments

List payments.  
**Auth:** Bearer — `SUPER_ADMIN` (all), `SCHOOL_ADMIN` (own school)  
**Query:** pagination

**Response 200:** paginated `PaymentResponseDto[]`

```json
{
  "id": "uuid",
  "walletId": "uuid",
  "paystackRef": "TX12345",
  "amount": 5000,
  "currency": "XOF",
  "status": "SUCCESS",
  "initiatedBy": "uuid",
  "createdAt": "..."
}
```

PaymentStatus: `PENDING | SUCCESS | FAILED`

---

### POST /payments/initiate

Initiate a wallet top-up via Paystack.  
**Auth:** Bearer — `SUPER_ADMIN`, `PARENT`, `STUDENT`

**Body:**

| Field       | Type    | Required | Constraints |
|-------------|---------|----------|-------------|
| `studentId` | UUID    | yes      | valid UUID  |
| `amount`    | integer | yes      | min 100 (XOF) |

**Response 201:** `InitiatePaymentResponseDto`

```json
{
  "paymentId": "uuid",
  "authorizationUrl": "https://checkout.paystack.com/...",
  "reference": "TX12345"
}
```

**Errors:**

| Code | Message           |
|------|-------------------|
| 403  | Access denied     |
| 404  | Student not found |

---

### POST /payments/webhook

Paystack webhook — confirms payment and credits wallet.  
**Auth:** None (secured via `x-paystack-signature` header)

**Headers:**

| Header                  | Description                   |
|-------------------------|-------------------------------|
| `x-paystack-signature`  | HMAC-SHA512 of raw body       |

**Body:** Paystack event payload (JSON)

**Response 200:** (empty body)

---

## Items

> All item endpoints require a Bearer token.

### GET /items

List items.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (own items only)  
**Query:** pagination

**Response 200:** paginated `ItemResponseDto[]`

```json
{
  "id": "uuid",
  "vendorId": "uuid",
  "name": "Attiéké poisson",
  "price": 500,
  "description": "Avec sauce tomate",
  "imageUrl": "https://...",
  "status": "ACTIVE",
  "createdAt": "..."
}
```

ItemStatus: `ACTIVE | INACTIVE`

---

### GET /items/:id

Get item by id.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (own)

**Response 200:** `ItemResponseDto`

**Errors:**

| Code | Message        |
|------|----------------|
| 403  | Access denied  |
| 404  | Item not found |

---

### POST /items/vendor/:vendorId

Create an item for a vendor.  
**Auth:** `SUPER_ADMIN`, `VENDOR` (own)

**Path params:** `vendorId` (UUID)

**Body:**

| Field         | Type    | Required | Constraints |
|---------------|---------|----------|-------------|
| `name`        | string  | yes      | non-empty   |
| `price`       | integer | yes      | min 1 (XOF) |
| `description` | string  | no       |             |

**Response 201:** `ItemResponseDto`

**Errors:**

| Code | Message          |
|------|------------------|
| 403  | Access denied    |
| 404  | Vendor not found |

---

### PUT /items/:id

Update an item's name, price, description, or status.  
**Auth:** `SUPER_ADMIN`, `VENDOR` (own)

**Body:**

| Field         | Type    | Required | Constraints                  |
|---------------|---------|----------|------------------------------|
| `name`        | string  | no       |                              |
| `price`       | integer | no       | min 1 (XOF)                  |
| `description` | string  | no       |                              |
| `status`      | string  | no       | `ACTIVE \| INACTIVE`         |

**Response 200:** `ItemResponseDto`

**Errors:**

| Code | Message        |
|------|----------------|
| 403  | Access denied  |
| 404  | Item not found |

---

### PUT /items/:id/image

Upload or replace an item's image.  
**Auth:** `SUPER_ADMIN`, `VENDOR` (own)  
**Content-Type:** `multipart/form-data`

**Form fields:**

| Field  | Type   | Required | Constraints             |
|--------|--------|----------|-------------------------|
| `file` | binary | yes      | image file (JPEG/PNG)   |

**Response 200:** `ItemResponseDto`

**Errors:**

| Code | Message        |
|------|----------------|
| 400  | Invalid file   |
| 403  | Access denied  |
| 404  | Item not found |

---

### DELETE /items/:id

Delete an item.  
**Auth:** `SUPER_ADMIN`, `VENDOR` (own)

**Response 204:** (no body)

**Errors:**

| Code | Message        |
|------|----------------|
| 403  | Access denied  |
| 404  | Item not found |

---

## Orders

> All order endpoints require a Bearer token.

### GET /orders

List orders, filtered by role.  
**Auth:** `SUPER_ADMIN` (all), `SCHOOL_ADMIN` (own school), `VENDOR` (own orders), `PARENT`/`STUDENT` (linked student's orders)  
**Query:** pagination

**Response 200:** paginated `OrderResponseDto[]`

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "vendorId": "uuid",
  "status": "PENDING",
  "totalAmount": 500,
  "expiresAt": "...",
  "createdAt": "..."
}
```

---

### GET /orders/:id

Get order details with line items.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`, `PARENT`, `STUDENT`

**Response 200:** `OrderDetailResponseDto`

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "vendorId": "uuid",
  "status": "PENDING",
  "totalAmount": 1000,
  "expiresAt": "...",
  "createdAt": "...",
  "items": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "quantity": 2,
      "unitPrice": 500
    }
  ]
}
```

**Errors:**

| Code | Message        |
|------|----------------|
| 403  | Access denied  |
| 404  | Order not found |

---

### POST /orders/vendor/:vendorId

Create an order for a student at a specific vendor.  
**Auth:** `VENDOR`, `SUPER_ADMIN`, `PARENT`, `STUDENT`

**Path params:** `vendorId` (UUID)

**Body:**

| Field       | Type                | Required | Description                    |
|-------------|---------------------|----------|--------------------------------|
| `studentId` | UUID                | yes      | The student placing the order  |
| `items`     | `CreateOrderItemDto[]` | yes   | At least 1 item                |

`CreateOrderItemDto`:

| Field      | Type    | Required | Constraints |
|------------|---------|----------|-------------|
| `itemId`   | UUID    | yes      | valid UUID  |
| `quantity` | integer | yes      | min 1       |

**Response 201:** `OrderResponseDto`

**Errors:**

| Code | Message                                   |
|------|-------------------------------------------|
| 400  | One or more items are invalid or unavailable |
| 400  | Insufficient wallet balance               |
| 400  | Daily spending limit exceeded             |
| 403  | Access denied                             |
| 404  | Vendor not found                          |
| 404  | Student not found                         |
| 404  | Wallet not found                          |

---

### PUT /orders/:id/validate

Validate a pending order and credit the vendor's wallet.  
**Auth:** `VENDOR` (own), `SUPER_ADMIN`

**Response 200:** `OrderResponseDto` (status → `VALIDATED`)

**Errors:**

| Code | Message                       |
|------|-------------------------------|
| 400  | Order is not in pending status |
| 403  | Access denied                 |
| 404  | Order not found               |

---

### PUT /orders/:id/cancel

Cancel a pending order and release the wallet reservation.  
**Auth:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`, `PARENT`, `STUDENT`

**Response 200:** `OrderResponseDto` (status → `CANCELLED`)

**Errors:**

| Code | Message                       |
|------|-------------------------------|
| 400  | Order is not in pending status |
| 403  | Access denied                 |
| 404  | Order not found               |

---

## Withdrawals

> All withdrawal endpoints require a Bearer token.

### GET /withdrawals

List withdrawals. VENDOR sees own; SUPER_ADMIN sees all.  
**Auth:** `VENDOR`, `SUPER_ADMIN`  
**Query:** pagination

**Response 200:** paginated `WithdrawalResponseDto[]`

```json
{
  "id": "uuid",
  "vendorId": "uuid",
  "amount": 5000,
  "currency": "XOF",
  "waveNumber": "+2250700000000",
  "paystackRef": null,
  "status": "PENDING",
  "createdAt": "..."
}
```

WithdrawalStatus: `PENDING | IN_PROGRESS | SUCCESS | FAILED`

---

### POST /withdrawals/vendor/:vendorId

Request a withdrawal from a vendor's wallet.  
**Auth:** `VENDOR` (own), `SUPER_ADMIN`

**Path params:** `vendorId` (UUID)

**Body:**

| Field        | Type    | Required | Constraints              |
|--------------|---------|----------|--------------------------|
| `amount`     | integer | yes      | min 100 (XOF)            |
| `waveNumber` | string  | yes      | min 3 chars              |

**Response 201:** `WithdrawalResponseDto`

**Errors:**

| Code | Message                            |
|------|------------------------------------|
| 400  | Insufficient vendor wallet balance |
| 403  | Access denied                      |
| 404  | Vendor not found                   |
| 404  | Vendor wallet not found            |

---

### PUT /withdrawals/:id/process

Mark a withdrawal as `IN_PROGRESS`.  
**Auth:** `SUPER_ADMIN`

**Query params:**

| Param         | Type   | Required | Description            |
|---------------|--------|----------|------------------------|
| `paystackRef` | string | no       | Paystack reference ID  |

**Response 200:** `WithdrawalResponseDto`

**Errors:**

| Code | Message                             |
|------|-------------------------------------|
| 400  | Withdrawal is not in pending status |
| 403  | Access denied                       |
| 404  | Withdrawal not found                |

---

### PUT /withdrawals/:id/complete

Mark a withdrawal as `SUCCESS`.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `WithdrawalResponseDto`

**Errors:**

| Code | Message                                |
|------|----------------------------------------|
| 400  | Withdrawal is not in progress status   |
| 403  | Access denied                          |
| 404  | Withdrawal not found                   |

---

### PUT /withdrawals/:id/fail

Mark a withdrawal as `FAILED` and refund the vendor's wallet.  
**Auth:** `SUPER_ADMIN`

**Response 200:** `WithdrawalResponseDto`

**Errors:**

| Code | Message                             |
|------|-------------------------------------|
| 400  | Withdrawal is not in pending status |
| 403  | Access denied                       |
| 404  | Withdrawal not found                |

---

## Notifications

> All notification endpoints require a Bearer token.

### GET /notifications

List the authenticated user's notifications.  
**Auth:** `PARENT`, `STUDENT`, `VENDOR`  
**Query:** pagination

**Response 200:** paginated `NotificationResponseDto[]`

```json
{
  "id": "uuid",
  "userId": "uuid",
  "title": "Commande validée",
  "body": "Votre commande a été validée.",
  "type": "ORDER_VALIDATED",
  "data": { "orderId": "uuid" },
  "isRead": false,
  "createdAt": "..."
}
```

NotificationType:

| Value                | Trigger                                      |
|----------------------|----------------------------------------------|
| `ORDER_VALIDATED`    | Order validated by vendor                    |
| `ORDER_CANCELLED`    | Order cancelled                              |
| `ORDER_EXPIRED`      | Order expired (daily scheduler at 23:59)     |
| `VENDOR_SUMMARY`     | Daily item summary for vendor (at 20:00)     |
| `VENDOR_APPROVED`    | Vendor account approved by super admin       |
| `VENDOR_REJECTED`    | Vendor account rejected by super admin       |
| `TOPUP_SUCCESS`      | Wallet top-up succeeded via Paystack         |
| `TOPUP_FAILED`       | Wallet top-up failed                         |
| `WITHDRAWAL_SUCCESS` | Withdrawal marked as SUCCESS                 |
| `WITHDRAWAL_FAILED`  | Withdrawal marked as FAILED                  |

---

### PUT /notifications/:id/read

Mark a single notification as read.  
**Auth:** `PARENT`, `STUDENT`, `VENDOR` (own notification)

**Response 200:** `NotificationResponseDto` (with `isRead: true`)

**Errors:**

| Code | Message               |
|------|-----------------------|
| 403  | Access denied         |
| 404  | Notification not found |

---

### PUT /notifications/read-all

Mark all of the authenticated user's notifications as read.  
**Auth:** `PARENT`, `STUDENT`, `VENDOR`

**Response 200:** `NotificationResponseDto[]` (all updated)

---

## WebSocket

The server exposes a Socket.io gateway on the same port as the HTTP server.

### Connection

```
ws://localhost:3000
```

**Transport:** `websocket`  
**Auth:** JWT passed via the `auth.token` field at connection time (or `Authorization: Bearer <token>` header).

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' },
  transports: ['websocket'],
});
```

A connection with an invalid or missing token is immediately disconnected.

### Rooms

After a successful connection, the client is automatically joined to:

| Room               | Who                | Description                                 |
|--------------------|--------------------|---------------------------------------------|
| `user:{userId}`    | All authenticated  | Receives order status updates               |
| `vendor:{vendorId}`| Vendors only       | Receives new order notifications            |

### Events (server → client)

#### `order.created`

Emitted to `vendor:{vendorId}` when a new order is placed at that vendor.

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "vendorId": "uuid",
  "status": "PENDING",
  "totalAmount": 500,
  "expiresAt": "2025-01-01T00:15:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

#### `order.updated`

Emitted to `user:{userId}` for the student and all linked parents when an order is validated or cancelled.

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "vendorId": "uuid",
  "status": "VALIDATED",
  "totalAmount": 500,
  "expiresAt": "2025-01-01T00:15:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Possible `status` values: `VALIDATED | CANCELLED`

---

## Scheduled Jobs

The following background jobs run automatically — they are not HTTP endpoints.

| Schedule   | Job                    | Description                                                                 |
|------------|------------------------|-----------------------------------------------------------------------------|
| `59 23 * * *` | Order Expiry Scheduler | Marks `PENDING` orders with `expiresAt <= now` as `EXPIRED`, releases wallet reservations, notifies student and parents. |
| `0 20 * * *`  | Vendor Summary Scheduler | Sends a daily summary notification to vendors with `PENDING` orders for tomorrow, listing items and quantities. |
