# Grand Frère — Document de Conception Technique v1.0

> Application de cantine scolaire multi-établissements — Côte d'Ivoire

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Acteurs du système](#2-acteurs-du-système)
3. [Fonctionnement détaillé](#3-fonctionnement-détaillé)
4. [Schéma de base de données](#4-schéma-de-base-de-données)
5. [Architecture des modules NestJS](#5-architecture-des-modules-nestjs)
6. [API — Endpoints](#6-api--endpoints)
7. [Découpage des tâches Claude Code](#7-découpage-des-tâches-claude-code)

---

## 1. Présentation du projet

Grand Frère est une application de cantine scolaire multi-établissements permettant aux parents d'avoir un droit de regard sur les habitudes alimentaires et les dépenses de leurs enfants. La plateforme opère en Côte d'Ivoire et s'appuie sur un système de wallet virtuel rechargeable via mobile money (Paystack).

### Proposition de valeur

- **Transparence nutritionnelle** — les parents voient exactement ce que mange leur enfant
- **Contrôle financier** — suivi en temps réel des dépenses via wallet virtuel
- **Confiance envers l'établissement** — traçabilité complète des transactions

### Stack technique

| Composant | Technologie | Détails |
|---|---|---|
| Backend | NestJS | API REST, PostgreSQL + TypeORM |
| App Mobile | Flutter | App unique parent/élève + app séparée vendeur |
| Web Admin | Next.js | Dashboard Admin École + Super Admin |
| Paiement | Paystack | Collecte recharges + Transfers Wave |
| Push Notifs | Firebase FCM | Notifications temps réel |
| Stockage | AWS S3 | QR codes cartes + images plats |
| Base de données | PostgreSQL | Single DB multi-tenant avec `schoolId` partout |

---

## 2. Acteurs du système

| Rôle | Description |
|---|---|
| `SUPER_ADMIN` | Équipe Grand Frère — gère toutes les écoles, monitore tout |
| `SCHOOL_ADMIN` | Admin École — voit les flux, vendeurs, élèves, parents de son école |
| `VENDOR` | Vendeur — encaisse via app pro, gère catalogue, demande reversements |
| `PARENT` | Recharge wallet, surveille achats de ses enfants (max 2 élèves) |
| `STUDENT` | Pré-commande, consulte historique, recharge son propre wallet |

---

## 3. Fonctionnement détaillé

### 3.1 Système de carte

Chaque élève possède une carte physique avec un QR code unique. La carte est la pièce centrale du système — elle lie l'élève, son wallet et ses parents.

**Statuts de carte :**

- `UNASSIGNED` — carte créée, non encore assignée à un élève
- `ACTIVE` — carte assignée et opérationnelle
- `SUSPENDED` — suspendue manuellement par l'admin (perte, vol)
- `BLOCKED` — bloquée automatiquement après 3 mauvais PIN

**Génération des cartes (v1) :**
- Le Super Admin génère un lot via `POST /cards/bulk`
- Un QR code est généré automatiquement à partir du code
- L'image QR est uploadée sur S3
- En v2 : génération automatique avec design complet (Sharp/Canvas)

---

### 3.2 Onboarding QR Code

Le scan de la carte est le point d'entrée de tout onboarding. `POST /auth/scan-card` retourne l'état de la carte et l'app Flutter détermine quel flow afficher.

**Réponse de scan-card :**
```json
{
  "card": { "status": "UNASSIGNED | ACTIVE | SUSPENDED | BLOCKED" },
  "student": { "exists": true, "isOnboarded": true, "firstName": "Kofi" },
  "parents": { "count": 1, "isFull": false }
}
```

**Cas couverts :**

| État carte | État student | Résultat |
|---|---|---|
| UNASSIGNED | — | Affiche choix "Parent" / "Élève" |
| ACTIVE | isOnboarded = false | Flow "Première connexion élève" |
| ACTIVE | parents.count < 2 | Flow "Ajouter un parent" |
| ACTIVE | parents.isFull = true | "Carte déjà enregistrée, connectez-vous" |
| SUSPENDED / BLOCKED | — | Message d'erreur |

**Flow Parent en premier (carte UNASSIGNED) :**
```
1. Parent scanne la carte
2. Saisit SES infos + infos de l'élève + PIN
3. Backend (1 transaction DB) :
   → Crée User(PARENT) + Parent
   → Crée User(STUDENT) + Student
   → Assigne Card → ACTIVE
   → Crée Wallet (balance=0, reserved=0)
   → Crée StudentParent
4. Retourne JWT + refreshToken
```

**Flow Élève en premier (carte UNASSIGNED) :**
```
1. Élève scanne la carte
2. Saisit SES infos + PIN
3. Backend (1 transaction DB) :
   → Crée User(STUDENT) + Student
   → Assigne Card → ACTIVE
   → Crée Wallet (balance=0, reserved=0)
4. isOnboarded = false (pas de password défini)
5. Parent peut rejoindre ensuite via scan
```

**Flow Parent existant rejoint un élève :**
```
POST /auth/signup/parent/link
→ Parent déjà inscrit scanne la carte d'un nouvel élève
→ Vérifie credentials → crée uniquement le lien StudentParent
```

---

### 3.3 Wallet & Transactions

Chaque élève possède un wallet unique. Les montants sont stockés en **centimes XOF** (integer, jamais float).

**Structure du wallet :**

| Champ | Description |
|---|---|
| `balance` | Solde total en centimes XOF |
| `reserved` | Montant engagé dans des pré-commandes PENDING |
| `available` | `balance - reserved` (calculé, non stocké) |

**Règle d'atomicité (non négociable) :**
- Tout débit wallet + création Transaction = 1 seule transaction PostgreSQL
- Lock pessimiste (`pessimistic_write`) sur la ligne Wallet avant toute opération
- Garantit : pas de double débit, pas d'état incohérent
- Si crash → rollback automatique, aucun état intermédiaire

**Recharge wallet (topup) :**
```
1. Parent/Élève appelle POST /wallets/:studentId/topup
2. Backend crée Payment (status=PENDING)
3. Initie transaction Paystack → retourne paystackAuthorizationUrl
4. App Flutter ouvre WebView Paystack
5. Parent paie via mobile money
6. Paystack envoie webhook → POST /payments/webhook
7. Backend vérifie signature HMAC SHA512
8. Crédite wallet → balance += amount
9. Crée Transaction (type=CREDIT)
10. Notification parent/élève
```

**Montant minimum de recharge : 1 000 FCFA (100 000 centimes)**

---

### 3.4 Pré-commande

L'élève ou le parent pré-commande depuis l'app. La commande est validée par le vendeur au moment du passage en caisse via PIN (comme un TPE).

**Fenêtre horaire :**

| Horaire | Commande pour |
|---|---|
| 18h00 → 23h59 | Le LENDEMAIN |
| 00h00 → 17h59 | Aujourd'hui (jour J) |

**Flow complet :**
```
CÔTÉ ÉLÈVE / PARENT (app mobile)
  1. Sélectionne vendeur → voit catalogue
  2. Sélectionne plats
  3. Vérification : available >= totalAmount
  4. Commande créée → reserved += totalAmount
  5. Notification parent "Votre enfant a pré-commandé"

CÔTÉ CANTINE (app vendeur)
  6. Vendeur scanne carte élève
  7. Voit les pré-commandes PENDING du jour chez lui
  8. Élève saisit PIN sur l'app vendeur (pavé numérique = TPE)
  9. 1 transaction DB atomique :
     → balance -= totalAmount
     → reserved -= totalAmount
     → VendorWallet.balance += totalAmount
     → Order → VALIDATED
     → Transaction DEBIT créée
  10. Notification parent + élève "Commande validée"
```

**Expiration (cron 23h59) :**
```
→ Orders PENDING dont expiresAt <= now
→ status → EXPIRED
→ reserved -= totalAmount (libération)
→ Notification parent + élève
```

---

### 3.5 Système de PIN

- Défini au premier signup (parent ou élève)
- 4 chiffres, stocké en hash bcrypt
- Saisi sur l'app vendeur pour valider un achat
- 3 tentatives échouées → carte `BLOCKED` automatiquement
- **Déblocage** : Admin École uniquement
- **Reset PIN** : élève depuis l'app (avec vérification password)

---

### 3.6 Reversements vendeur

```
1. Vendeur saisit montant + confirme numéro Wave
2. Vérification : VendorWallet.balance >= montant
3. VendorWallet débité immédiatement
4. Paystack Transfer déclenché vers Wave
5. Webhook Paystack :
   transfer.success → Withdrawal SUCCESS + notif vendeur
   transfer.failed  → Rollback VendorWallet + notif vendeur
```

- Le waveNumber est sauvegardé sur le profil Vendor mais confirmé à chaque retrait
- Pas de montant minimum — le vendeur peut retirer tout son solde

---

### 3.7 Notifications

| Type | Destinataire | Déclencheur |
|---|---|---|
| `ORDER_VALIDATED` | Parent + Élève | Commande validée en caisse |
| `ORDER_CANCELLED` | Parent + Élève | Commande annulée par l'élève |
| `ORDER_EXPIRED` | Parent + Élève | Commande non récupérée (cron 23h59) |
| `VENDOR_SUMMARY` | Vendeur | Résumé pré-commandes du lendemain (cron 20h00) |
| `TOPUP_SUCCESS` | Parent + Élève | Recharge confirmée par Paystack |
| `TOPUP_FAILED` | Parent + Élève | Recharge échouée |
| `WITHDRAWAL_SUCCESS` | Vendeur | Reversement Wave reçu |
| `WITHDRAWAL_FAILED` | Vendeur | Reversement échoué, solde recrédité |

---

### 3.8 Gestion des comptes vendeur

```
1. Vendeur s'inscrit via POST /auth/signup/vendor
2. Compte créé avec status = PENDING
3. Admin École / Super Admin est notifié
4. Admin valide → POST /vendors/:id/approve → status = ACTIVE
   ou rejette → POST /vendors/:id/reject → status = REJECTED
5. Vendeur peut maintenant se connecter
```

---

## 4. Schéma de base de données

### Tables

#### School
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | Clé primaire |
| name | string | Nom de l'école |
| sigle | string | Sigle pour génération codes cartes (ex: LYC) |
| address | string | Adresse |
| status | enum | ACTIVE \| SUSPENDED |
| createdAt | timestamp | Date de création |

#### User
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | Clé primaire |
| firstName | string | Prénom |
| lastName | string | Nom |
| phone | string unique | Numéro (nullable si élève créé par parent) |
| passwordHash | string | Mot de passe hashé (nullable si élève créé par parent) |
| role | enum | PARENT \| STUDENT \| VENDOR \| SCHOOL_ADMIN \| SUPER_ADMIN |
| schoolId | uuid FK | École (null pour SUPER_ADMIN) |
| isOnboarded | boolean | false si élève sans password |
| isPhoneVerified | boolean | Prévu pour OTP v2, false par défaut |
| fcmToken | string | Token Firebase push |
| deletedAt | timestamp | Soft delete (null = actif) |
| createdAt | timestamp | — |

#### Card
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | Clé primaire |
| code | string unique | Contenu QR code (index) |
| pinHash | string | PIN 4 chiffres hashé (nullable) |
| pinAttempts | integer | Tentatives échouées (max 3) |
| status | enum | UNASSIGNED \| ACTIVE \| SUSPENDED \| BLOCKED |
| schoolId | uuid FK | École |
| studentId | uuid FK | Élève assigné (nullable) |
| imageUrl | string | URL S3 du QR code |
| createdAt | timestamp | — |

#### Student
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| userId | uuid FK | User (one-to-one) |
| cardId | uuid FK | Card (one-to-one) |
| schoolId | uuid FK | École |
| class | string | Classe (texte libre en v1) |

#### Parent
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| userId | uuid FK | User (one-to-one) |

#### StudentParent (liaison)
| Champ | Type | Description |
|---|---|---|
| studentId | uuid FK | Élève |
| parentId | uuid FK | Parent |
| *Contrainte* | — | Max 2 parents par élève |

#### Vendor
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| userId | uuid FK | User |
| schoolId | uuid FK | École |
| shopName | string | Nom de la boutique |
| waveNumber | string | Numéro Wave (nullable) |
| status | enum | PENDING \| ACTIVE \| SUSPENDED \| REJECTED |
| createdAt | timestamp | — |

#### VendorWallet
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| vendorId | uuid FK | Vendor (one-to-one) |
| balance | integer | Solde en centimes XOF |
| updatedAt | timestamp | — |

#### Wallet
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| studentId | uuid FK | Student (one-to-one) |
| balance | integer | Solde total centimes XOF |
| reserved | integer | Montant réservé (pré-commandes) |

#### Transaction
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| walletId | uuid FK | Wallet |
| type | enum | CREDIT \| DEBIT \| RESERVE \| RELEASE |
| amount | integer | Centimes XOF |
| balanceBefore | integer | Solde avant (audit) |
| balanceAfter | integer | Solde après (audit) |
| orderId | uuid FK | Order liée (nullable) |
| paymentId | uuid FK | Payment Paystack (nullable) |
| createdAt | timestamp | — |

#### Item
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| vendorId | uuid FK | Vendor |
| name | string | Nom du plat |
| price | integer | Prix en centimes XOF |
| description | string | Description (nullable) |
| imageUrl | string | URL S3 (nullable) |
| status | enum | ACTIVE \| INACTIVE |
| createdAt | timestamp | — |

#### Order
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| studentId | uuid FK | Élève |
| vendorId | uuid FK | Vendeur |
| status | enum | PENDING \| VALIDATED \| CANCELLED \| EXPIRED |
| totalAmount | integer | Montant total centimes XOF |
| expiresAt | timestamp | Expiration (jour cible à 23h59) |
| createdAt | timestamp | — |

#### OrderItem
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| orderId | uuid FK | Order |
| itemId | uuid FK | Item |
| quantity | integer | Quantité |
| unitPrice | integer | Prix snapshot au moment de la commande |

#### Payment
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| walletId | uuid FK | Wallet |
| paystackRef | string unique | Référence Paystack (index) |
| amount | integer | Centimes XOF |
| status | enum | PENDING \| SUCCESS \| FAILED |
| initiatedBy | uuid FK | User (parent ou élève) |
| createdAt | timestamp | — |

#### Withdrawal
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| vendorId | uuid FK | Vendor |
| amount | integer | Centimes XOF |
| waveNumber | string | Snapshot numéro Wave au moment de la demande |
| paystackRef | string | Référence Paystack Transfer |
| status | enum | PENDING \| IN_PROGRESS \| SUCCESS \| FAILED |
| createdAt | timestamp | — |

#### Notification
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| userId | uuid FK | Destinataire |
| title | string | Titre |
| body | string | Corps |
| type | enum | ORDER_VALIDATED \| ORDER_CANCELLED \| ORDER_EXPIRED \| VENDOR_SUMMARY \| TOPUP_SUCCESS \| TOPUP_FAILED \| WITHDRAWAL_SUCCESS \| WITHDRAWAL_FAILED |
| data | jsonb | Metadata (orderId, amount...) |
| isRead | boolean | false par défaut |
| sentAt | timestamp | Date d'envoi |
| createdAt | timestamp | — |

#### OTP
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| phone | string | Numéro de téléphone |
| code | string | Code 6 chiffres |
| type | enum | PHONE_VERIFICATION \| PASSWORD_RESET |
| expiresAt | timestamp | Expiration (5 min) |
| isUsed | boolean | false par défaut |
| createdAt | timestamp | — |

#### RefreshToken
| Champ | Type | Description |
|---|---|---|
| id | uuid PK | — |
| userId | uuid FK | User |
| tokenHash | string | Hash du token (jamais le token brut) |
| expiresAt | timestamp | Expiration (30 jours) |
| isRevoked | boolean | false par défaut |
| revokedAt | timestamp | Date révocation (nullable) |
| createdAt | timestamp | — |

---

## 5. Architecture des modules NestJS

```
src/
  common/
    decorators/        @CurrentUser(), @Role()
    guards/            JwtAuthGuard, RolesGuard
    filters/           GlobalExceptionFilter
    interceptors/      ResponseInterceptor
    swagger/           ApiSuccessResponse, ErrorMessages

  config/
    database.config.ts
    paystack.config.ts
    jwt.config.ts
    app.config.ts
    firebase.config.ts

  database/
    migrations/
    seeds/

  modules/
    auth/
    users/
    schools/
    cards/
    students/
    parents/
    vendors/
    wallets/
    items/
    orders/
    payments/
      paystack/        wrapper Paystack API
    withdrawals/
    notifications/
      schedulers/
        vendor-summary.scheduler.ts   cron 20h00
        order-expiry.scheduler.ts     cron 23h59

  app.module.ts
  main.ts
  data-source.ts
```

---

## 6. API — Endpoints

> Toutes les modifications utilisent `PUT` (pas `PATCH`)

### 6.1 Auth

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /auth/scan-card | Public | Vérifie état carte + student + parents |
| POST | /auth/signup/parent | Public | Inscription parent (carte UNASSIGNED) |
| POST | /auth/signup/student | Public | Inscription élève (carte UNASSIGNED) |
| POST | /auth/signup/parent/add | Public | 2ème parent, compte inexistant |
| POST | /auth/signup/parent/link | Public | Parent existant rejoint un élève |
| POST | /auth/signup/vendor | Public | Inscription vendeur (status=PENDING) |
| POST | /auth/onboard/student | Public | Élève créé par parent définit son password |
| POST | /auth/signin | Public | Connexion tous rôles |
| POST | /auth/refresh | Public | Renouvellement JWT |
| POST | /auth/signout | JWT | Révocation refreshToken |
| POST | /auth/otp/send | Public | Envoi OTP SMS (désactivé v1) |
| POST | /auth/otp/verify | Public | Vérification OTP (désactivé v1) |
| POST | /auth/otp/resend | Public | Renvoi OTP (désactivé v1) |
| POST | /auth/password/forgot | Public | Mot de passe oublié |
| POST | /auth/password/reset | Public | Reset mot de passe via OTP |

### 6.2 Cards

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /cards/bulk | SUPER_ADMIN | Génère lot cartes + QR + S3 |
| GET | /cards | SUPER_ADMIN | Liste toutes les cartes |
| GET | /cards/:code | SCHOOL_ADMIN, SUPER_ADMIN | Détail carte + élève + wallet |
| PUT | /cards/:code/suspend | SCHOOL_ADMIN, SUPER_ADMIN | Suspendre carte |
| PUT | /cards/:code/activate | SCHOOL_ADMIN, SUPER_ADMIN | Réactiver carte |
| PUT | /cards/:code/replace | SCHOOL_ADMIN, SUPER_ADMIN | Remplacer carte perdue |
| POST | /cards/:code/verify-pin | VENDOR | Vérifier PIN (incrémente tentatives) |
| PUT | /cards/:code/reset-pin | STUDENT | Reset PIN avec vérification password |

### 6.3 Schools

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /schools | SUPER_ADMIN | Créer une école |
| POST | /schools/:id/admin | SUPER_ADMIN | Créer Admin École |
| GET | /schools | SUPER_ADMIN | Liste toutes les écoles |
| GET | /schools/:id | SCHOOL_ADMIN, SUPER_ADMIN | Détail école |
| PUT | /schools/:id | SUPER_ADMIN | Modifier école |
| PUT | /schools/:id/suspend | SUPER_ADMIN | Suspendre école |
| PUT | /schools/:id/activate | SUPER_ADMIN | Réactiver école |
| GET | /schools/:id/vendors | SCHOOL_ADMIN, SUPER_ADMIN | Vendeurs de l'école |
| GET | /schools/:id/students | SCHOOL_ADMIN, SUPER_ADMIN | Élèves de l'école |
| GET | /schools/:id/parents | SCHOOL_ADMIN, SUPER_ADMIN | Parents de l'école |
| GET | /schools/:id/transactions | SCHOOL_ADMIN, SUPER_ADMIN | Flux financiers |
| GET | /schools/:id/stats | SCHOOL_ADMIN, SUPER_ADMIN | CA, volume, stats |

### 6.4 Students

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| GET | /students | SCHOOL_ADMIN, SUPER_ADMIN | Liste élèves |
| GET | /students/:id | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Profil élève |
| PUT | /students/:id | STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Modifier profil |
| GET | /students/:id/orders | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Historique commandes |
| GET | /students/:id/transactions | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Historique wallet |

### 6.5 Parents

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| GET | /parents | SCHOOL_ADMIN, SUPER_ADMIN | Liste parents |
| GET | /parents/:id | PARENT, SCHOOL_ADMIN, SUPER_ADMIN | Profil parent |
| PUT | /parents/:id | PARENT, SUPER_ADMIN | Modifier profil |
| GET | /parents/:id/students | PARENT, SCHOOL_ADMIN, SUPER_ADMIN | Élèves liés |

### 6.6 Vendors

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| GET | /vendors | SCHOOL_ADMIN, SUPER_ADMIN | Liste vendeurs |
| GET | /vendors/:id | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Profil vendeur |
| PUT | /vendors/:id | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Modifier profil |
| DELETE | /vendors/:id | SCHOOL_ADMIN, SUPER_ADMIN | Soft delete |
| POST | /vendors/:id/approve | SCHOOL_ADMIN, SUPER_ADMIN | Valider compte vendeur |
| POST | /vendors/:id/reject | SCHOOL_ADMIN, SUPER_ADMIN | Rejeter compte vendeur |
| GET | /vendors/:id/orders | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Historique commandes |
| GET | /vendors/:id/withdrawals | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Historique reversements |
| GET | /vendors/:id/balance | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Solde disponible |

### 6.7 Wallets

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| GET | /wallets/:studentId | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Solde wallet |
| GET | /wallets/:studentId/transactions | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Historique mouvements |
| POST | /wallets/:studentId/topup | PARENT, STUDENT | Initier recharge Paystack |

### 6.8 Payments

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /payments/webhook | Public (signature HMAC) | Webhook Paystack |
| GET | /payments/:id | PARENT, STUDENT, SCHOOL_ADMIN, SUPER_ADMIN | Détail paiement |
| GET | /payments | SCHOOL_ADMIN, SUPER_ADMIN | Liste paiements |

### 6.9 Items

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /items | VENDOR | Créer un plat |
| POST | /items/upload-image | VENDOR | Upload image plat → S3 |
| GET | /items | Tous | Catalogue (filtres: vendorId, status) |
| GET | /items/:id | Tous | Détail plat |
| PUT | /items/:id | VENDOR | Modifier plat |

### 6.10 Orders

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /orders | STUDENT, PARENT | Créer pré-commande |
| GET | /orders | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Liste commandes |
| GET | /orders/summary | VENDOR | Résumé lendemain par plat |
| GET | /orders/by-card/:cardCode | VENDOR | Commandes PENDING du jour pour cet élève |
| GET | /orders/:id | STUDENT, PARENT, VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Détail commande |
| PUT | /orders/:id/cancel | STUDENT | Annuler commande PENDING |
| POST | /orders/:id/validate | VENDOR | Valider commande (PIN + débit atomique) |

### 6.11 Withdrawals

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| POST | /withdrawals | VENDOR | Demande reversement Wave |
| GET | /withdrawals | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Liste reversements |
| GET | /withdrawals/:id | VENDOR, SCHOOL_ADMIN, SUPER_ADMIN | Détail reversement |

### 6.12 Notifications

| Méthode | Endpoint | Rôles | Description |
|---|---|---|---|
| GET | /notifications | PARENT, STUDENT, VENDOR | Mes notifications |
| PUT | /notifications/:id/read | PARENT, STUDENT, VENDOR | Marquer comme lue |
| PUT | /notifications/read-all | PARENT, STUDENT, VENDOR | Tout marquer comme lu |

---

## 7. Découpage des tâches Claude Code

### Sprint 0 — Setup projet

| ID | Tâche | Détails |
|---|---|---|
| TASK-001 | Initialiser projet NestJS | CLI, ESLint, Prettier, tsconfig, toutes les dépendances |
| TASK-002 | Configurer Docker | docker-compose (PostgreSQL + pgAdmin), Dockerfile, Makefile |
| TASK-003 | Configurer environnement | data-source.ts, tous les config factories, validation Joi |
| TASK-004 | Configurer les communs | GlobalExceptionFilter, ResponseInterceptor, Guards, Decorators, Swagger |

### Sprint 1 — Entités et migrations

| ID | Tâche | Détails |
|---|---|---|
| TASK-005 | Créer toutes les entités TypeORM | 18 entités : School, User, Student, Parent, StudentParent, Vendor, VendorWallet, Card, Wallet, Transaction, Item, Order, OrderItem, Payment, Withdrawal, Notification, OTP, RefreshToken |
| TASK-006 | Migration initiale | Une seule migration, vérifier indexes et contraintes |

### Sprint 2 — Auth

| ID | Tâche | Détails |
|---|---|---|
| TASK-007 | POST /auth/scan-card | État carte + student + parents, tests e2e |
| TASK-008 | POST /auth/signup/parent | Transaction DB complète, JWT + refreshToken, tests e2e |
| TASK-009 | POST /auth/signup/student | Transaction DB complète, JWT + refreshToken, tests e2e |
| TASK-010 | POST /auth/signup/parent/add | Vérifier carte ACTIVE + parents < 2, tests e2e |
| TASK-011 | POST /auth/signup/parent/link | Parent existant, créer StudentParent, tests e2e |
| TASK-012 | POST /auth/signup/vendor | User PENDING + Vendor + VendorWallet, tests e2e |
| TASK-013 | POST /auth/onboard/student | isOnboarded=false, set password, tests e2e |
| TASK-014 | POST /auth/signin | Credentials, JWT + refreshToken, fcmToken, tests e2e |
| TASK-015 | POST /auth/refresh | Vérifier refreshToken, nouveau JWT, tests e2e |
| TASK-016 | POST /auth/signout | Révoquer refreshToken, tests e2e |
| TASK-017 | OTP + Password reset | Désactivé v1 via flag OTP_ENABLED, tous les endpoints, tests e2e |

### Sprint 3 — Cards

| ID | Tâche | Détails |
|---|---|---|
| TASK-018 | POST /cards/bulk | Génération codes, QR code, upload S3, bulk insert, tests e2e |
| TASK-019 | GET /cards + GET /cards/:code | Tests e2e |
| TASK-020 | PUT /cards/:code/suspend + activate | Tests e2e |
| TASK-021 | PUT /cards/:code/replace | Désactiver ancienne, transférer student + wallet, tests e2e |
| TASK-022 | POST /cards/:code/verify-pin | Vérifier hash, incrémenter tentatives, BLOCKED si 3 échecs, tests e2e |
| TASK-023 | PUT /cards/:code/reset-pin | Vérifier password, reset pin + tentatives, tests e2e |

### Sprint 4 — Schools

| ID | Tâche | Détails |
|---|---|---|
| TASK-024 | POST /schools + POST /schools/:id/admin | Tests e2e |
| TASK-025 | GET/PUT/suspend/activate schools | Tests e2e |
| TASK-026 | GET /schools/:id/vendors|students|parents | Pagination, tests e2e |
| TASK-027 | GET /schools/:id/transactions + stats | Agrégations, filtres date, tests e2e |

### Sprint 5 — Vendors

| ID | Tâche | Détails |
|---|---|---|
| TASK-028 | POST /vendors/:id/approve + reject | Notification vendeur, tests e2e |
| TASK-029 | GET/PUT/DELETE /vendors | Tests e2e |
| TASK-030 | GET /vendors/:id/orders|withdrawals|balance | Tests e2e |

### Sprint 6 — Students + Parents

| ID | Tâche | Détails |
|---|---|---|
| TASK-031 | GET/PUT /students + GET /students | Tests e2e |
| TASK-032 | GET /students/:id/orders + transactions | Pagination, tests e2e |
| TASK-033 | GET/PUT /parents + GET /parents/:id/students | Tests e2e |

### Sprint 7 — Items

| ID | Tâche | Détails |
|---|---|---|
| TASK-034 | POST/GET/PUT /items | Tests e2e |
| TASK-035 | POST /items/upload-image | Multer, validation, S3, tests e2e |

### Sprint 8 — Wallets + Payments

| ID | Tâche | Détails |
|---|---|---|
| TASK-036 | GET /wallets/:studentId + transactions | Tests e2e |
| TASK-037 | POST /wallets/:studentId/topup | Initier Paystack, Payment PENDING, tests e2e |
| TASK-038 | POST /payments/webhook | Signature HMAC, idempotence, handlers charge + transfer, tests e2e |
| TASK-039 | GET /payments/:id + /payments | Tests e2e |

### Sprint 9 — Orders

| ID | Tâche | Détails |
|---|---|---|
| TASK-040 | POST /orders | Fenêtre horaire, vérif available, snapshot prix, reserved++, tests e2e |
| TASK-041 | GET /orders/by-card/:cardCode | VENDOR, commandes PENDING du jour, tests e2e |
| TASK-042 | PUT /orders/:id/cancel | Libérer reserved, notification, tests e2e |
| TASK-043 | POST /orders/:id/validate | PIN + transaction atomique + débit + VendorWallet + notification, tests e2e |
| TASK-044 | GET /orders + summary + :id | Tests e2e |

### Sprint 10 — Withdrawals

| ID | Tâche | Détails |
|---|---|---|
| TASK-045 | POST /withdrawals | Vérif balance, débit VendorWallet, Paystack Transfer, tests e2e |
| TASK-046 | GET /withdrawals + :id | Tests e2e |

### Sprint 11 — Notifications + Schedulers

| ID | Tâche | Détails |
|---|---|---|
| TASK-047 | NotificationsService | Créer en DB + push FCM + fire-and-forget, tests e2e |
| TASK-048 | GET/PUT /notifications | Tests e2e |
| TASK-049 | order-expiry.scheduler | Cron 23h59, expirer PENDING, libérer reserved, notifier, tests |
| TASK-050 | vendor-summary.scheduler | Cron 20h00, résumé lendemain par plat, notifier vendeurs, tests |

---

### Récapitulatif

| Sprint | Domaine | Tâches |
|---|---|---|
| Sprint 0 | Setup | 4 |
| Sprint 1 | Migrations | 2 |
| Sprint 2 | Auth | 11 |
| Sprint 3 | Cards | 6 |
| Sprint 4 | Schools | 4 |
| Sprint 5 | Vendors | 3 |
| Sprint 6 | Students / Parents | 3 |
| Sprint 7 | Items | 2 |
| Sprint 8 | Wallets / Payments | 4 |
| Sprint 9 | Orders | 5 |
| Sprint 10 | Withdrawals | 2 |
| Sprint 11 | Notifications | 4 |
| **Total** | | **50 tâches** |

---

*Document généré le 12 avril 2026 — Grand Frère v1.0*
