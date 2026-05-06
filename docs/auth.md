# Authentication — API Documentation

**Base URL:** `http://localhost:3000/api/v1`  
**Content-Type:** `application/json`

---

## Format des réponses

### Succès

Toutes les réponses sont enveloppées par le `ResponseInterceptor` :

```json
{
  "data": { ... },
  "timestamp": "2025-04-30T12:00:00.000Z"
}
```

Les exemples ci-dessous montrent uniquement le contenu de `data`.

### Erreur

```json
{
  "statusCode": 404,
  "message": "Card not found",
  "error": "Not Found"
}
```

Erreur de validation (400) — `message` est un tableau :

```json
{
  "statusCode": 400,
  "message": ["cardCode should not be empty", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

| Statut | `error`        |
|--------|----------------|
| 400    | `Bad Request`  |
| 401    | `Unauthorized` |
| 409    | `Conflict`     |
| 404    | `Not Found`    |

---

## POST /auth/scan-card

Vérifie le statut d'une carte et si un student / des parents y sont déjà liés.  
Utilisé avant l'inscription pour savoir quel flow afficher.

**Auth :** aucune

### Body

| Champ  | Type   | Requis | Contraintes |
|--------|--------|--------|-------------|
| `code` | string | oui    | non vide    |

```json
{
  "code": "GF-2024-001"
}
```

### Réponse 200

```json
{
  "status": "UNASSIGNED",
  "student": false,
  "parents": [false, false]
}
```

| Champ     | Type                                            | Description                                      |
|-----------|-------------------------------------------------|--------------------------------------------------|
| `status`  | `UNASSIGNED \| ACTIVE \| SUSPENDED \| BLOCKED` | Statut actuel de la carte                        |
| `student` | boolean                                         | `true` si un student est lié à la carte          |
| `parents` | `[boolean, boolean]`                            | Slots parent 1 et parent 2 — `true` si occupé   |

### Erreurs

| Code | Message          | Raison                  |
|------|------------------|-------------------------|
| 400  | tableau de msgs  | Validation échouée      |
| 404  | `Card not found` | Code carte inexistant   |

---

## POST /auth/signup/parent

Inscrit un parent et le lie au student associé à la carte.

**Auth :** aucune

### Comportement selon le statut de la carte

| Statut carte  | Comportement                                                                                     |
|---------------|--------------------------------------------------------------------------------------------------|
| `UNASSIGNED`  | Crée un compte student (sans phone/password), crée le wallet, active la carte, set le PIN si fourni, crée le parent et le lie au student |
| `ACTIVE`      | Le student existe déjà — crée uniquement le parent et le lie au student                          |
| `SUSPENDED` / `BLOCKED` | Erreur 409                                                                            |

### Body

| Champ              | Type   | Requis | Contraintes                                          |
|--------------------|--------|--------|------------------------------------------------------|
| `cardCode`         | string | oui    | non vide                                             |
| `firstName`        | string | oui    | non vide — prénom du **parent**                      |
| `lastName`         | string | oui    | non vide — nom du **parent**                         |
| `phone`            | string | oui    | Format ivoirien `+2250XXXXXXXXX`                     |
| `password`         | string | oui    | min 8 caractères                                     |
| `studentFirstName` | string | oui    | prénom du **student**                                |
| `studentLastName`  | string | oui    | nom du **student**                                   |
| `studentClass`     | string | non    | ex. `"6ème A"`                                       |
| `pin`              | string | non    | 4 chiffres — PIN de la carte (requis si `UNASSIGNED`) |

```json
{
  "cardCode": "GF-2024-001",
  "firstName": "Aminata",
  "lastName": "Koné",
  "phone": "+22501234567",
  "password": "SecurePass123",
  "studentFirstName": "Kouassi",
  "studentLastName": "Yao",
  "studentClass": "6ème A",
  "pin": "1234"
}
```

### Réponse 201

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

| Champ          | Type   | Description                              |
|----------------|--------|------------------------------------------|
| `accessToken`  | JWT    | Token d'accès court-lived (JWT)          |
| `refreshToken` | string | Token de rafraîchissement long-lived     |

### Erreurs

| Code | Message                                     | Raison                                      |
|------|---------------------------------------------|---------------------------------------------|
| 400  | tableau de msgs                             | Validation échouée                          |
| 404  | `Card not found`                            | Code carte inexistant                       |
| 409  | `Card is not active`                        | Carte SUSPENDED ou BLOCKED                  |
| 409  | `Phone already exists`                      | Numéro de téléphone déjà utilisé            |
| 409  | `Student already has two parents`           | Le student a déjà 2 parents liés            |

---

## POST /auth/signup/student

Inscrit un student sur une carte non assignée.

**Auth :** aucune

### Body

| Champ      | Type   | Requis | Contraintes                                            |
|------------|--------|--------|--------------------------------------------------------|
| `cardCode` | string | oui    | non vide                                               |
| `firstName`| string | oui    | non vide                                               |
| `lastName` | string | oui    | non vide                                               |
| `phone`    | string | oui    | Format ivoirien `+2250XXXXXXXXX`                       |
| `password` | string | oui    | min 8 caractères                                       |
| `class`    | string | non    | ex. `"6ème A"`                                         |
| `pin`      | string | non    | 4 chiffres — PIN de la carte, défini à l'activation    |

```json
{
  "cardCode": "GF-2024-001",
  "firstName": "Kouassi",
  "lastName": "Yao",
  "phone": "+22501234567",
  "password": "SecurePass123",
  "class": "6ème A",
  "pin": "1234"
}
```

### Réponse 201

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

### Erreurs

| Code | Message                                  | Raison                                  |
|------|------------------------------------------|-----------------------------------------|
| 400  | tableau de msgs                          | Validation échouée                      |
| 404  | `Card not found`                         | Code carte inexistant                   |
| 409  | `Card is not available for registration` | Carte non UNASSIGNED                    |
| 409  | `Phone already exists`                   | Numéro de téléphone déjà utilisé        |

---

## POST /auth/signup/vendor

Inscrit un vendeur pour une école.

**Auth :** aucune

### Body

| Champ        | Type   | Requis | Contraintes                      |
|--------------|--------|--------|----------------------------------|
| `firstName`  | string | oui    | non vide                         |
| `lastName`   | string | oui    | non vide                         |
| `phone`      | string | oui    | Format ivoirien `+2250XXXXXXXXX` |
| `password`   | string | oui    | min 8 caractères                 |
| `shopName`   | string | oui    | non vide                         |
| `schoolId`   | UUID   | oui    | UUID valide                      |
| `waveNumber` | string | non    | Numéro Wave Mobile Money         |

```json
{
  "firstName": "Konan",
  "lastName": "Brou",
  "phone": "+22501234567",
  "password": "SecurePass123",
  "shopName": "Maquis Chez Konan",
  "schoolId": "uuid-de-lecole",
  "waveNumber": "+2250700000000"
}
```

### Réponse 201

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

### Erreurs

| Code | Message                | Raison                           |
|------|------------------------|----------------------------------|
| 400  | tableau de msgs        | Validation échouée               |
| 404  | `School not found`     | École inexistante                |
| 409  | `Phone already exists` | Numéro de téléphone déjà utilisé |

---

## POST /auth/signin

Connexion avec numéro de téléphone et mot de passe.

**Auth :** aucune

### Body

| Champ      | Type   | Requis | Contraintes                      |
|------------|--------|--------|----------------------------------|
| `phone`    | string | oui    | Format ivoirien `+2250XXXXXXXXX` |
| `password` | string | oui    | min 8 caractères                 |

```json
{
  "phone": "+22501234567",
  "password": "SecurePass123"
}
```

### Réponse 200

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

### Erreurs

| Code | Message               | Raison                                   |
|------|-----------------------|------------------------------------------|
| 400  | tableau de msgs       | Validation échouée                       |
| 401  | `Invalid credentials` | Téléphone ou mot de passe incorrect      |

---

## POST /auth/refresh

Renouvelle la paire de tokens à partir du refresh token.  
L'ancien refresh token est révoqué immédiatement.

**Auth :** aucune

### Body

| Champ          | Type   | Requis |
|----------------|--------|--------|
| `refreshToken` | string | oui    |

```json
{
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

### Réponse 200

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "nouveau_refresh_token..."
}
```

### Erreurs

| Code | Message                              | Raison                              |
|------|--------------------------------------|-------------------------------------|
| 400  | tableau de msgs                      | Validation échouée                  |
| 401  | `Invalid or expired refresh token`   | Token invalide, révoqué ou expiré   |

---

## POST /auth/signout

Révoque le refresh token courant.

**Auth :** aucune

### Body

| Champ          | Type   | Requis |
|----------------|--------|--------|
| `refreshToken` | string | oui    |

```json
{
  "refreshToken": "a3f8b2c1d4e5f6..."
}
```

### Réponse 200

Corps vide — la déconnexion est silencieuse même si le token est inconnu.

---

## PUT /auth/fcm-token

Enregistre ou efface le token FCM de l'appareil pour les notifications push.

**Auth :** Bearer — tout rôle authentifié

### Headers

```
Authorization: Bearer <accessToken>
```

### Body

| Champ      | Type           | Requis | Description                            |
|------------|----------------|--------|----------------------------------------|
| `fcmToken` | string \| null | non    | Token Firebase. Envoyer `null` pour effacer. |

```json
{ "fcmToken": "fMn4k8..." }
```

```json
{ "fcmToken": null }
```

### Réponse 200

Corps vide.

### Erreurs

| Code | Message        | Raison                   |
|------|----------------|--------------------------|
| 401  | `Unauthorized` | Token absent ou invalide |
