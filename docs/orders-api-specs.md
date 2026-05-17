# API Specs — Commandes (Orders)

Base URL: `/api/v1`  
Auth: Bearer token (JWT) requis sur tous les endpoints.

Toutes les réponses sont enveloppées dans :
```json
{ "data": <payload> }
```
Les réponses paginées ajoutent un objet `meta` :
```json
{
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

---

## 1. Créer une commande

### `POST /orders/vendor/:vendorId`

Crée une commande pour un student auprès d'un vendeur.

**Rôles autorisés:** `STUDENT` (commande pour soi-même), `PARENT` (commande pour son propre enfant), `VENDOR`, `SUPER_ADMIN`

**Path params**

| Param      | Type          | Description         |
|------------|---------------|---------------------|
| `vendorId` | string (UUID) | ID du vendeur cible |

**Body**

```json
{
  "studentId": "uuid",
  "items": [
    { "itemId": "uuid", "quantity": 2 },
    { "itemId": "uuid", "quantity": 1 }
  ],
  "paymentMethod": "WALLET"
}
```

| Champ              | Type                  | Requis | Description                                                              |
|--------------------|-----------------------|--------|--------------------------------------------------------------------------|
| `studentId`        | string (UUID)         | oui    | ID du student qui commande                                               |
| `items`            | array (min 1 élément) | oui    | Liste des articles commandés                                             |
| `items[].itemId`   | string (UUID)         | oui    | ID de l'article (doit être ACTIVE chez ce vendeur)                       |
| `items[].quantity` | number (int, min 1)   | oui    | Quantité                                                                 |
| `paymentMethod`    | enum                  | non    | `WALLET` (défaut) ou `CASH` — détermine comment le paiement est traité  |

**Modes de paiement**

| Mode     | Comportement à la création                                          | À la validation              | À l'annulation               |
|----------|---------------------------------------------------------------------|------------------------------|------------------------------|
| `WALLET` | Le montant total est **réservé** sur le wallet du student (`reserved` augmente, `balance` inchangé). Vérifie le solde disponible et la limite journalière. | Le montant est **débité** du wallet student et **crédité** sur le wallet vendeur. | La réservation est **libérée** (`reserved` diminue, `balance` inchangé). |
| `CASH`   | Aucune vérification de solde. Aucune transaction générée.           | Aucune transaction. Wallets inchangés. | Aucune transaction. Wallets inchangés. |

**Réponse 201**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "vendorId": "uuid",
    "status": "PENDING",
    "paymentMethod": "WALLET",
    "totalAmount": 1500,
    "expiresAt": "2026-05-15T10:15:00.000Z",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
}
```

> La commande expire automatiquement **15 minutes** après sa création si elle n'est pas validée par le vendeur.

**Erreurs**

| Code | Message                                         | Condition                                   |
|------|-------------------------------------------------|---------------------------------------------|
| 400  | Un ou plusieurs articles sont invalides ou inactifs | Article inexistant ou inactif              |
| 400  | Solde insuffisant sur le wallet du student      | Mode `WALLET` uniquement                    |
| 400  | Limite journalière dépassée                     | Mode `WALLET` uniquement                    |
| 400  | Validation failed                               | `paymentMethod` invalide (ex. `CHEQUE`)     |
| 403  | Accès refusé (student ou parent non lié)        |                                             |
| 404  | Vendeur introuvable                             |                                             |
| 404  | Student introuvable                             |                                             |
| 404  | Wallet introuvable                              | Mode `WALLET` uniquement                    |

---

## 2. Lister les commandes

### `GET /orders`

Retourne la liste paginée des commandes, filtrée automatiquement selon le rôle de l'appelant.

**Rôles autorisés:** `STUDENT`, `PARENT`, `VENDOR`, `SCHOOL_ADMIN`, `SUPER_ADMIN`

**Comportement par rôle**

| Rôle           | Commandes retournées                              |
|----------------|---------------------------------------------------|
| `STUDENT`      | Uniquement ses propres commandes                  |
| `PARENT`       | Commandes de tous ses enfants                     |
| `VENDOR`       | Commandes passées auprès de son établissement     |
| `SCHOOL_ADMIN` | Toutes les commandes de son école                 |
| `SUPER_ADMIN`  | Toutes les commandes                              |

**Query params**

| Param   | Type   | Défaut | Description                  |
|---------|--------|--------|------------------------------|
| `page`  | number | `1`    | Page (min: 1)                |
| `limit` | number | `20`   | Par page (min: 1, max: 100)  |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "vendorId": "uuid",
      "status": "PENDING",
      "paymentMethod": "WALLET",
      "totalAmount": 1500,
      "expiresAt": "2026-05-15T10:15:00.000Z",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8 }
}
```

| Champ           | Type   | Valeurs possibles                               |
|-----------------|--------|-------------------------------------------------|
| `status`        | enum   | `PENDING` \| `VALIDATED` \| `CANCELLED` \| `EXPIRED` |
| `paymentMethod` | enum   | `WALLET` \| `CASH`                              |
| `totalAmount`   | number | Montant total en XOF                            |

---

## 3. Détail d'une commande

### `GET /orders/:id`

Retourne le détail d'une commande avec ses articles.

**Rôles autorisés:** `STUDENT`, `PARENT`, `VENDOR`, `SCHOOL_ADMIN`, `SUPER_ADMIN`

> Chaque rôle ne peut accéder qu'aux commandes qui lui sont visibles (même règle que le listing).

**Path params**

| Param | Type          | Description      |
|-------|---------------|------------------|
| `id`  | string (UUID) | ID de la commande |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "vendorId": "uuid",
    "status": "PENDING",
    "paymentMethod": "CASH",
    "totalAmount": 1500,
    "expiresAt": "2026-05-15T10:15:00.000Z",
    "createdAt": "2026-05-15T10:00:00.000Z",
    "items": [
      {
        "id": "uuid",
        "itemId": "uuid",
        "quantity": 2,
        "unitPrice": 500
      },
      {
        "id": "uuid",
        "itemId": "uuid",
        "quantity": 1,
        "unitPrice": 500
      }
    ]
  }
}
```

**Erreurs**

| Code | Message              |
|------|----------------------|
| 404  | Commande introuvable |
| 403  | Accès refusé         |

---

## 4. Valider une commande

### `PUT /orders/:id/validate`

Valide une commande `PENDING`.

- **Mode `WALLET`** : le montant réservé est débité du wallet du student et crédité sur le wallet du vendeur.
- **Mode `CASH`** : aucun mouvement de wallet. La commande passe simplement à `VALIDATED`.

**Rôles autorisés:** `VENDOR` (ses propres commandes uniquement), `SUPER_ADMIN`

**Path params**

| Param | Type          | Description      |
|-------|---------------|------------------|
| `id`  | string (UUID) | ID de la commande |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "vendorId": "uuid",
    "status": "VALIDATED",
    "paymentMethod": "WALLET",
    "totalAmount": 1500,
    "expiresAt": "2026-05-15T10:15:00.000Z",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message                              |
|------|--------------------------------------|
| 400  | La commande n'est pas en statut PENDING |
| 403  | Accès refusé                         |
| 404  | Commande introuvable                 |

---

## 5. Annuler une commande

### `PUT /orders/:id/cancel`

Annule une commande `PENDING`.

- **Mode `WALLET`** : la réservation est libérée (`reserved` diminue, `balance` inchangé).
- **Mode `CASH`** : aucun mouvement de wallet. La commande passe simplement à `CANCELLED`.

**Rôles autorisés:** `STUDENT`, `PARENT`, `VENDOR`, `SCHOOL_ADMIN`, `SUPER_ADMIN`

**Path params**

| Param | Type          | Description      |
|-------|---------------|------------------|
| `id`  | string (UUID) | ID de la commande |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "studentId": "uuid",
    "vendorId": "uuid",
    "status": "CANCELLED",
    "paymentMethod": "CASH",
    "totalAmount": 1500,
    "expiresAt": "2026-05-15T10:15:00.000Z",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message                              |
|------|--------------------------------------|
| 400  | La commande n'est pas en statut PENDING |
| 403  | Accès refusé                         |
| 404  | Commande introuvable                 |

---

## 6. Commandes d'un student

### `GET /students/:id/orders`

Retourne la liste paginée des commandes d'un student spécifique, avec le résumé du vendeur.

**Rôles autorisés:** `STUDENT` (soi-même uniquement), `SCHOOL_ADMIN`, `SUPER_ADMIN`

**Path params**

| Param | Type          | Description     |
|-------|---------------|-----------------|
| `id`  | string (UUID) | ID du student   |

**Query params**

| Param   | Type   | Défaut | Description                  |
|---------|--------|--------|------------------------------|
| `page`  | number | `1`    | Page (min: 1)                |
| `limit` | number | `20`   | Par page (min: 1, max: 100)  |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "VALIDATED",
      "paymentMethod": "WALLET",
      "totalAmount": 1500,
      "expiresAt": "2026-05-15T10:15:00.000Z",
      "createdAt": "2026-05-15T10:00:00.000Z",
      "vendor": {
        "id": "uuid",
        "shopName": "Chez Mamadou"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12 }
}
```

**Erreurs**

| Code | Message              |
|------|----------------------|
| 404  | Student introuvable  |
| 403  | Accès refusé         |

---

## Cycle de vie d'une commande

```
PENDING ──(validate)──► VALIDATED
        ──(cancel)───► CANCELLED
        ──(15 min)───► EXPIRED  (automatique)
```

### Mode WALLET

| Événement   | wallet student (`balance` / `reserved`) | wallet vendeur (`balance`) |
|-------------|----------------------------------------|----------------------------|
| Création    | `reserved` +montant                    | inchangé                   |
| Validation  | `reserved` -montant, `balance` -montant | `balance` +montant        |
| Annulation  | `reserved` -montant                    | inchangé                   |
| Expiration  | `reserved` -montant                    | inchangé                   |

### Mode CASH

| Événement   | wallet student | wallet vendeur |
|-------------|----------------|----------------|
| Création    | inchangé       | inchangé       |
| Validation  | inchangé       | inchangé       |
| Annulation  | inchangé       | inchangé       |
