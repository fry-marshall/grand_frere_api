# API Specs — Catalogue vendeurs

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
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

## Table des matières

1. [Vendeurs d'une école](#1-vendeurs-dune-école)
2. [Détail d'un vendeur](#2-détail-dun-vendeur)
3. [Plats d'un vendeur](#3-plats-dun-vendeur)
4. [Détail d'un plat](#4-détail-dun-plat)

---

## 1. Vendeurs d'une école

### `GET /schools/:id/vendors`

Retourne la liste paginée des vendeurs d'une école.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STUDENT`, `PARENT`

> `STUDENT` et `PARENT` ne voient que les vendeurs avec le statut `ACTIVE`.  
> `SUPER_ADMIN` et `SCHOOL_ADMIN` voient tous les statuts.

**Règles d'accès**

| Rôle           | Condition                                                      |
|----------------|----------------------------------------------------------------|
| `SUPER_ADMIN`  | Accès libre                                                    |
| `SCHOOL_ADMIN` | Doit administrer l'école demandée                              |
| `STUDENT`      | Doit être inscrit dans l'école demandée                        |
| `PARENT`       | Doit avoir au moins un enfant inscrit dans l'école demandée    |

**Path params**

| Param | Type          | Description   |
|-------|---------------|---------------|
| `id`  | string (UUID) | ID de l'école |

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
      "shopName": "Chez Aminata",
      "waveNumber": "+221771234501",
      "status": "ACTIVE",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "user": {
        "id": "uuid",
        "firstName": "Aminata",
        "lastName": "Diallo",
        "phone": "+221771234501"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

**Champs de la réponse**

| Champ        | Type           | Description                                                          |
|--------------|----------------|----------------------------------------------------------------------|
| `id`         | string (UUID)  | Identifiant du vendeur                                               |
| `shopName`   | string         | Nom de la boutique                                                   |
| `waveNumber` | string \| null | Numéro Wave pour le paiement (peut être null)                        |
| `status`     | enum           | `PENDING` \| `ACTIVE` \| `SUSPENDED` \| `REJECTED` (admins seulement) |
| `user`       | object         | Informations de compte du vendeur                                    |

**Erreurs**

| Code | Message                                                |
|------|--------------------------------------------------------|
| 404  | École introuvable                                      |
| 403  | Accès refusé (mauvaise école, enfant non inscrit, etc) |

---

## 2. Détail d'un vendeur

### `GET /vendors/:id`

Retourne les informations complètes d'un vendeur.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (de l'école du vendeur), `VENDOR` (soi-même)

**Path params**

| Param | Type          | Description   |
|-------|---------------|---------------|
| `id`  | string (UUID) | ID du vendeur |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "shopName": "Chez Aminata",
    "waveNumber": "+221771234501",
    "status": "ACTIVE",
    "schoolId": "uuid",
    "createdAt": "2026-01-10T08:00:00.000Z",
    "user": {
      "id": "uuid",
      "firstName": "Aminata",
      "lastName": "Diallo",
      "phone": "+221771234501"
    }
  }
}
```

**Erreurs**

| Code | Message             |
|------|---------------------|
| 404  | Vendeur introuvable |
| 403  | Accès refusé        |

---

## 3. Plats d'un vendeur

### `GET /vendors/:id/items`

Retourne les plats **actifs** d'un vendeur. Toujours filtré sur `status: ACTIVE` — cet endpoint est dédié à la navigation catalogue.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN`, `VENDOR`, `STUDENT`, `PARENT`

**Règles d'accès**

| Rôle           | Condition                                                   |
|----------------|-------------------------------------------------------------|
| `SUPER_ADMIN`  | Accès libre                                                 |
| `SCHOOL_ADMIN` | Doit administrer l'école du vendeur                         |
| `VENDOR`       | Doit être le propriétaire de la boutique                    |
| `STUDENT`      | Doit être inscrit dans la même école que le vendeur         |
| `PARENT`       | Doit avoir au moins un enfant dans la même école que le vendeur |

**Path params**

| Param | Type          | Description   |
|-------|---------------|---------------|
| `id`  | string (UUID) | ID du vendeur |

**Réponse 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "vendorId": "uuid",
      "name": "Thiéboudienne",
      "price": 1500,
      "description": "Riz au poisson sénégalais, légumes et sauce tomate",
      "imageUrl": "https://cdn.example.com/items/uuid/image.jpg",
      "status": "ACTIVE",
      "createdAt": "2026-01-10T09:00:00.000Z"
    },
    {
      "id": "uuid",
      "vendorId": "uuid",
      "name": "Yassa Poulet",
      "price": 1200,
      "description": "Poulet mariné aux oignons et citron, servi avec du riz",
      "imageUrl": "https://cdn.example.com/items/uuid/image.jpg",
      "status": "ACTIVE",
      "createdAt": "2026-01-10T09:05:00.000Z"
    }
  ]
}
```

> La réponse n'est **pas paginée** — tous les plats actifs du vendeur sont retournés d'un coup. Un vendeur a typiquement moins de 20 plats.

**Champs de la réponse**

| Champ         | Type           | Description                             |
|---------------|----------------|-----------------------------------------|
| `id`          | string (UUID)  | Identifiant du plat                     |
| `vendorId`    | string (UUID)  | ID du vendeur propriétaire              |
| `name`        | string         | Nom du plat                             |
| `price`       | number         | Prix en centimes de la devise (ex: XOF) |
| `description` | string \| null | Description courte du plat              |
| `imageUrl`    | string \| null | URL de la photo du plat (CDN)           |
| `status`      | enum           | Toujours `ACTIVE`                       |

**Erreurs**

| Code | Message                                                     |
|------|-------------------------------------------------------------|
| 404  | Vendeur introuvable                                         |
| 403  | Accès refusé (mauvaise école, enfant non inscrit, etc)      |

---

## 4. Détail d'un plat

### `GET /items/:id`

Retourne les informations d'un plat par son ID.

**Rôles autorisés:** `SUPER_ADMIN`, `SCHOOL_ADMIN` (de l'école du vendeur), `VENDOR` (son propre plat)

**Path params**

| Param | Type          | Description |
|-------|---------------|-------------|
| `id`  | string (UUID) | ID du plat  |

**Réponse 200**

```json
{
  "data": {
    "id": "uuid",
    "vendorId": "uuid",
    "name": "Thiéboudienne",
    "price": 1500,
    "description": "Riz au poisson sénégalais, légumes et sauce tomate",
    "imageUrl": "https://cdn.example.com/items/uuid/image.jpg",
    "status": "ACTIVE",
    "createdAt": "2026-01-10T09:00:00.000Z"
  }
}
```

**Erreurs**

| Code | Message          |
|------|------------------|
| 404  | Plat introuvable |
| 403  | Accès refusé     |

---

## Flux recommandé — afficher le catalogue d'une école

Pour afficher tous les vendeurs d'une école avec leurs plats respectifs (cas d'usage : student ou parent qui passe une commande) :

```
1.  GET /schools/:schoolId/vendors
    → liste les vendeurs ACTIVE de l'école
      (schoolId = celui du student/parent connecté)

2.  GET /vendors/:vendorId/items
    → liste les plats ACTIVE de la boutique choisie

3.  POST /orders/vendor/:vendorId
    → passe la commande avec les itemId récupérés à l'étape 2
```

---

## Données du seed LGB

Le seed de développement (`npm run seed:vendors`) crée les données suivantes dans l'école **LGB (Lycée Gaston Berger)** :

| Boutique         | Téléphone     | Mot de passe | Plats |
|------------------|---------------|--------------|-------|
| Chez Aminata     | +221771234501 | Vendor123!   | 5     |
| Le Grill Express | +221771234502 | Vendor123!   | 5     |
| Pause Déjeuner   | +221771234503 | Vendor123!   | 5     |
| Le Coin Sucré    | +221771234504 | Vendor123!   | 5     |
| Pasta & Co       | +221771234505 | Vendor123!   | 5     |

**Détail des plats par boutique**

**Chez Aminata** — Cuisine sénégalaise

| Plat          | Prix (XOF) |
|---------------|------------|
| Thiéboudienne | 1 500      |
| Yassa Poulet  | 1 200      |
| Mafé          | 1 000      |
| Domoda        | 1 200      |
| Bissap Frais  | 300        |

**Le Grill Express** — Grillades

| Plat                 | Prix (XOF) |
|----------------------|------------|
| Brochettes de Poulet | 1 000      |
| Merguez Grillées     | 800        |
| Poulet Braisé        | 1 500      |
| Sandwich Brochette   | 600        |
| Jus de Gingembre     | 300        |

**Pause Déjeuner** — Sandwichs & Snacks

| Plat              | Prix (XOF) |
|-------------------|------------|
| Sandwich Poulet   | 500        |
| Sandwich Thon     | 500        |
| Omelette Sandwich | 400        |
| Pizza Margherita  | 800        |
| Coca-Cola         | 300        |

**Le Coin Sucré** — Pâtisserie & Desserts

| Plat               | Prix (XOF) |
|--------------------|------------|
| Croissant Beurre   | 300        |
| Pain au Chocolat   | 350        |
| Gâteau Yaourt      | 400        |
| Jus d'Orange Frais | 400        |
| Glace Vanille      | 300        |

**Pasta & Co** — Cuisine italienne

| Plat                 | Prix (XOF) |
|----------------------|------------|
| Spaghetti Bolognaise | 1 200      |
| Pizza 4 Fromages     | 1 500      |
| Pâtes Carbonara      | 1 000      |
| Lasagnes             | 1 300      |
| Tiramisu             | 600        |
