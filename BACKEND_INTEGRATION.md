# Documentation d'Intégration Frontend-Backend : Plateforme Vidéo (Hackathon Patreon)

Ce document décrit l'architecture d'intégration entre le frontend React (Vite) et le backend. Il détaille les interactions, les endpoints API, les flux de données et la gestion des états.

## 1. Interactions Frontend-Backend

Voici les actions utilisateur principales et les requêtes API déclenchées correspondantes.

### Affichage et Consultation
| Action Utilisateur | Requête API | Description |
|-------------------|-------------|-------------|
| **Chargement Accueil** | `GET /api/videos` | Récupère la liste des vidéos (populaires/récentes). Supporte les filtres (gratuit, premium, catégorie). |
| **Recherche** | `GET /api/videos?q={query}` | Recherche full-text sur les titres et descriptions. |
| **Clic sur une vidéo** | `GET /api/videos/{id}` | Récupère les détails d'une vidéo (URL de stream, métadonnées, statut de verrouillage). |
| **Voir profil créateur** | `GET /api/creators/{id}` | Récupère les infos du créateur (bio, stats) et ses vidéos publiques. |

### Actions Transactionnelles
| Action Utilisateur | Requête API | Description |
|-------------------|-------------|-------------|
| **Débloquer vidéo** | `POST /api/transactions/unlock` | Initie l'achat d'une vidéo à l'unité. Renvoie le succès et met à jour les droits. |
| **S'abonner** | `POST /api/subscriptions` | Souscrit un abonnement à un créateur. |
| **Like / Favoris** | `POST /api/videos/{id}/react` | Envoie une interaction sociale (like, save). |

### Gestion Créateur & Utilisateur
| Action Utilisateur | Requête API | Description |
|-------------------|-------------|-------------|
| **Upload Vidéo** | `POST /api/videos/upload` | Envoi du fichier vidéo et des métadonnées (multipart/form-data). |
| **Voir Dashboard** | `GET /api/creators/me/stats` | Récupère les vues, revenus et abonnés du créateur connecté. |
| **Profil Utilisateur** | `GET /api/users/me` | Récupère l'historique, les vidéos débloquées et les abonnements actifs. |

---

## 2. Mapping Écrans - Endpoints

Détail des appels API par écran du frontend (`src/App.tsx`).

### A. Écran d'Accueil (`Home`)
*   **Endpoint** : `GET /api/videos`
*   **Paramètres** :
    *   `filter`: `all` | `free` | `premium`
    *   `category`: `tech` | `art` | etc.
*   **Réponse** : Liste d'objets `VideoPreview` (id, title, thumbnail, creatorName, isFree, price).
*   **Usage Front** : Remplissage de la grille de vidéos. Les badges "Gratuit/Premium" sont affichés selon `isFree`.

### B. Écran Détail Vidéo (`VideoPlayer`)
*   **Endpoint 1** : `GET /api/videos/{id}`
    *   **Réponse** : Objet `VideoDetail` complet.
    *   **Champs clés** : `streamUrl` (si accès ok), `isLocked` (bool), `price`, `description`.
*   **Endpoint 2 (si verrouillé)** : `GET /api/videos/{id}/preview`
    *   **Réponse** : Teaser ou extrait gratuit (optionnel).
*   **Usage Front** :
    *   Si `isLocked === true` : Affiche l'overlay de paiement ("Débloquer pour 5€").
    *   Si `isLocked === false` : Affiche le lecteur vidéo avec `streamUrl`.

### C. Profil Créateur (`CreatorProfile`)
*   **Endpoint 1** : `GET /api/creators/{handle}`
    *   **Réponse** : Info créateur (avatar, bio, stats abonnés).
*   **Endpoint 2** : `GET /api/creators/{handle}/videos`
    *   **Réponse** : Liste des vidéos de ce créateur spécifique.
*   **Usage Front** : Affiche le header du profil et la grille de contenu filtrée par ce créateur. Bouton "S'abonner" change d'état selon `isSubscribed` dans la réponse.

### D. Dashboard Créateur (`Dashboard`)
*   **Endpoint** : `GET /api/creators/me/dashboard`
*   **Réponse** :
    *   `stats`: { views, revenue, subscribers }
    *   `recentUploads`: Liste des dernières vidéos avec statut (processing, published).
*   **Usage Front** : Affiche les graphiques de revenus et la table de gestion des vidéos.

### E. Upload de Vidéo (`UploadModal`)
*   **Endpoint** : `POST /api/videos`
*   **Body** : `FormData` (file, title, description, price, isFree).
*   **Réponse** : `201 Created` avec l'ID de la vidéo.
*   **Usage Front** : Affiche une barre de progression, puis un toast de succès "Vidéo en ligne".

---

## 3. Flux Complets (User Flows)

### Parcours Utilisateur : Débloquer une vidéo payante
1.  **Navigation** : L'utilisateur clique sur une vidéo Premium sur la Home.
2.  **Appel API** : `GET /api/videos/123`.
3.  **Réponse Backend** : `{ id: 123, isLocked: true, price: 500, ... }`.
4.  **Interface** : Le player affiche un cadenas et le bouton "Débloquer (5.00€)".
5.  **Action** : L'utilisateur clique sur "Débloquer".
6.  **Appel API** : `POST /api/transactions/unlock` avec `{ videoId: 123 }`.
7.  **Traitement Backend** : Vérification solde/carte -> Débit -> Enregistrement du droit d'accès -> Retour `200 OK`.
8.  **Mise à jour Front** :
    *   L'état local `unlockedVideos` est mis à jour.
    *   Nouvel appel `GET /api/videos/123` (ou usage des données renvoyées) qui retourne maintenant `{ isLocked: false, streamUrl: "..." }`.
9.  **Résultat** : La vidéo se lance.

### Parcours Créateur : Upload de contenu
1.  **Navigation** : Clic sur "Créer" -> "Upload".
2.  **Formulaire** : Sélection du fichier, titre "Mon Tuto", prix "2€".
3.  **Action** : Clic sur "Publier".
4.  **Appel API** : `POST /api/videos` (Multipart).
5.  **Backend** :
    *   Upload du fichier sur le stockage (S3/GCS).
    *   Création de l'entrée en BDD avec statut `PROCESSING`.
    *   Déclenchement du transcodage.
6.  **Interface** : Notification "Upload réussi, traitement en cours".
7.  **Mise à jour** : Le Dashboard affiche la nouvelle vidéo en statut "En traitement".

---

## 4. Synchronisation des États

Comment le frontend reste cohérent avec le backend.

### Authentification & Utilisateur Courant
*   Au chargement de l'app (`App.tsx`), un appel `GET /api/auth/me` est effectué.
*   Il retourne l'objet utilisateur : `{ id, name, role: 'user'|'creator', walletBalance }`.
*   Cet état est stocké dans un Context React global (`AuthContext`) pour être accessible partout (Header, Profile, Guards).

### Gestion des Droits (Gratuit vs Payant)
*   **Approche Hybride** :
    1.  **Liste Globale** : L'objet utilisateur contient une liste légère des IDs débloqués : `unlockedVideoIds: [10, 45, 99]`.
    2.  **Vérification à la volée** : Chaque objet vidéo contient un booléen calculé par le backend : `currentUserHasAccess: true/false`.
*   **Logique Front** :
    ```javascript
    const canWatch = video.isFree || user.unlockedVideoIds.includes(video.id);
    ```
    *(Note : La sécurité réelle est côté backend, qui ne renvoie l'URL du stream que si le droit est valide).*

### Abonnements
*   Le bouton "S'abonner" reflète l'état `isSubscribed` renvoyé par `GET /api/creators/{id}`.
*   Lors du clic, l'état est mis à jour optimistement (Optimistic UI) en attendant la réponse 200 du backend.

---

## 5. Cohérence Globale

Points de vérification pour l'intégration.

*   **Sécurité des URLs** : Les URLs de vidéo (`streamUrl`) doivent être signées ou temporaires. Le frontend ne doit jamais pouvoir deviner l'URL d'une vidéo payante sans l'avoir achetée.
*   **Gestion des Erreurs** :
    *   401 Unauthorized -> Redirection vers Login.
    *   403 Forbidden -> Affichage de la modale de paiement.
    *   404 Not Found -> Page 404 personnalisée.
*   **Format des Prix** : Le backend envoie les prix en centimes (ex: `500` pour 5.00€) pour éviter les erreurs d'arrondi flottant. Le frontend formate l'affichage.
*   **Images** : Les URLs des thumbnails sont absolues ou relatives à un CDN configuré dans les variables d'environnement du frontend (`VITE_API_URL`).

