# API Specs — Cartes (Cards)

Base URL: `/api/v1`  
Auth: Bearer token (JWT) requis sur tous les endpoints.

Toutes les réponses sont enveloppées dans :
```json
{ "data": <payload> }
```

---

## Objet Card

```json
{
  "id": "uuid",
  "code": "GF-LYCEE-0042",
  "status": "ACTIVE",
  "schoolId": "uuid",
  "studentId": "uuid",
  "dailyLimit": 2000,
  "imageUrl": "https://cdn.example.com/cards/GF-LYCEE-0042.png",
  "createdAt": "2026-01-10T08:00:00.000Z"
}
```

| Champ       | Type          | Description                                                   |
|-------------|---------------|---------------------------------------------------------------|
| `id`        | string (UUID) | Identifiant interne                                           |
| `code`      | string        | Code unique de la carte, format `GF-<SIGLE>-<4 chiffres>`    |
| `status`    | enum          | `UNASSIGNED` \| `ACTIVE` \| `SUSPENDED` \| `BLOCKED`         |
| `schoolId`  | string (UUID) | École à laquelle la carte appartient                          |
| `studentId` | string (UUID) \| null | Student associé (`null` si non assignée)              |
| `dailyLimit`| number        | Plafond journalier en XOF (défaut : 1000)                    |
| `imageUrl`  | string \| null | URL publique du QR code PNG                                  |
| `createdAt` | string (ISO)  | Date de création                                              |

**Statuts possibles**

| Statut        | Description                                                       |
|---------------|-------------------------------------------------------------------|
| `UNASSIGNED`  | Carte générée mais non encore attribuée à un student             |
| `ACTIVE`      | Carte opérationnelle, accepte les paiements                       |
| `SUSPENDED`   | Suspendue manuellement (parent/student/admin). Réactivable.       |
| `BLOCKED`     | Bloquée automatiquement après 3 échecs de PIN. Débloquée via reset-pin. |

---

## 1. Générer un lot de cartes

### `POST /cards`

Génère un lot de cartes avec QR code pour une école. Les QR codes sont uploadés sur le stockage cloud.

**Rôles autorisés:** `SUPER_ADMIN`

**Body**

```json
{
  "schoolId": "uuid",
  "count": 20
}
```

| Champ      | Type          | Requis | Contraintes              |
|------------|---------------|--------|--------------------------|
| `schoolId` | string (UUID) | oui    | École existante          |
| `count`    | number (int)  | oui    | Min: 1, Max: 100         |

**Réponse 201**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "GF-LYCEE-0042",
      "status": "UNASSIGNED",
      "schoolId": "uuid",
      "studentId": null,
      "dailyLimit": 1000,
      "imageUrl": "https://cdn.example.com/cards/GF-LYCEE-0042.png",
      "createdAt": "2026-01-10T08:00:00.000Z"
    }
  ]
}
```

**Erreurs**

| Code | Message              |
|------|----------------------|
| 400  | Validation failed    |
| 404  | École introuvable    |

---

## 2. Consulter une carte

### `GET /cards/:code`

Retourne les détails d'une carte par son code.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (son école uniquement)

**Path params**

| Param  | Type   | Description         |
|--------|--------|---------------------|
| `code` | string | Code unique de la carte (ex. `GF-LYCEE-0042`) |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "ACTIVE",
    "schoolId": "uuid",
    "studentId": "uuid",
    "dailyLimit": 2000,
    "imageUrl": "https://cdn.example.com/cards/GF-LYCEE-0042.png",
    "createdAt": "2026-01-10T08:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message              |
|------|----------------------|
| 403  | Accès refusé (carte d'une autre école) |
| 404  | Carte introuvable    |

---

## 3. Suspendre une carte

### `PUT /cards/:code/suspend`

Suspend une carte `ACTIVE`. La carte ne peut plus être utilisée pour payer jusqu'à réactivation.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (carte de son enfant uniquement), `STUDENT` (sa propre carte uniquement)

**Path params**

| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `code` | string | Code unique de la carte  |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "SUSPENDED",
    ...
  }
}
```

**Erreurs**

| Code | Message                        | Condition                                  |
|------|--------------------------------|--------------------------------------------|
| 403  | Accès refusé                   | Carte ne vous appartient pas               |
| 404  | Carte introuvable              |                                            |
| 409  | La carte n'est pas suspendable | La carte n'est pas en statut `ACTIVE`      |

---

## 4. Réactiver une carte

### `PUT /cards/:code/activate`

Réactive une carte `SUSPENDED`.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PARENT` (carte de son enfant uniquement), `STUDENT` (sa propre carte uniquement)

**Path params**

| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `code` | string | Code unique de la carte  |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "ACTIVE",
    ...
  }
}
```

**Erreurs**

| Code | Message                       | Condition                                   |
|------|-------------------------------|---------------------------------------------|
| 403  | Accès refusé                  | Carte ne vous appartient pas                |
| 404  | Carte introuvable             |                                             |
| 409  | La carte n'est pas activable  | La carte n'est pas en statut `SUSPENDED`    |

> **Note :** Une carte `BLOCKED` ne peut pas être réactivée via cet endpoint. Utiliser `PUT /cards/:code/reset-pin` à la place.

---

## 5. Modifier le plafond journalier

### `PUT /cards/:code/daily-limit`

Met à jour le plafond de dépense journalier de la carte.

**Rôles autorisés:** `PARENT` (carte de son enfant uniquement), `STUDENT` (sa propre carte uniquement)

**Path params**

| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `code` | string | Code unique de la carte  |

**Body**

```json
{
  "dailyLimit": 3000
}
```

| Champ        | Type         | Requis | Contraintes                        |
|--------------|--------------|--------|------------------------------------|
| `dailyLimit` | number (int) | oui    | Min: 100, Max: 100 000 (en XOF)   |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "ACTIVE",
    "dailyLimit": 3000,
    ...
  }
}
```

**Erreurs**

| Code | Message              |
|------|----------------------|
| 400  | Validation failed    |
| 403  | Accès refusé (carte ne vous appartient pas) |
| 404  | Carte introuvable    |

---

## 6. Vérifier le PIN (paiement)

### `POST /cards/:code/verify-pin`

Vérifie le PIN saisi par le student lors d'un paiement. Incrémente le compteur d'échecs. Bloque automatiquement la carte après **3 échecs consécutifs**.

**Rôles autorisés:** `VENDOR`

**Path params**

| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `code` | string | Code unique de la carte  |

**Body**

```json
{
  "pin": "1234"
}
```

| Champ | Type   | Requis | Contraintes                |
|-------|--------|--------|----------------------------|
| `pin` | string | oui    | Exactement 4 chiffres      |

**Réponse 200** *(PIN correct)*

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "ACTIVE",
    "dailyLimit": 2000,
    ...
  }
}
```

**Erreurs**

| Code | Message                    | Condition                                                    |
|------|----------------------------|--------------------------------------------------------------|
| 400  | Validation failed          | `pin` absent ou format invalide                             |
| 401  | PIN invalide               | PIN incorrect (carte non encore bloquée)                    |
| 403  | Carte bloquée              | 3 échecs atteints — carte automatiquement bloquée           |
| 404  | Carte introuvable          |                                                              |
| 409  | Carte non active           | Carte `SUSPENDED` ou `UNASSIGNED`                           |

> Après un PIN correct, le compteur d'échecs est remis à zéro.

---

## 7. Réinitialiser le PIN

### `PUT /cards/:code/reset-pin`

Réinitialise le PIN de la carte après vérification du mot de passe du compte. Si la carte est `BLOCKED`, elle repasse à `ACTIVE` automatiquement.

**Rôles autorisés:** `STUDENT` (sa propre carte uniquement), `PARENT` (carte de son enfant uniquement)

**Path params**

| Param  | Type   | Description              |
|--------|--------|--------------------------|
| `code` | string | Code unique de la carte  |

**Body**

```json
{
  "password": "monMotDePasse",
  "newPin": "5678"
}
```

| Champ      | Type   | Requis | Contraintes                  |
|------------|--------|--------|------------------------------|
| `password` | string | oui    | Mot de passe du compte       |
| `newPin`   | string | oui    | Exactement 4 chiffres        |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "code": "GF-LYCEE-0042",
    "status": "ACTIVE",
    ...
  }
}
```

**Erreurs**

| Code | Message                     | Condition                                    |
|------|-----------------------------|----------------------------------------------|
| 400  | Validation failed           | Format `newPin` invalide                     |
| 401  | Mot de passe incorrect      | `password` ne correspond pas au compte       |
| 403  | Accès refusé                | Carte ne vous appartient pas                 |
| 404  | Carte introuvable           |                                              |

---

## Règles de propriété

| Rôle           | Peut agir sur                                                     |
|----------------|-------------------------------------------------------------------|
| `SUPER_ADMIN`  | Toutes les cartes                                                 |
| `SCHOOL_ADMIN` | Cartes de son école uniquement                                    |
| `PARENT`       | Cartes des students liés à lui (via `StudentParent`)              |
| `STUDENT`      | Sa propre carte uniquement                                        |
| `VENDOR`       | Accès à `verify-pin` uniquement                                   |

---

## Cycle de vie d'une carte

```
UNASSIGNED ──(assignation)──► ACTIVE
ACTIVE     ──(suspend)──────► SUSPENDED
SUSPENDED  ──(activate)─────► ACTIVE
ACTIVE     ──(3 PIN KO)─────► BLOCKED
BLOCKED    ──(reset-pin)────► ACTIVE
```
