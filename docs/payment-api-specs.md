# API Specs — Paiements & Retraits

Base URL: `/api/v1`  
Auth: Bearer token (JWT) requis sauf mention contraire.

Toutes les réponses sont enveloppées dans :
```json
{ "data": <payload> }
```
Les réponses paginées ajoutent un objet `meta` :
```json
{
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

## Vue d'ensemble

Le système de paiement couvre deux flux distincts :

| Flux | Description |
|------|-------------|
| **Rechargement wallet** | Un parent ou un student initie un rechargement via Paystack. Le wallet est crédité automatiquement à réception du webhook `charge.success`. |
| **Retrait vendeur** | Un vendeur demande le retrait de son solde vers Wave. Le SUPER_ADMIN traite manuellement le virement et met à jour le statut. |

---

## Partie 1 — Rechargement wallet (Paystack)

### Flux complet

```
Client                   API                        Paystack
  │                        │                             │
  │── POST /payments/initiate ──►                        │
  │                        │── POST /transaction/initialize ──►│
  │                        │◄── { authorizationUrl, reference }│
  │◄── { authorizationUrl, reference, paymentId } ──    │
  │                        │                             │
  │── redirect vers authorizationUrl ──────────────────►│
  │◄── page de paiement Paystack ──────────────────────  │
  │   (student/parent saisit infos CB / mobile money)   │
  │                        │                             │
  │                        │◄── POST /payments/webhook ──│
  │                        │   event: charge.success     │
  │                        │── vérifie signature HMAC    │
  │                        │── crédite wallet student    │
  │                        │── crée transaction CREDIT   │
```

---

### 1. Initier un rechargement

#### `POST /payments/initiate`

Crée une session de paiement Paystack et retourne l'URL de redirection vers la page de paiement.

**Rôles autorisés:** `SUPER_ADMIN`, `PARENT` (son enfant uniquement), `STUDENT` (son propre wallet)

**Body**

```json
{
  "studentId": "uuid",
  "amount": 5000
}
```

| Champ       | Type          | Requis | Contraintes         |
|-------------|---------------|--------|---------------------|
| `studentId` | string (UUID) | oui    | Student existant    |
| `amount`    | number (int)  | oui    | Min: 100 (en XOF)   |

**Réponse 201**

```json
{
  "data": {
    "paymentId": "uuid",
    "authorizationUrl": "https://checkout.paystack.com/...",
    "reference": "GF-1716029283472-xk8f2a"
  }
}
```

| Champ              | Description                                                              |
|--------------------|--------------------------------------------------------------------------|
| `paymentId`        | ID du paiement en base (statut `PENDING` à ce stade)                    |
| `authorizationUrl` | URL vers laquelle rediriger l'utilisateur pour finaliser le paiement     |
| `reference`        | Référence unique générée côté API, format `GF-<timestamp>-<random>`     |

> Après initiation, le paiement est en statut `PENDING`. Il passe à `SUCCESS` uniquement à réception du webhook Paystack.

**Erreurs**

| Code | Message                         | Condition                                       |
|------|---------------------------------|-------------------------------------------------|
| 403  | Accès refusé                    | Student ne vous appartient pas                  |
| 404  | Student introuvable             |                                                 |
| 500  | Erreur lors de l'initiation     | Paystack inaccessible ou erreur API             |

---

### 2. Webhook Paystack

#### `POST /payments/webhook`

Endpoint appelé automatiquement par Paystack lorsqu'un paiement est confirmé. **Aucun Bearer token requis** — sécurisé par signature HMAC.

> **Ne pas appeler manuellement.** Cet endpoint est exclusivement destiné à Paystack.

**Headers attendus**

| Header                  | Description                                                           |
|-------------------------|-----------------------------------------------------------------------|
| `x-paystack-signature`  | HMAC-SHA512 du corps brut de la requête, signé avec `PAYSTACK_SECRET_KEY` |

**Vérification de la signature**

L'API recalcule la signature côté serveur :
```
HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY) == x-paystack-signature
```
Si la signature est invalide, la requête est rejetée avec `401`.

**Événements traités**

| Événement        | Action                                                                       |
|------------------|------------------------------------------------------------------------------|
| `charge.success` | Passe le paiement en `SUCCESS`, crédite le wallet, crée une transaction `CREDIT` |
| Autres           | Ignorés silencieusement (réponse `200` sans effet)                           |

**Corps de l'événement `charge.success` (envoyé par Paystack)**

```json
{
  "event": "charge.success",
  "data": {
    "reference": "GF-1716029283472-xk8f2a",
    "amount": 500000
  }
}
```

> `amount` est en **centimes** dans l'API Paystack (500000 = 5000 XOF). La valeur stockée en base est celle de l'objet `Payment` créé à l'initiation.

**Comportement à réception**

1. Vérifie la signature HMAC — `401` si invalide.
2. Ignore tout événement autre que `charge.success`.
3. Recherche le `Payment` par `paystackRef`. Si introuvable → ignore.
4. Si le paiement est déjà `SUCCESS` → ignore (idempotence).
5. Met à jour le paiement en `SUCCESS`.
6. Crédite le wallet du student : `balance += payment.amount`.
7. Crée une transaction de type `CREDIT` avec `balanceBefore` / `balanceAfter`.

**Réponse 200** — toujours, même si ignoré.

---

### 3. Lister les paiements

#### `GET /payments`

Retourne la liste paginée des paiements.

**Rôles autorisés:** `SUPER_ADMIN` (tous), `SCHOOL_ADMIN` (school uniquement)

**Query params**

| Param   | Type   | Défaut | Description                 |
|---------|--------|--------|-----------------------------|
| `page`  | number | `1`    | Page (min: 1)               |
| `limit` | number | `20`   | Par page (min: 1, max: 100) |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "walletId": "uuid",
      "paystackRef": "GF-1716029283472-xk8f2a",
      "amount": 5000,
      "currency": "XOF",
      "status": "SUCCESS",
      "initiatedBy": "uuid",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

| Champ         | Type   | Valeurs possibles               |
|---------------|--------|---------------------------------|
| `status`      | enum   | `PENDING` \| `SUCCESS` \| `FAILED` |
| `currency`    | enum   | `XOF`                           |
| `initiatedBy` | UUID   | ID de l'utilisateur ayant initié le paiement |

**Erreurs**

| Code | Message      |
|------|--------------|
| 403  | Accès refusé |

---

## Partie 2 — Retraits vendeur (Withdrawals)

Les vendeurs accumulent un solde sur leur `VendorWallet` au fil des commandes validées. Ils peuvent demander un retrait vers leur compte Wave. Le SUPER_ADMIN traite le virement manuellement et met à jour le statut.

### Flux complet

```
Vendor                   API                    SUPER_ADMIN
  │                        │                         │
  │── POST /withdrawals/vendor/:id ──►               │
  │   (balance vendorWallet déduit immédiatement)    │
  │◄── withdrawal PENDING ──                         │
  │                        │                         │
  │                        │◄── PUT /:id/process ────│
  │                        │   (paystackRef optionnel)│
  │                        │── withdrawal IN_PROGRESS │
  │                        │                         │
  │                        │◄── PUT /:id/complete ───│
  │                        │── withdrawal SUCCESS     │
  │                        │                         │
  │            (si échec)  │◄── PUT /:id/fail ───────│
  │                        │── withdrawal FAILED      │
  │                        │── balance remboursé      │
```

---

### 4. Demander un retrait

#### `POST /withdrawals/vendor/:vendorId`

Crée une demande de retrait. Le montant est immédiatement déduit du `VendorWallet` lors de la création.

**Rôles autorisés:** `VENDOR` (son propre vendeur), `SUPER_ADMIN`

**Path params**

| Param      | Type          | Description    |
|------------|---------------|----------------|
| `vendorId` | string (UUID) | ID du vendeur  |

**Body**

```json
{
  "amount": 10000,
  "waveNumber": "+2250701234567"
}
```

| Champ        | Type         | Requis | Contraintes                       |
|--------------|--------------|--------|-----------------------------------|
| `amount`     | number (int) | oui    | Min: 100, doit être ≤ solde wallet |
| `waveNumber` | string       | oui    | Numéro Wave du destinataire (min 3 chars) |

**Réponse 201**

```json
{
  "data": {
    "id": "uuid",
    "vendorId": "uuid",
    "amount": 10000,
    "currency": "XOF",
    "waveNumber": "+2250701234567",
    "paystackRef": null,
    "status": "PENDING",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message                     | Condition                             |
|------|-----------------------------|---------------------------------------|
| 400  | Solde insuffisant           | `amount` > solde `VendorWallet`       |
| 403  | Accès refusé                | Vendeur ne vous appartient pas        |
| 404  | Vendeur introuvable         |                                       |
| 404  | Wallet vendeur introuvable  |                                       |

---

### 5. Passer un retrait en traitement

#### `PUT /withdrawals/:id/process`

Indique qu'un virement est en cours. Peut associer une référence Paystack optionnelle.

**Rôles autorisés:** `SUPER_ADMIN`

**Path params**

| Param | Type          | Description        |
|-------|---------------|--------------------|
| `id`  | string (UUID) | ID du retrait      |

**Query params (optionnel)**

| Param         | Type   | Description                                  |
|---------------|--------|----------------------------------------------|
| `paystackRef` | string | Référence du transfert Paystack si applicable |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "vendorId": "uuid",
    "amount": 10000,
    "currency": "XOF",
    "waveNumber": "+2250701234567",
    "paystackRef": "TRF-ABC123",
    "status": "IN_PROGRESS",
    "createdAt": "2026-05-15T10:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message                          | Condition                          |
|------|----------------------------------|------------------------------------|
| 400  | Le retrait n'est pas en PENDING  | Statut n'est pas `PENDING`         |
| 404  | Retrait introuvable              |                                    |

---

### 6. Confirmer un retrait

#### `PUT /withdrawals/:id/complete`

Marque le retrait comme effectué avec succès.

**Rôles autorisés:** `SUPER_ADMIN`

**Path params**

| Param | Type          | Description   |
|-------|---------------|---------------|
| `id`  | string (UUID) | ID du retrait |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "status": "SUCCESS",
    ...
  }
}
```

**Erreurs**

| Code | Message                              | Condition                              |
|------|--------------------------------------|----------------------------------------|
| 400  | Le retrait n'est pas en IN_PROGRESS  | Statut n'est pas `IN_PROGRESS`         |
| 404  | Retrait introuvable                  |                                        |

---

### 7. Marquer un retrait comme échoué

#### `PUT /withdrawals/:id/fail`

Marque le retrait comme échoué. **Le montant est automatiquement remboursé** sur le `VendorWallet`.

**Rôles autorisés:** `SUPER_ADMIN`

**Path params**

| Param | Type          | Description   |
|-------|---------------|---------------|
| `id`  | string (UUID) | ID du retrait |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "status": "FAILED",
    ...
  }
}
```

> Le remboursement et le changement de statut sont atomiques (transaction DB).

**Erreurs**

| Code | Message                         | Condition                                           |
|------|---------------------------------|-----------------------------------------------------|
| 400  | Le retrait n'est pas en PENDING | Statut est déjà `SUCCESS` ou `FAILED`              |
| 404  | Retrait introuvable             |                                                     |

---

### 8. Lister les retraits

#### `GET /withdrawals`

**Rôles autorisés:** `VENDOR` (ses propres retraits), `SUPER_ADMIN` (tous)

**Query params**

| Param   | Type   | Défaut | Description                 |
|---------|--------|--------|-----------------------------|
| `page`  | number | `1`    | Page (min: 1)               |
| `limit` | number | `20`   | Par page (min: 1, max: 100) |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "vendorId": "uuid",
      "amount": 10000,
      "currency": "XOF",
      "waveNumber": "+2250701234567",
      "paystackRef": "TRF-ABC123",
      "status": "SUCCESS",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

| Champ      | Valeurs possibles                                         |
|------------|-----------------------------------------------------------|
| `status`   | `PENDING` \| `IN_PROGRESS` \| `SUCCESS` \| `FAILED`      |
| `currency` | `XOF`                                                     |

---

## Transactions wallet (référence)

Toute opération qui modifie le wallet d'un student génère une `Transaction`. Les types possibles :

| Type      | Déclencheur                                   | Effet sur `balance` / `reserved`               |
|-----------|-----------------------------------------------|------------------------------------------------|
| `CREDIT`  | Webhook `charge.success`                      | `balance` +montant                             |
| `RESERVE` | Création d'une commande `WALLET`              | `reserved` +montant                            |
| `DEBIT`   | Validation d'une commande `WALLET`            | `reserved` -montant, `balance` -montant        |
| `RELEASE` | Annulation/expiration d'une commande `WALLET` | `reserved` -montant                            |

> Les commandes en mode `CASH` ne génèrent aucune transaction wallet.

---

## Configuration requise

| Variable env           | Description                                                      |
|------------------------|------------------------------------------------------------------|
| `PAYSTACK_SECRET_KEY`  | Clé secrète Paystack (backend uniquement, jamais exposée au client) |

La clé est utilisée pour :
- Authentifier les appels sortants vers `api.paystack.co`
- Vérifier la signature HMAC des webhooks entrants

> En environnement de test, `PaystackService` est remplacé par `NoopPaystackService` qui retourne des données fictives sans appel réseau réel.
