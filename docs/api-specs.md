# Grand Frère API — Documentation Complète

> Version : 1.1 — Base URL : `http://localhost:3000/api/v1`  
> Swagger (hors prod) : `GET /api/docs`

---

## Sommaire

1. [Configuration globale](#1-configuration-globale)
2. [Format des réponses](#2-format-des-réponses)
3. [Authentification & autorisation](#3-authentification--autorisation)
4. [Enums & types](#4-enums--types)
5. [Codes d'erreur HTTP](#5-codes-derreur-http)
6. [Modules & endpoints](#6-modules--endpoints)
   - [Auth](#61-auth)
   - [Cards](#62-cards)
   - [Schools](#63-schools)
   - [Students](#64-students)
   - [Parents](#65-parents)
   - [Vendors](#66-vendors)
   - [Items](#67-items)
   - [Orders](#68-orders)
   - [Wallets](#69-wallets)
   - [Payments](#610-payments)
   - [Withdrawals](#611-withdrawals)
   - [Notifications](#612-notifications)
7. [WebSocket (temps réel)](#7-websocket-temps-réel)
8. [Règles métier & edge cases](#8-règles-métier--edge-cases)

---

## 1. Configuration globale

| Paramètre | Valeur |
|---|---|
| Global prefix | `api` |
| Versioning | URI (`/v1/`) |
| Validation globale | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| CORS | `*` en dev · `ALLOWED_ORIGINS` (CSV) en prod |
| Raw body | activé (requis pour la vérification HMAC Paystack) |

---

## 2. Format des réponses

Toutes les réponses HTTP sont enveloppées par le `ResponseInterceptor` :

```json
{
  "data": <payload>,
  "statusCode": 200
}
```

Les réponses de liste paginées ont la structure suivante :

```json
{
  "data": {
    "data": [...],
    "meta": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  },
  "statusCode": 200
}
```

Les réponses d'erreur **ne sont pas** enveloppées par l'intercepteur :

```json
{
  "message": "Error message or array of validation errors",
  "statusCode": 400
}
```

---

## 3. Authentification & autorisation

### JWT

- Envoyé en header : `Authorization: Bearer <accessToken>`
- Payload : `{ sub: userId, role: UserRole }`

### Refresh token

- Opaque (stocké haché en BDD)
- Révoqué définitivement au signout
- Rotation à chaque appel `/refresh`

### Guards

| Guard | Rôle |
|---|---|
| `JwtAuthGuard` | Valide le Bearer token |
| `RolesGuard` | Vérifie que le rôle correspond au(x) rôle(s) autorisé(s) |

### Format numéro de téléphone

Tous les numéros doivent respecter le format ivoirien :

```
^\+225(01|05|07)\d{8}$
```

Exemples valides : `+22501XXXXXXXX`, `+22505XXXXXXXX`, `+22507XXXXXXXX`

---

## 4. Enums & types

### `UserRole`

| Valeur | Description |
|---|---|
| `SUPER_ADMIN` | Administrateur global |
| `SCHOOL_ADMIN` | Administrateur d'école |
| `VENDOR` | Vendeur / restaurateur |
| `PARENT` | Parent / tuteur |
| `STUDENT` | Élève |

### `CardStatus`

| Valeur | Description |
|---|---|
| `UNASSIGNED` | Non liée à un élève |
| `ACTIVE` | Active, utilisable |
| `SUSPENDED` | Suspendue temporairement |
| `BLOCKED` | Bloquée après 3 tentatives de PIN échouées |

### `SchoolStatus`

| Valeur | Description |
|---|---|
| `ACTIVE` | École opérationnelle |
| `SUSPENDED` | École suspendue |

### `VendorStatus`

| Valeur | Description |
|---|---|
| `PENDING` | En attente d'approbation |
| `ACTIVE` | Approuvé et actif |
| `SUSPENDED` | Suspendu |
| `REJECTED` | Rejeté |

### `OrderStatus`

| Valeur | Description |
|---|---|
| `PENDING` | En attente de validation vendeur |
| `VALIDATED` | Validée par le vendeur, en attente d'encaissement |
| `COMPLETED` | Encaissée / livrée (état terminal positif) |
| `CANCELLED` | Annulée |
| `EXPIRED` | Expirée (à 23:59:59 du jour prévu) |

### `PaymentMethod`

| Valeur | Description |
|---|---|
| `WALLET` | Paiement depuis le portefeuille élève |
| `CASH` | Paiement en espèces au vendeur |

### `ItemStatus`

| Valeur | Description |
|---|---|
| `ACTIVE` | Disponible à la commande |
| `INACTIVE` | Indisponible |

### `TransactionType`

| Valeur | Description |
|---|---|
| `CREDIT` | Crédit (recharge) |
| `DEBIT` | Débit (validation commande) |
| `RESERVE` | Réservation (création commande WALLET) |
| `RELEASE` | Libération (annulation commande WALLET) |

### `PaymentStatus`

| Valeur | Description |
|---|---|
| `PENDING` | En attente de confirmation Paystack |
| `SUCCESS` | Paiement reçu |
| `FAILED` | Paiement échoué |

### `WithdrawalStatus`

| Valeur | Description |
|---|---|
| `PENDING` | En attente de traitement |
| `IN_PROGRESS` | En cours de traitement |
| `SUCCESS` | Effectué |
| `FAILED` | Échoué (remboursé) |

### `NotificationType`

| Valeur | Description |
|---|---|
| `ORDER_VALIDATED` | Commande validée par le vendeur |
| `ORDER_COMPLETED` | Commande encaissée / livrée |
| `ORDER_CANCELLED` | Commande annulée |
| `ORDER_EXPIRED` | Commande expirée |
| `VENDOR_SUMMARY` | Résumé journalier vendeur |
| `VENDOR_APPROVED` | Compte vendeur approuvé |
| `VENDOR_REJECTED` | Compte vendeur rejeté |
| `TOPUP_SUCCESS` | Recharge wallet réussie |
| `TOPUP_FAILED` | Recharge wallet échouée |
| `WITHDRAWAL_SUCCESS` | Retrait effectué |
| `WITHDRAWAL_FAILED` | Retrait échoué |

### `Currency`

| Valeur | Description |
|---|---|
| `XOF` | Franc CFA UEMOA (défaut) |
| `GHS` | Cedi ghanéen |
| `NGN` | Naira nigérian |
| `XAF` | Franc CFA CEMAC |

### `OtpType`

| Valeur | Description |
|---|---|
| `PHONE_VERIFICATION` | Vérification de numéro |
| `PASSWORD_RESET` | Réinitialisation de mot de passe |

### `Gender`

| Valeur |
|---|
| `MALE` |
| `FEMALE` |

---

## 5. Codes d'erreur HTTP

| Code | Signification |
|---|---|
| `200` | Succès GET / PUT |
| `201` | Ressource créée |
| `204` | Suppression réussie (pas de corps) |
| `400` | Validation échouée ou erreur métier |
| `401` | Credentials invalides ou token expiré |
| `403` | Permissions insuffisantes |
| `404` | Ressource introuvable |
| `409` | Conflit d'état (doublon, transition impossible) |

---

## 6. Modules & endpoints

### 6.1 Auth

**Base route** : `/api/v1/auth`  
**Authentification** : Publique sauf `change-password` et `fcm-token`

---

#### `POST /auth/scan-card`

Scanne une carte et retourne son statut et les profils liés.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `code` | `string` | oui | Code de la carte (ex: `GF-2024-001`) |

**Réponse 200**

```json
{
  "data": {
    "status": "UNASSIGNED",
    "student": false,
    "requiresStudentInfo": true,
    "parents": [false, false]
  },
  "statusCode": 200
}
```

| Champ | Type | Description |
|---|---|---|
| `status` | `CardStatus` | Statut actuel de la carte |
| `student` | `boolean` | `true` si un compte élève existe déjà |
| `requiresStudentInfo` | `boolean` | `true` quand l'élève n'a pas encore de compte propre |
| `parents` | `[boolean, boolean]` | Slots parent 1 et parent 2 (true = occupé) |

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Card not found` |
| `400` | Validation failed |

---

#### `POST /auth/signup/parent`

Crée un compte parent et lie l'élève via la carte.

**Auth** : Aucune  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `cardCode` | `string` | oui | Code de la carte |
| `firstName` | `string` | oui | |
| `lastName` | `string` | oui | |
| `phone` | `string` | oui | Format CI `+225(01\|05\|07)XXXXXXXX` |
| `password` | `string` | oui | Min 8 caractères |
| `studentFirstName` | `string` | conditionnel | Requis si carte `UNASSIGNED` (premier parent) |
| `studentLastName` | `string` | conditionnel | Requis si carte `UNASSIGNED` (premier parent) |
| `studentClass` | `string` | non | Classe de l'élève (ex: `6ème A`) |
| `pin` | `string` | conditionnel | 4 chiffres — requis si carte `UNASSIGNED` |

**Réponse 201**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a1b2c3d4e5f6..."
  },
  "statusCode": 201
}
```

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `400` | `studentFirstName and studentLastName are required for the first parent registration` |
| `404` | `Card not found` |
| `409` | `Card is not active` |
| `409` | `Phone already exists` |
| `409` | `Student already has two parents` |
| `409` | `Parent already linked to this student` |

**Edge cases**

- Si la carte est `ACTIVE` (élève déjà créé par un 1er parent), `studentFirstName`/`studentLastName` sont ignorés.
- Le PIN n'est requis que pour la première liaison (carte `UNASSIGNED`). Le 2e parent hérite du PIN déjà défini.
- La carte passe de `UNASSIGNED` → `ACTIVE` lors du premier signup parent.

---

#### `POST /auth/signup/student`

Crée un compte élève via une carte non assignée.

**Auth** : Aucune  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `cardCode` | `string` | oui | |
| `firstName` | `string` | oui | |
| `lastName` | `string` | oui | |
| `phone` | `string` | oui | Format CI |
| `password` | `string` | oui | Min 8 caractères |
| `class` | `string` | non | Classe de l'élève |
| `pin` | `string` | non | 4 chiffres — définit le PIN de la carte |

**Réponse 201** : Identique à `signup/parent`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `Card not found` |
| `409` | `Card is not available for registration` (carte pas `UNASSIGNED`) |
| `409` | `Phone already exists` |

---

#### `POST /auth/signup/vendor`

Crée un compte vendeur pour une école.

**Auth** : Aucune  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | `string` | oui | |
| `lastName` | `string` | oui | |
| `phone` | `string` | oui | Format CI |
| `password` | `string` | oui | Min 8 caractères |
| `shopName` | `string` | oui | Nom du commerce |
| `schoolId` | `uuid` | oui | UUID de l'école |
| `waveNumber` | `string` | non | Numéro Wave pour les retraits |

**Réponse 201** : Identique à `signup/parent`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `School not found` |
| `409` | `Phone already exists` |

**Edge case** : Le vendeur créé a le statut `PENDING` — il doit être approuvé par un SUPER_ADMIN avant de pouvoir se connecter et accéder aux fonctionnalités.

---

#### `POST /auth/signin`

Connexion avec téléphone et mot de passe.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `phone` | `string` | oui | Format CI |
| `password` | `string` | oui | Min 8 caractères |

**Réponse 200** : Identique à `signup/parent`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `401` | `Invalid credentials` |

---

#### `POST /auth/refresh`

Rotation du refresh token — retourne une nouvelle paire de tokens.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis |
|---|---|---|
| `refreshToken` | `string` | oui |

**Réponse 200** : Identique à `signup/parent`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `401` | `Invalid or expired refresh token` |

**Edge case** : L'ancien refresh token est invalidé immédiatement après rotation.

---

#### `POST /auth/signout`

Déconnexion et révocation du refresh token.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis |
|---|---|---|
| `refreshToken` | `string` | oui |

**Réponse 200** : `{ "data": null, "statusCode": 200 }` (idempotent)

---

#### `POST /auth/forgot-password`

Génère un OTP de réinitialisation (6 chiffres).  
En environnement non-prod, l'OTP est retourné dans la réponse.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `phone` | `string` | oui | Format CI |

**Réponse 200**

```json
{
  "data": {
    "code": "482910"
  },
  "statusCode": 200
}
```

> En prod, le champ `code` n'est pas présent — l'OTP est envoyé par SMS.

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `User not found` |

---

#### `POST /auth/reset-password`

Réinitialise le mot de passe avec l'OTP reçu.

**Auth** : Aucune  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `phone` | `string` | oui | Format CI |
| `code` | `string` | oui | Exactement 6 chiffres |
| `newPassword` | `string` | oui | Min 8 caractères |

**Réponse 200** : `{ "data": null, "statusCode": 200 }`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `401` | `Invalid or expired OTP` |
| `404` | `User not found` |

---

#### `PUT /auth/change-password`

Change le mot de passe de l'utilisateur connecté.

**Auth** : Bearer token requis  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `currentPassword` | `string` | oui | |
| `newPassword` | `string` | oui | Min 8 caractères |

**Réponse 200** : `{ "data": null, "statusCode": 200 }`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `401` | `Current password is incorrect` |

---

#### `PUT /auth/fcm-token`

Enregistre ou efface le token FCM pour les push notifications.

**Auth** : Bearer token requis  
**HTTP** : 200

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `fcmToken` | `string \| null` | non | Token FCM Firebase ou `null` pour effacer |

**Réponse 200** : `{ "data": null, "statusCode": 200 }`

---

### 6.2 Cards

**Base route** : `/api/v1/cards`  
**Authentification** : Bearer token requis pour tous les endpoints

---

#### `POST /cards`

Génère un lot de cartes avec QR code pour une école.

**Rôles** : `SUPER_ADMIN`  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `schoolId` | `uuid` | oui | |
| `count` | `integer` | oui | 1 à 100 |

**Réponse 201**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "GF-2024-001",
      "status": "UNASSIGNED",
      "schoolId": "uuid",
      "studentId": null,
      "dailyLimit": 1000,
      "imageUrl": "https://cdn.example.com/cards/GF-2024-001.png",
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  ],
  "statusCode": 201
}
```

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `School not found` |

---

#### `GET /cards/:code`

Récupère les détails d'une carte par son code.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`  
**Params** : `code` (string, le code de la carte)

**Réponse 200** : Objet `CardResponseDto` (voir structure POST ci-dessus)

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Card not found` |

---

#### `PUT /cards/:code/suspend`

Suspend une carte active.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`  
**Params** : `code`

**Réponse 200** : Objet `CardResponseDto` avec `status: "SUSPENDED"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Card not found` |
| `409` | `Card can only be suspended when active` |

---

#### `PUT /cards/:code/activate`

Réactive une carte suspendue.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `STUDENT`  
**Params** : `code`

**Réponse 200** : Objet `CardResponseDto` avec `status: "ACTIVE"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Card not found` |
| `409` | `Card can only be activated when suspended` |

**Edge case** : Une carte `BLOCKED` ne peut pas être directement activée — il faut d'abord faire un `reset-pin`.

---

#### `PUT /cards/:code/daily-limit`

Met à jour la limite journalière de dépenses.

**Rôles** : `PARENT`, `STUDENT`  
**Params** : `code`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `dailyLimit` | `integer` | oui | 100 à 100 000 |

**Réponse 200** : Objet `CardResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `403` | `Only the linked parent can update the daily limit` |
| `404` | `Card not found` |

**Edge case** : Seul le parent ou l'élève directement lié à la carte peut modifier la limite. Un admin ne peut pas.

---

#### `POST /cards/:code/verify-pin`

Vérifie le PIN de la carte.  
Incrémente le compteur d'échecs et bloque la carte après 3 échecs.

**Rôles** : `VENDOR`  
**HTTP** : 200  
**Params** : `code`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `pin` | `string` | oui | Exactement 4 chiffres |

**Réponse 200** : Objet `CardResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `400` | `Card PIN is not set` |
| `401` | `Invalid PIN` |
| `403` | `Card is blocked after 3 failed PIN attempts` |
| `409` | `Card is not active` |
| `404` | `Card not found` |

**Edge case** : Après 3 échecs consécutifs, la carte passe en `BLOCKED`. L'utilisateur doit faire un `reset-pin` pour la débloquer.

---

#### `PUT /cards/:code/reset-pin`

Réinitialise le PIN de la carte après vérification du mot de passe.  
Débloque la carte si elle était `BLOCKED`.

**Rôles** : `STUDENT`, `PARENT`  
**Params** : `code`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `password` | `string` | oui | Mot de passe du compte |
| `newPin` | `string` | oui | Exactement 4 chiffres |

**Réponse 200** : Objet `CardResponseDto` (statut repassé à `ACTIVE` si `BLOCKED`)

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `401` | `Invalid password` |
| `403` | Not the card owner |
| `404` | `Card not found` |

---

### 6.3 Schools

**Base route** : `/api/v1/schools`

---

#### `POST /schools`

Crée une nouvelle école.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | `string` | oui | |
| `sigle` | `string` | oui | `[A-Z0-9-]{2,10}` — unique |
| `address` | `string` | oui | 5 à 255 caractères |

**Réponse 201**

```json
{
  "data": {
    "id": "uuid",
    "name": "Lycée Moderne de Cocody",
    "sigle": "LMC",
    "address": "12 Rue des Jardins, Cocody",
    "status": "ACTIVE",
    "createdAt": "2026-06-20T10:00:00.000Z"
  },
  "statusCode": 201
}
```

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `409` | `School sigle already exists` |

---

#### `GET /schools`

Liste toutes les écoles.

**Auth** : Aucune — endpoint public  
**Rôles** : Tous (y compris non authentifié)

**Réponse 200** : Tableau de `SchoolResponseDto`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Lycée Moderne de Cocody",
      "sigle": "LMC",
      "address": "12 Rue des Jardins, Cocody",
      "status": "ACTIVE",
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  ],
  "statusCode": 200
}
```

> Cet endpoint est public pour permettre la sélection d'école lors du signup vendeur sans compte préalable.

---

#### `GET /schools/:id`

Récupère les détails d'une école.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Params** : `id` (uuid)

**Réponse 200** : `SchoolResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Not your school (SCHOOL_ADMIN accède uniquement à son école) |
| `404` | `School not found` |

---

#### `PUT /schools/:id`

Met à jour le nom ou l'adresse d'une école.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | `string` | non | |
| `address` | `string` | non | 5 à 255 caractères |

**Réponse 200** : `SchoolResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `School not found` |

---

#### `PUT /schools/:id/suspend`

Suspend une école active.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `SchoolResponseDto` avec `status: "SUSPENDED"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `School not found` |
| `409` | `School can only be suspended when active` |

---

#### `PUT /schools/:id/activate`

Réactive une école suspendue.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `SchoolResponseDto` avec `status: "ACTIVE"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `School not found` |
| `409` | `School can only be activated when suspended` |

---

#### `POST /schools/:id/admin`

Crée un administrateur pour une école.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`  
**HTTP** : 201  
**Params** : `id`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | `string` | oui | |
| `lastName` | `string` | oui | |
| `phone` | `string` | oui | Format CI |
| `password` | `string` | oui | Min 8 caractères |

**Réponse 201**

```json
{
  "data": {
    "id": "uuid",
    "firstName": "Kouamé",
    "lastName": "Assi",
    "phone": "+22507000000001",
    "role": "SCHOOL_ADMIN",
    "schoolId": "uuid",
    "createdAt": "2026-06-20T10:00:00.000Z"
  },
  "statusCode": 201
}
```

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `404` | `School not found` |
| `409` | `Phone already exists` |

---

#### `GET /schools/:id/vendors`

Liste les vendeurs d'une école avec pagination.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT`, `PARENT`  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `SchoolVendorResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Not your school (SCHOOL_ADMIN, STUDENT, PARENT) |
| `404` | `School not found` |

---

#### `GET /schools/:id/students`

Liste les élèves d'une école avec pagination.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `SchoolStudentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Not your school |
| `404` | `School not found` |

---

#### `GET /schools/:id/parents`

Liste les parents d'une école avec pagination.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `SchoolParentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Not your school |
| `404` | `School not found` |

---

#### `GET /schools/:id/transactions`

Liste les transactions d'une école avec statistiques.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Params** : `id`

**Query params**

| Param | Type | Requis | Description |
|---|---|---|---|
| `page` | `integer` | non | Défaut : 1 |
| `limit` | `integer` | non | Défaut : 20, max 100 |
| `from` | `ISO8601` | non | Date de début (ex: `2026-01-01T00:00:00Z`) |
| `to` | `ISO8601` | non | Date de fin (ex: `2026-12-31T23:59:59Z`) |

**Réponse 200** : Objet paginé de `SchoolTransactionResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Not your school |
| `404` | `School not found` |

---

### 6.4 Students

**Base route** : `/api/v1/students`  
**Authentification** : Bearer token requis

---

#### `GET /students`

Liste les élèves avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `StudentResponseDto`

> `SCHOOL_ADMIN` ne voit que les élèves de son école.

---

#### `GET /students/me`

Profil de l'élève connecté.

**Rôles** : `STUDENT`

**Réponse 200**

```json
{
  "data": {
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
      "code": "GF-2024-001"
    }
  },
  "statusCode": 200
}
```

> `card` peut être `null` si aucune carte n'est liée.

---

#### `PUT /students/me`

Met à jour le profil de l'élève connecté.

**Rôles** : `STUDENT`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | `string` | non | Non vide |
| `lastName` | `string` | non | Non vide |
| `class` | `string` | non | Non vide |

**Réponse 200** : `StudentResponseDto` mis à jour

---

#### `GET /students/:id`

Récupère un élève par son id.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (soi-même uniquement)  
**Params** : `id` (uuid)

**Réponse 200** : `StudentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Student not found` |

---

#### `PUT /students/:id`

Met à jour le profil d'un élève.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (élèves liés uniquement)  
**Params** : `id`

**Body** : Identique à `PUT /students/me`

**Réponse 200** : `StudentResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Student not found` |

---

#### `GET /students/:id/parents`

Liste les parents d'un élève.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (soi-même)  
**Params** : `id`

**Réponse 200** : Tableau de `StudentParentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Student not found` |

---

#### `GET /students/:id/orders`

Liste les commandes d'un élève avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT` (soi-même)  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `StudentOrderResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Student not found` |

---

#### `GET /students/:id/transactions`

Liste les transactions du wallet d'un élève avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (élèves liés), `STUDENT` (soi-même)  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `StudentTransactionResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Student not found` |

---

### 6.5 Parents

**Base route** : `/api/v1/parents`  
**Authentification** : Bearer token requis

---

#### `GET /parents`

Liste les parents avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `ParentResponseDto`

> `SCHOOL_ADMIN` ne voit que les parents de son école.

---

#### `GET /parents/me`

Profil du parent connecté.

**Rôles** : `PARENT`

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "firstName": "Aminata",
      "lastName": "Koné",
      "phone": "+22501000000"
    }
  },
  "statusCode": 200
}
```

---

#### `PUT /parents/me`

Met à jour le profil du parent connecté.

**Rôles** : `PARENT`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | `string` | non | Non vide |
| `lastName` | `string` | non | Non vide |
| `phone` | `string` | non | Format CI |

**Réponse 200** : `ParentResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `409` | `Phone already exists` |

---

#### `POST /parents/me/students`

Lie ou crée un élève pour le parent connecté via une carte.

**Rôles** : `PARENT`  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `cardCode` | `string` | oui | Code de la carte |
| `pin` | `string` | conditionnel | 4 chiffres — requis si carte `UNASSIGNED` |
| `firstName` | `string` | conditionnel | Requis si nouvel élève à créer |
| `lastName` | `string` | conditionnel | Requis si nouvel élève à créer |
| `class` | `string` | non | Classe de l'élève |

**Réponse 201** : `ParentResponseDto` avec l'élève ajouté

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `403` | Access denied |
| `404` | `Card not found` |
| `409` | `Parent already linked to this student` |
| `409` | `Student already has two parents` |
| `409` | `Parent already has two linked students` |

**Edge cases**

- Un parent peut lier au maximum 2 élèves.
- Un élève peut avoir au maximum 2 parents.
- Si la carte est `ACTIVE` (élève déjà créé), le PIN est vérifié contre celui existant.

---

#### `GET /parents/:id`

Récupère un parent par son id.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (soi-même)  
**Params** : `id` (uuid)

**Réponse 200** : `ParentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Parent not found` |

---

#### `GET /parents/:id/students`

Liste les élèves d'un parent.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (soi-même)  
**Params** : `id`

**Réponse 200** : Tableau de `StudentResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Parent not found` |

---

### 6.6 Vendors

**Base route** : `/api/v1/vendors`  
**Authentification** : Bearer token requis

---

#### `GET /vendors`

Liste les vendeurs avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `VendorResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "shopName": "Maquis Chez Konan",
        "waveNumber": "+2250700000000",
        "openingTime": "08:00",
        "closingTime": "17:00",
        "status": "ACTIVE",
        "schoolId": "uuid",
        "createdAt": "2026-06-20T10:00:00.000Z",
        "user": {
          "id": "uuid",
          "firstName": "Konan",
          "lastName": "Brou",
          "phone": "+22501000000"
        }
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

---

#### `GET /vendors/:id`

Récupère un vendeur par son id.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id` (uuid)

**Réponse 200** : `VendorResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `PUT /vendors/:id`

Met à jour les informations d'un vendeur.

**Rôles** : `SUPER_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `shopName` | `string` | non | Min 2 caractères |
| `waveNumber` | `string` | non | |
| `openingTime` | `string` | non | Format `HH:mm` (ex: `08:00`) |
| `closingTime` | `string` | non | Format `HH:mm` (ex: `17:00`) |

**Réponse 200** : `VendorResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `DELETE /vendors/:id`

Supprime un vendeur.

**Rôles** : `SUPER_ADMIN`  
**HTTP** : 204  
**Params** : `id`

**Réponse 204** : Pas de corps

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Vendor not found` |

---

#### `POST /vendors/:id/approve`

Approuve un vendeur en attente.

**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `VendorResponseDto` avec `status: "ACTIVE"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Vendor not found` |
| `409` | `Vendor can only be approved when pending` |

---

#### `POST /vendors/:id/reject`

Rejette un vendeur en attente.

**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `VendorResponseDto` avec `status: "REJECTED"`

**Erreurs**

| Code | Message |
|---|---|
| `404` | `Vendor not found` |
| `409` | `Vendor can only be rejected when pending` |

---

#### `GET /vendors/:id/items`

Liste les articles actifs d'un vendeur.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`, `STUDENT`, `PARENT`  
**Params** : `id`

**Réponse 200** : Tableau de `ItemResponseDto` (items `ACTIVE` uniquement)

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `GET /vendors/:id/orders`

Liste les commandes d'un vendeur avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `VendorOrderResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "status": "VALIDATED",
        "paymentMethod": "WALLET",
        "totalAmount": 3500,
        "shortCode": "2841",
        "scheduledFor": "2026-06-23",
        "expiresAt": "2026-06-23T23:59:59.999Z",
        "createdAt": "2026-06-23T08:00:00.000Z",
        "items": [
          { "name": "Riz sauce", "quantity": 2, "unitPrice": 1500 },
          { "name": "Eau minérale", "quantity": 1, "unitPrice": 500 }
        ],
        "student": {
          "id": "uuid",
          "class": "6ème A",
          "user": { "id": "uuid", "firstName": "Kouassi", "lastName": "Yao" }
        }
      }
    ],
    "meta": { "total": 6, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `GET /vendors/:id/withdrawals`

Liste les retraits d'un vendeur avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `VendorWithdrawalResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `GET /vendors/:id/balance`

Récupère le solde du wallet vendeur.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id`

**Réponse 200**

```json
{
  "data": {
    "vendorId": "uuid",
    "balance": 50000,
    "currency": "XOF",
    "updatedAt": "2026-06-20T10:00:00.000Z"
  },
  "statusCode": 200
}
```

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |
| `404` | `Vendor wallet not found` |

---

#### `GET /vendors/:id/stats`

Retourne les KPIs journaliers du vendeur pour le dashboard.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR` (soi-même)  
**Params** : `id`

**Réponse 200**

```json
{
  "data": {
    "todayOrderCount": 6,
    "todayRevenue": 6750,
    "cashToCollect": 1850
  },
  "statusCode": 200
}
```

| Champ | Description |
|---|---|
| `todayOrderCount` | Nombre de commandes prévues aujourd'hui (hors `CANCELLED` et `EXPIRED`) |
| `todayRevenue` | Somme des `totalAmount` des commandes `COMPLETED` aujourd'hui |
| `cashToCollect` | Somme des `totalAmount` des commandes `VALIDATED` avec `paymentMethod = CASH` aujourd'hui |

> "Aujourd'hui" est déterminé par `scheduledFor = date du jour` en UTC.

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

### 6.7 Items

**Base route** : `/api/v1/items`  
**Authentification** : Bearer token requis

---

#### `GET /items`

Liste les articles avec pagination.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `ItemResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "vendorId": "uuid",
        "name": "Riz sauce",
        "price": 1500,
        "description": "Riz blanc avec sauce graine",
        "imageUrl": "https://cdn.example.com/items/riz-sauce.jpg",
        "status": "ACTIVE",
        "createdAt": "2026-06-20T10:00:00.000Z"
      }
    ],
    "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

> `VENDOR` ne voit que ses propres articles.

---

#### `GET /items/:id`

Récupère un article par son id.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`  
**Params** : `id` (uuid)

**Réponse 200** : `ItemResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Item not found` |

---

#### `POST /items/vendor/:vendorId`

Crée un article pour un vendeur.

**Rôles** : `SUPER_ADMIN`, `VENDOR` (soi-même)  
**Params** : `vendorId` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | `string` | oui | Non vide |
| `price` | `integer` | oui | ≥ 1 |
| `description` | `string` | non | |

**Réponse 201** : `ItemResponseDto` créé (status: `ACTIVE` par défaut)

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Vendor not found` |

---

#### `PUT /items/:id`

Met à jour un article.

**Rôles** : `SUPER_ADMIN`, `VENDOR` (propriétaire)  
**Params** : `id`

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | `string` | non | |
| `price` | `integer` | non | ≥ 1 |
| `description` | `string` | non | |
| `status` | `ItemStatus` | non | `ACTIVE` ou `INACTIVE` |

**Réponse 200** : `ItemResponseDto` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Item not found` |

---

#### `PUT /items/:id/image`

Uploade ou remplace l'image d'un article.

**Rôles** : `SUPER_ADMIN`, `VENDOR` (propriétaire)  
**Params** : `id`  
**Content-Type** : `multipart/form-data`

**Body**

| Champ | Type | Requis |
|---|---|---|
| `file` | `binary` | oui |

**Réponse 200** : `ItemResponseDto` avec `imageUrl` mis à jour

**Erreurs**

| Code | Message |
|---|---|
| `400` | File validation failed (type/taille invalide) |
| `403` | Access denied |
| `404` | `Item not found` |

---

#### `DELETE /items/:id`

Supprime un article.

**Rôles** : `SUPER_ADMIN`, `VENDOR` (propriétaire)  
**HTTP** : 204  
**Params** : `id`

**Réponse 204** : Pas de corps

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Item not found` |

---

### 6.8 Orders

**Base route** : `/api/v1/orders`  
**Authentification** : Bearer token requis

---

#### `GET /orders`

Liste les commandes filtrées selon le rôle.

**Rôles** : Tous  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `OrderResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "studentId": "uuid",
        "vendorId": "uuid",
        "status": "PENDING",
        "paymentMethod": "WALLET",
        "totalAmount": 3500,
        "shortCode": "2841",
        "expiresAt": "2026-06-23T23:59:59.999Z",
        "scheduledFor": "2026-06-23",
        "createdAt": "2026-06-23T08:00:00.000Z"
      }
    ],
    "meta": { "total": 8, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

**Filtrage par rôle**

| Rôle | Commandes visibles |
|---|---|
| `SUPER_ADMIN` | Toutes |
| `SCHOOL_ADMIN` | Commandes des élèves de son école |
| `VENDOR` | Ses propres commandes |
| `PARENT` | Commandes de ses élèves liés |
| `STUDENT` | Ses propres commandes |

---

#### `GET /orders/by-card?cardCode=XXX`

Retrouve la commande `VALIDATED` d'un élève chez le vendeur appelant à partir du code de sa carte GF (flux encaissement par scan).

**Rôles** : `VENDOR` uniquement  
**Query params**

| Param | Type | Requis | Description |
|---|---|---|---|
| `cardCode` | `string` | oui | Code de la carte GF de l'élève |

**Réponse 200** : `OrderDetailResponseDto` (voir structure ci-dessous)

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Card not found` |
| `404` | `Student not found` |
| `404` | `Order not found` (aucune commande `VALIDATED` pour cet élève chez ce vendeur) |

> Cet endpoint doit être appelé **après** `POST /auth/scan-card` dans le flux cashin. Il ne retourne que la commande `VALIDATED` la plus récente — si l'élève n'a pas de commande en attente chez ce vendeur, retourne 404.

---

#### `GET /orders/by-code?code=XXXX`

Retrouve une commande `VALIDATED` par son code court à 4 chiffres (flux encaissement par saisie manuelle).

**Rôles** : `VENDOR` uniquement  
**Query params**

| Param | Type | Requis | Description |
|---|---|---|---|
| `code` | `string` | oui | Code court à 4 chiffres dicté par l'élève |

**Réponse 200** : `OrderDetailResponseDto`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Order not found` (aucune commande `VALIDATED` avec ce code chez ce vendeur) |

> Le code est scopé au vendeur appelant — un vendeur ne peut pas retrouver les commandes d'un autre vendeur par le code court.

---

#### `GET /orders/:id`

Récupère les détails d'une commande avec ses articles.

**Rôles** : Tous (avec contrôle d'accès identique à `GET /orders`)  
**Params** : `id` (uuid)

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "vendorId": "uuid",
    "status": "VALIDATED",
    "paymentMethod": "WALLET",
    "totalAmount": 3500,
    "shortCode": "2841",
    "expiresAt": "2026-06-23T23:59:59.999Z",
    "createdAt": "2026-06-23T08:00:00.000Z",
    "vendor": {
      "id": "uuid",
      "shopName": "Maquis Chez Konan",
      "waveNumber": "+2250700000000"
    },
    "student": {
      "user": {
        "firstName": "Kouassi",
        "lastName": "Yao"
      }
    },
    "items": [
      {
        "id": "uuid",
        "itemId": "uuid",
        "quantity": 2,
        "unitPrice": 1500,
        "item": { "name": "Riz sauce" }
      },
      {
        "id": "uuid",
        "itemId": "uuid",
        "quantity": 1,
        "unitPrice": 500,
        "item": { "name": "Eau minérale" }
      }
    ]
  },
  "statusCode": 200
}
```

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Order not found` |

---

#### `POST /orders/vendor/:vendorId`

Crée une commande pour un élève.

**Rôles** : `VENDOR`, `SUPER_ADMIN`, `PARENT` (élèves liés), `STUDENT` (soi-même)  
**HTTP** : 201  
**Params** : `vendorId` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `studentId` | `uuid` | oui | |
| `items` | `CreateOrderItemDto[]` | oui | Min 1 item |
| `items[].itemId` | `uuid` | oui | Doit appartenir au vendeur et être `ACTIVE` |
| `items[].quantity` | `integer` | oui | ≥ 1 |
| `paymentMethod` | `PaymentMethod` | non | Défaut : `WALLET` |
| `scheduledFor` | `string` | non | Format `YYYY-MM-DD`, lundi–vendredi, ≥ aujourd'hui. Défaut : aujourd'hui (ou lundi si weekend) |

**Réponse 201** : `OrderResponseDto` avec `shortCode` généré

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `400` | `One or more items are invalid or unavailable` |
| `400` | `Insufficient wallet balance` (WALLET uniquement) |
| `400` | `Daily spending limit exceeded` (WALLET uniquement) |
| `400` | `scheduledFor must be a weekday (Mon–Fri) and cannot be in the past` |
| `403` | Access denied |
| `404` | `Vendor not found` |
| `404` | `Student not found` |
| `404` | `Wallet not found` |

**Side effects**

- Un `shortCode` à 4 chiffres (1000–9999) est généré, unique par vendeur + jour (`scheduledFor`).
- Si `paymentMethod = WALLET` : `wallet.reserved` est incrémenté du montant total et une transaction `RESERVE` est créée.
- Un event WebSocket `order.created` est émis aux sockets du vendeur.

**Edge cases détaillés**

- `scheduledFor` doit être lundi–vendredi (0 = dimanche, 6 = samedi rejetés). Si omis et qu'on est samedi, la date par défaut est le lundi suivant ; si on est dimanche, c'est le lendemain.
- Le `totalAmount` est calculé côté serveur à partir des prix des items en BDD — les prix envoyés côté client sont ignorés.
- La vérification de la limite journalière cumule les montants des commandes `PENDING` et `VALIDATED` pour le même `scheduledFor`.
- Si la carte est `SUSPENDED` ou `BLOCKED`, la création de commande `WALLET` est rejetée.
- Si `paymentMethod = CASH`, aucune vérification de solde ou de limite journalière n'est effectuée.

---

#### `PUT /orders/:id/validate`

Valide une commande en attente et crédite le wallet vendeur.

**Rôles** : `VENDOR` (vendeur de la commande), `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `OrderResponseDto` avec `status: "VALIDATED"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Order is not in pending status` |
| `403` | Access denied |
| `404` | `Order not found` |
| `404` | `Wallet not found` |

**Side effects (dans une transaction DB atomique)**

- Si `paymentMethod = WALLET` :
  - `wallet.balance` décrédité du montant total
  - `wallet.reserved` décrémenté du montant total
  - Transaction `DEBIT` créée sur le wallet élève
  - `vendorWallet.balance` crédité du montant total (ou wallet vendeur créé si inexistant)
- Events WebSocket `order.updated` émis aux userId de l'élève et de ses parents
- Notifications `ORDER_VALIDATED` créées pour l'élève et ses parents

---

#### `PUT /orders/:id/complete`

Confirme la livraison / encaissement d'une commande validée. État terminal positif du flux commande.

**Rôles** : `VENDOR` (vendeur de la commande), `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `OrderResponseDto` avec `status: "COMPLETED"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Order is not in validated status` |
| `403` | Access denied |
| `404` | `Order not found` |

**Side effects**

- Le statut `COMPLETED` est écrit dans une transaction DB.
- Events WebSocket `order.updated` émis aux userId de l'élève et de ses parents.
- Notifications `ORDER_COMPLETED` créées pour l'élève et ses parents.

> Le flux cashin typique : scan carte ou saisie code → `GET /orders/by-card` ou `GET /orders/by-code` → `PUT /orders/:id/complete`.

---

#### `PUT /orders/:id/cancel`

Annule une commande en attente et libère la réservation wallet.

**Rôles** : Tous (avec contrôle d'accès)  
**Params** : `id`

**Réponse 200** : `OrderResponseDto` avec `status: "CANCELLED"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Order is not in pending status` |
| `403` | Access denied |
| `404` | `Order not found` |
| `404` | `Wallet not found` |

**Side effects (dans une transaction DB atomique)**

- Si `paymentMethod = WALLET` :
  - `wallet.reserved` décrémenté du montant total
  - Transaction `RELEASE` créée sur le wallet élève
- Events WebSocket `order.updated` émis aux userId concernés
- Notifications `ORDER_CANCELLED` créées pour l'élève et ses parents

**Edge case** : Seules les commandes `PENDING` sont annulables. Une commande `VALIDATED` ou `EXPIRED` ne peut pas être annulée.

---

### 6.9 Wallets

**Base route** : `/api/v1/wallets`  
**Authentification** : Bearer token requis

---

#### `GET /wallets/student/:studentId`

Récupère le wallet d'un élève.

**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (élèves liés), `STUDENT` (soi-même)  
**Params** : `studentId` (uuid)

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "balance": 100000,
    "reserved": 3500,
    "currency": "XOF",
    "spentToday": 7000
  },
  "statusCode": 200
}
```

| Champ | Description |
|---|---|
| `balance` | Solde total (inclut le montant réservé) |
| `reserved` | Montant bloqué par des commandes `PENDING` |
| `spentToday` | Montant dépensé aujourd'hui (transactions `DEBIT`) |

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied |
| `404` | `Wallet not found` |

---

### 6.10 Payments

**Base route** : `/api/v1/payments`

---

#### `GET /payments`

Liste les paiements avec pagination.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `SCHOOL_ADMIN`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `PaymentResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "walletId": "uuid",
        "paystackRef": "ref_1234567890",
        "amount": 50000,
        "currency": "XOF",
        "status": "SUCCESS",
        "initiatedBy": "uuid",
        "createdAt": "2026-06-20T10:00:00.000Z"
      }
    ],
    "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

---

#### `POST /payments/initiate`

Initie une recharge du wallet via Paystack.

**Auth** : Bearer token requis  
**Rôles** : `SUPER_ADMIN`, `PARENT`, `STUDENT`  
**HTTP** : 201

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `studentId` | `uuid` | oui | |
| `amount` | `integer` | oui | ≥ 100 |

**Réponse 201**

```json
{
  "data": {
    "paymentId": "uuid",
    "authorizationUrl": "https://checkout.paystack.com/pay/xxxxx",
    "reference": "ref_1234567890"
  },
  "statusCode": 201
}
```

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `400` | `Payment initiation failed` (erreur Paystack) |
| `403` | Access denied |
| `404` | `Student not found` |

**Flow complet**

1. Le client appelle `POST /payments/initiate`
2. L'API crée un paiement en BDD (status: `PENDING`) et appelle Paystack
3. Le client redirige l'utilisateur vers `authorizationUrl`
4. Paystack appelle `POST /payments/webhook` après paiement
5. Le webhook crédite le wallet et met à jour le statut

---

#### `POST /payments/webhook`

Webhook Paystack — confirme le paiement et crédite le wallet.

**Auth** : Aucune (vérification HMAC)  
**HTTP** : 200  
**Header** : `x-paystack-signature` (HMAC-SHA512 du raw body)

**Body** : Payload Paystack (event object)

**Réponse 200** : `{ "data": null, "statusCode": 200 }`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Invalid webhook signature` |

**Side effects (si event = `charge.success`)**

- `payment.status` → `SUCCESS`
- `wallet.balance` crédité du montant
- Transaction `CREDIT` créée
- Notification `TOPUP_SUCCESS` créée pour l'utilisateur

**Edge cases**

- Si la signature HMAC est invalide → 400, aucune action.
- Si le paiement est déjà `SUCCESS` → idempotent, retourne 200.
- Le raw body brut est utilisé pour la vérification HMAC (activer `rawBody: true` dans NestFactory).

---

### 6.11 Withdrawals

**Base route** : `/api/v1/withdrawals`  
**Authentification** : Bearer token requis

---

#### `GET /withdrawals`

Liste les retraits.

**Rôles** : `VENDOR` (les siens), `SUPER_ADMIN` (tous)  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `WithdrawalResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "vendorId": "uuid",
        "amount": 100000,
        "currency": "XOF",
        "waveNumber": "+2250700000001",
        "paystackRef": null,
        "status": "PENDING",
        "createdAt": "2026-06-20T10:00:00.000Z"
      }
    ],
    "meta": { "total": 2, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

---

#### `POST /withdrawals/vendor/:vendorId`

Demande un retrait depuis le wallet vendeur.

**Rôles** : `VENDOR` (soi-même), `SUPER_ADMIN`  
**HTTP** : 201  
**Params** : `vendorId` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `amount` | `integer` | oui | ≥ 100 |
| `waveNumber` | `string` | oui | Min 3 caractères |

**Réponse 201** : `WithdrawalResponseDto` avec `status: "PENDING"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | Validation failed |
| `400` | `Insufficient vendor wallet balance` |
| `403` | Access denied |
| `404` | `Vendor not found` |
| `404` | `Vendor wallet not found` |

---

#### `PUT /withdrawals/:id/process`

Marque un retrait comme `IN_PROGRESS`.

**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Query params**

| Param | Type | Requis | Description |
|---|---|---|---|
| `paystackRef` | `string` | non | Référence Paystack du transfert |

**Réponse 200** : `WithdrawalResponseDto` avec `status: "IN_PROGRESS"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Withdrawal is not in pending status` |
| `403` | Access denied |
| `404` | `Withdrawal not found` |

---

#### `PUT /withdrawals/:id/complete`

Marque un retrait comme `SUCCESS`.

**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `WithdrawalResponseDto` avec `status: "SUCCESS"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Withdrawal is not in progress status` |
| `403` | Access denied |
| `404` | `Withdrawal not found` |

---

#### `PUT /withdrawals/:id/fail`

Marque un retrait comme `FAILED` et rembourse le wallet vendeur.

**Rôles** : `SUPER_ADMIN`  
**Params** : `id`

**Réponse 200** : `WithdrawalResponseDto` avec `status: "FAILED"`

**Erreurs**

| Code | Message |
|---|---|
| `400` | `Withdrawal is not in pending status` |
| `403` | Access denied |
| `404` | `Withdrawal not found` |

**Side effect** : Le montant est recrédité sur `vendorWallet.balance`.

---

### 6.12 Notifications

**Base route** : `/api/v1/notifications`  
**Authentification** : Bearer token requis

---

#### `GET /notifications`

Liste les notifications de l'utilisateur connecté.

**Rôles** : `PARENT`, `STUDENT`, `VENDOR`  
**Query params** : `page`, `limit`

**Réponse 200** : Objet paginé de `NotificationResponseDto`

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "userId": "uuid",
        "title": "Commande encaissée",
        "body": "Votre commande de 3500 FCFA a été encaissée.",
        "type": "ORDER_COMPLETED",
        "data": { "orderId": "uuid" },
        "isRead": false,
        "createdAt": "2026-06-23T10:00:00.000Z"
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
  },
  "statusCode": 200
}
```

---

#### `PUT /notifications/read-all`

Marque toutes les notifications de l'utilisateur comme lues.

**Rôles** : `PARENT`, `STUDENT`, `VENDOR`

**Réponse 200** : `{ "data": { "affected": 5 }, "statusCode": 200 }`

> **Important** : Cet endpoint doit être appelé **avant** `PUT /notifications/:id/read` dans le routing NestJS car `/read-all` serait interprété comme `/:id` si l'ordre n'est pas respecté.

---

#### `PUT /notifications/:id/read`

Marque une notification spécifique comme lue.

**Rôles** : `PARENT`, `STUDENT`, `VENDOR`  
**Params** : `id` (uuid)

**Réponse 200** : `NotificationResponseDto` avec `isRead: true`

**Erreurs**

| Code | Message |
|---|---|
| `403` | Access denied (notification d'un autre utilisateur) |
| `404` | `Notification not found` |

---

## 7. WebSocket (temps réel)

**URL** : `ws://localhost:3000` (même port que le serveur HTTP)  
**Implémentation** : Socket.IO via `@nestjs/websockets`

### Connexion

Le client doit passer le JWT dans l'auth handshake :

```js
// Option 1 — via auth (recommandé)
const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' }
});

// Option 2 — via header Authorization
const socket = io('http://localhost:3000', {
  extraHeaders: { Authorization: 'Bearer <accessToken>' }
});
```

Si le token est absent ou invalide → la connexion est immédiatement fermée (`client.disconnect()`).

### Rooms

À la connexion, le socket est automatiquement ajouté aux rooms correspondantes :

| Room | Membres |
|---|---|
| `user:<userId>` | Tous les utilisateurs authentifiés |
| `vendor:<vendorId>` | Vendeurs uniquement |

### Événements émis par le serveur

#### `order.created`

Émis dans la room `vendor:<vendorId>` quand une nouvelle commande est créée.

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "vendorId": "uuid",
  "status": "PENDING",
  "paymentMethod": "WALLET",
  "totalAmount": 3500,
  "shortCode": "2841",
  "expiresAt": "2026-06-23T23:59:59.999Z",
  "scheduledFor": "2026-06-23",
  "createdAt": "2026-06-23T08:00:00.000Z"
}
```

#### `order.updated`

Émis dans les rooms `user:<userId>` de l'élève et de ses parents quand une commande change d'état (`VALIDATED`, `COMPLETED` ou `CANCELLED`).

Payload : identique à `order.created` avec le statut mis à jour.

---

## 8. Règles métier & edge cases

### Transitions d'état des commandes

```
PENDING ──(validate)──► VALIDATED ──(complete)──► COMPLETED
PENDING ──(cancel)────► CANCELLED
PENDING ──(expiry)────► EXPIRED
VALIDATED ──(expiry)──► EXPIRED
```

- Seules les commandes `PENDING` peuvent être annulées ou expirées.
- Seules les commandes `VALIDATED` peuvent passer à `COMPLETED`.
- `COMPLETED`, `CANCELLED` et `EXPIRED` sont des états terminaux — aucune transition n'est possible depuis ces états.

### Transitions d'état des cartes

```
UNASSIGNED ──(signup parent/student)──► ACTIVE
ACTIVE     ──(suspend)────────────────► SUSPENDED
SUSPENDED  ──(activate)───────────────► ACTIVE
ACTIVE     ──(3 PIN échoués)──────────► BLOCKED
BLOCKED    ──(reset-pin)──────────────► ACTIVE
```

### Relations élève–parent

- Un élève peut avoir **0, 1 ou 2** parents.
- Un parent peut lier **0, 1 ou 2** élèves.
- La liaison est bidirectionnelle (table `student_parent`).

### Flux cashin vendeur (app vendeur)

Deux modes d'identification de la commande à encaisser :

**Mode scan carte**
1. Le vendeur scanne la carte GF de l'élève
2. `POST /auth/scan-card` → vérifie le statut de la carte
3. `GET /orders/by-card?cardCode=XXX` → retourne la commande `VALIDATED`
4. `PUT /orders/:id/complete` → encaisse et clôture

**Mode code court**
1. L'élève dicte son code à 4 chiffres
2. `GET /orders/by-code?code=XXXX` → retourne la commande `VALIDATED`
3. `PUT /orders/:id/complete` → encaisse et clôture

### Code court (`shortCode`)

- Généré automatiquement à la création de chaque commande.
- 4 chiffres décimaux (1000–9999), unique par combinaison `(vendorId, scheduledFor)`.
- Collision résolue par jusqu'à 10 tentatives de régénération aléatoire.
- Présent dans `OrderResponseDto`, `OrderDetailResponseDto` et `VendorOrderResponseDto`.
- Peut être `null` pour les commandes créées avant l'introduction de ce champ.

### Calcul des montants de commande

- `totalAmount` est calculé **côté serveur** : `SUM(item.price × quantity)`
- Les prix envoyés par le client sont ignorés
- Seuls les items `ACTIVE` appartenant au vendeur sont acceptés

### Limite journalière (`dailyLimit`)

- Par défaut : 1 000 XOF par carte
- Vérifiée uniquement pour les commandes `WALLET`
- Cumule les commandes `PENDING` + `VALIDATED` pour le même `scheduledFor`
- Modifiable par le parent ou l'élève lié à la carte (100 à 100 000)

### Solde disponible vs solde réservé

```
solde disponible = wallet.balance - wallet.reserved
```

- `balance` : argent réel disponible
- `reserved` : argent bloqué par des commandes `PENDING`
- La création d'une commande `WALLET` déplace `totalAmount` de `balance` vers `reserved`
- La validation décrédite `balance` et libère `reserved`
- L'annulation libère seulement `reserved`

### Expiration des commandes

- `expiresAt` = `scheduledFor` à `23:59:59.999`
- Les commandes `PENDING` ou `VALIDATED` toujours actives à cette date doivent passer en `EXPIRED` (tâche planifiée)
- Une commande expirée libère le montant réservé

### Webhook Paystack — sécurité

- Le serveur vérifie le header `x-paystack-signature` (HMAC-SHA512 du raw body avec la clé secrète Paystack)
- Le `rawBody: true` doit être activé dans `NestFactory.create`
- Idempotent : si le paiement est déjà `SUCCESS`, l'événement est ignoré silencieusement

### Notifications push vs WebSocket

- **WebSocket** : temps réel, uniquement si l'utilisateur est connecté
- **Push notification (FCM)** : envoyée en arrière-plan, indépendante de la connexion
- Les deux canaux sont utilisés en parallèle pour `ORDER_VALIDATED`, `ORDER_COMPLETED` et `ORDER_CANCELLED`
- Les side effects de notification n'utilisent jamais `await` dans le chemin critique (fire-and-forget avec `.catch(logger.error)`)

### Pagination

Tous les endpoints de liste supportent :

| Param | Défaut | Min | Max |
|---|---|---|---|
| `page` | 1 | 1 | — |
| `limit` | 20 | 1 | 100 |

### Filtrage par rôle — résumé

| Endpoint | SUPER_ADMIN | SCHOOL_ADMIN | VENDOR | PARENT | STUDENT |
|---|---|---|---|---|---|
| `GET /schools` | ✅ public | ✅ public | ✅ public | ✅ public | ✅ public |
| `GET /orders` | Tous | École | Ses commandes | Élèves liés | Soi-même |
| `GET /orders/by-card` | ✗ | ✗ | ✅ | ✗ | ✗ |
| `GET /orders/by-code` | ✗ | ✗ | ✅ | ✗ | ✗ |
| `GET /vendors/:id/stats` | ✅ | ✅ | Soi-même | ✗ | ✗ |
| `GET /withdrawals` | Tous | ✗ | Ses retraits | ✗ | ✗ |
| `GET /items` | Tous | Tous | Ses items | ✗ | ✗ |
| `GET /students` | Tous | École | ✗ | ✗ | ✗ |
| `GET /parents` | Tous | École | ✗ | ✗ | ✗ |
| `GET /vendors` | Tous | École | ✗ | ✗ | ✗ |
| `GET /payments` | Tous | École | ✗ | ✗ | ✗ |
