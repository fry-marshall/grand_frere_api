# Plan Sprints — App Vendeur Grand Frère

## Vision générale

L'app vendeur couvre 4 flux principaux :

1. **Auth** (signup + approbation en attente)
2. **Cashin** (encaissement commandes — cœur du produit)
3. **Gestion** (commandes, menu, balance, retraits)
4. **Support** (notifications, profil, temps réel)

---

## Sprint 1 — Foundation & Auth

**Objectif** : L'app démarre, le vendeur peut s'inscrire et se connecter.

**Briques :**
- Setup Flutter + BLoC + Dio + routing (GoRouter) + DI (GetIt)
- Client API avec intercepteur JWT (auto-refresh via `POST /auth/refresh`)
- Stockage token sécurisé (`flutter_secure_storage`)

**Écrans :**
- Splash + onboarding
- Signup vendeur (`POST /auth/signup/vendor`) — avec sélection école (`GET /schools`)
- Login (`POST /auth/signin`)
- Forgot password → OTP → Reset (`POST /auth/forgot-password` → `POST /auth/reset-password`)
- Écran "En attente d'approbation" (status `PENDING`)

**Endpoints :** `GET /schools`, `POST /auth/signup/vendor`, `POST /auth/signin`, `POST /auth/refresh`, `POST /auth/signout`, `POST /auth/forgot-password`, `POST /auth/reset-password`

**Test :** Inscription → affichage écran pending → login après approbation → redirection home

---

## Sprint 2 — Shell + Dashboard

**Objectif** : Navigation de base + KPIs du jour affichés.

**Briques :**
- Bottom nav (Accueil / Commandes / Menu / Compte)
- Chargement profil vendeur au login (`GET /vendors/:id`)
- KPIs dashboard (`GET /vendors/:id/stats`)

**Écrans :**
- Home/Dashboard : `todayOrderCount`, `todayRevenue`, `cashToCollect`
- Affichage solde wallet (`GET /vendors/:id/balance`)

**Endpoints :** `GET /vendors/:id`, `GET /vendors/:id/stats`, `GET /vendors/:id/balance`

**Test :** Après login → dashboard avec les 3 KPIs corrects (vérifier avec données API réelles)

---

## Sprint 3 — Cashin (cœur métier)

**Objectif** : Le flux d'encaissement fonctionne entièrement, les 2 modes.

**Briques :**
- Entry point cashin (bouton home ou FAB)
- **Mode scan carte** : QR scanner → `POST /auth/scan-card` → `GET /orders/by-card` → preview → `PUT /orders/:id/complete`
- **Mode code court** : saisie 4 chiffres → `GET /orders/by-code` → preview → `PUT /orders/:id/complete`
- Écran preview commande (items, montant, élève, méthode paiement)
- Écran succès encaissement

**Endpoints :** `POST /auth/scan-card`, `GET /orders/by-card`, `GET /orders/by-code`, `PUT /orders/:id/complete`

**Test :**
- Scanner une carte avec commande `VALIDATED` → prévisualisation → encaissement → statut passe `COMPLETED`
- Saisir un code à 4 chiffres → même flow
- Scanner carte sans commande → message "Aucune commande en attente"

---

## Sprint 4 — Gestion commandes + WebSocket

**Objectif** : Liste des commandes en temps réel, validation et annulation.

**Briques :**
- Liste commandes paginée (`GET /vendors/:id/orders`) avec tabs `PENDING` / `VALIDATED` / `COMPLETED`
- Détail commande (`GET /orders/:id`)
- Valider commande `PENDING` → `VALIDATED` (`PUT /orders/:id/validate`)
- Annuler commande `PENDING` (`PUT /orders/:id/cancel`)
- **WebSocket** : connexion Socket.IO, écoute `order.created` → refresh liste auto

**Endpoints :** `GET /vendors/:id/orders`, `GET /orders/:id`, `PUT /orders/:id/validate`, `PUT /orders/:id/cancel`, WS `order.created`

**Test :**
- Depuis une autre session (app parent/admin), créer une commande → elle apparaît en temps réel dans l'onglet PENDING
- Valider → passe VALIDATED
- Annuler → disparaît des actives

---

## Sprint 5 — Menu (gestion des articles)

**Objectif** : Le vendeur gère son catalogue.

**Briques :**
- Liste articles (`GET /items` — filtrée par vendeur)
- Ajouter article (`POST /items/vendor/:vendorId`)
- Modifier article (`PUT /items/:id`)
- Activer/désactiver (`PUT /items/:id` avec `status`)
- Supprimer (`DELETE /items/:id`)
- Upload image (`PUT /items/:id/image` — `multipart/form-data`)

**Endpoints :** `GET /items`, `POST /items/vendor/:vendorId`, `PUT /items/:id`, `DELETE /items/:id`, `PUT /items/:id/image`

**Test :** Ajouter un article → apparaît dans la liste → le désactiver → n'apparaît plus dans `GET /vendors/:id/items` (vue élève) → uploader une image

---

## Sprint 6 — Balance & Retraits

**Objectif** : Le vendeur visualise son solde et demande des retraits.

**Briques :**
- Écran balance avec historique retraits (`GET /vendors/:id/withdrawals`)
- Formulaire retrait (`POST /withdrawals/vendor/:vendorId`)
- Statut retrait (PENDING → IN_PROGRESS → SUCCESS)

**Endpoints :** `GET /vendors/:id/balance`, `GET /vendors/:id/withdrawals`, `POST /withdrawals/vendor/:vendorId`

**Test :** Solde affiché → demande retrait → apparaît dans historique avec statut PENDING

---

## Sprint 7 — Notifications & Profil

**Objectif** : Cloche notifs + édition profil.

**Briques :**
- Liste notifications avec badge non-lues (`GET /notifications`)
- Marquer lue / tout lire (`PUT /notifications/:id/read`, `PUT /notifications/read-all`)
- Profil vendeur — éditer (`PUT /vendors/:id`) : shopName, waveNumber, openingTime, closingTime
- Changer mot de passe (`PUT /auth/change-password`)

**Endpoints :** `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `PUT /vendors/:id`, `PUT /auth/change-password`

**Test :** Compléter une commande depuis une autre session → notification `ORDER_COMPLETED` apparaît → marquée lue → badge disparaît

---

## Sprint 8 — Push Notifications & Polish

**Objectif** : FCM + états vides/erreur + UX final.

**Briques :**
- Intégration Firebase FCM (`PUT /auth/fcm-token`)
- Deep linking notifs push → bon écran
- WS `order.updated` → màj statut commande en temps réel
- Gestion déconnexion / token expiré
- Pull-to-refresh, loading skeletons, empty states, error states

**Test :** App en background → commande complétée → push reçu → tap → ouvre le bon écran

---

## Résumé

| Sprint | Focus | Durée estimée |
|--------|-------|---------------|
| S1 | Auth | 1–2 jours |
| S2 | Shell + Dashboard | 1 jour |
| S3 | **Cashin** (core) | 2–3 jours |
| S4 | Commandes + WebSocket | 2 jours |
| S5 | Menu | 1–2 jours |
| S6 | Balance + Retraits | 1 jour |
| S7 | Notifs + Profil | 1 jour |
| S8 | FCM + Polish | 1–2 jours |

> S3 est le sprint le plus critique — c'est le flux que le vendeur utilise à chaque transaction. À tester à fond avant de passer à S4.
