# AI Reference - Suivre (SuiFan)

## 1. Objectif du projet

Suivre (nom UI: **SuiFan**) est une dApp React + TypeScript sur Sui qui permet:
- de creer un profil createur on-chain,
- de publier des contenus videos chiffres,
- de gerer des abonnements mensuels,
- de dechiffrer les videos uniquement pour les abonnes valides.

Stack metier:
- **Sui**: stockage des objets metier (Creator, Content, Subscription), execution des transactions.
- **Move**: logique smart contract (`content_creator`).
- **Walrus**: stockage du payload chiffre des videos.
- **Seal**: chiffrement/dechiffrement et controle d'acces via `seal_approve`.

## 2. Vue d'ensemble de l'architecture

### Frontend
- Framework: React 18 + Vite + TypeScript strict.
- Routing: `react-router-dom`.
- Data fetching/caching: `@tanstack/react-query`.
- Wallet + client Sui: `@mysten/dapp-kit`, `@mysten/sui`.
- Chiffrement: `@mysten/seal`.
- UI: composants maison dans `src/ui`, styles Tailwind + CSS custom.

### On-chain
- Package Move: `sui_fan::content_creator`.
- Objets principaux:
  - `AllCreators`
  - `ContentCreator`
  - `CreatorCap`
  - `Content`
  - `Subscription`

### Flux principal
1. Wallet connecte.
2. Liste des createurs chargee depuis `AllCreators` + dynamic fields.
3. Publication:
   - video chiffree via Seal,
   - blob envoye a Walrus,
   - tx Move `upload_content`.
4. Abonnement:
   - tx Move `subscribe` avec paiement (MIST).
5. Lecture:
   - verification abonnement utilisateur,
   - recuperation blob chiffre Walrus,
   - appel policy Move `seal_approve`,
   - decrypt + lecture video.

## 3. Arborescence utile

```text
src/
  config/
  hooks/
  mappers/
  pages/
  providers/
  router/
  services/
  styles/
  types/
  ui/
  utils/
move/
```

## 4. Entree application et providers

### `src/main.tsx`
- Monte l'app React.
- Injecte `AppProviders` autour de `App`.

### `src/App.tsx`
- Rend `RootRouter` uniquement.

### `src/providers/AppProviders.tsx`
- Cree un `QueryClient` React Query global.
- Configure `SuiClientProvider` avec reseaux `testnet` et `mainnet`.
- Active `WalletProvider autoConnect`.
- Source des RPC:
  - env `VITE_SUI_TESTNET_RPC_URL`, `VITE_SUI_MAINNET_RPC_URL`,
  - sinon proxy Vite en dev, fullnode officiel en prod.

## 5. Routing et orchestration ecrans

### `src/router/RootRouter.tsx`
- Routes top-level:
  - `/` -> `LandingPage`
  - `/app/*` -> `AppShell`

### `src/router/AppShell.tsx`
Responsabilites:
- Gate wallet:
  - `connecting` -> spinner,
  - wallet absent -> `ConnectWalletPage`.
- Etat utilisateur frontend (`currentUser`) derive de l'adresse wallet.
- Detection profil createur via presence de `CreatorCap` dans les objets wallet.
- Derive `isSubscribedGlobal` depuis `useUserSubscriptions`.
- Header principal + navigation interne.
- `goToCreator` accepte:
  - objet createur (navigation avec state),
  - string (considere comme `creatorId`, navigation directe).

### `src/router/AppRoutes.tsx`
Routes metier:
- `/app` -> `HomePage`
- `/app/creator/:id` -> `CreatorRouteWrapper`
- `/app/content/:id` -> `ContentRouteWrapper`
- `/app/publish` -> `PublishRouteWrapper`
- `/app/create-profile` -> `CreateCreatorPage`
- `/app/account` -> `AccountPage`
- `/app/video/:id` -> `VideoRouteWrapper` (legacy mock)

### `src/router/CreatorRouteWrapper.tsx`
- Resolve le createur actif via priorite:
  1. `location.state.premappedCreator`
  2. `location.state.creator` (mappe)
  3. fetch direct via `useGetCreatorById(id)`
- Gere abonnement:
  - action `subscribeToCreator`
  - `refetchSubscriptions`
- Navigation vers detail contenu en passant `{content, creatorId}` en `location.state`.

### `src/router/ContentRouteWrapper.tsx`
- Verifie que `location.state.content` existe.
- Sinon message d'acces indirect impossible.
- Rend `ContentDetailPage`.

### `src/router/PublishRouteWrapper.tsx`
- Adapte `handleUpload` pour `PublishContentPage`.
- Appelle `usePublishContentTx.publishContent`.
- Affiche toast succes temporaire.

### `src/router/VideoRouteWrapper.tsx`
- Flux mock legacy (utilise `mockApi`).
- Pas connecte au pipeline Walrus/Seal/Move principal.

## 6. Configuration metier

### `src/config/chain.ts`
- `CONTENT_CREATOR_PACKAGE_ID`
- `ALL_CREATOR_OBJECT_ID`
- Valeurs par defaut si env non definies.

### `src/config/storage.ts`
Centralise config Walrus/Seal:
- `SEAL_SERVER_OBJECT_IDS`
- `SEAL_KEY_THRESHOLD`
- `SEAL_VERIFY_KEY_SERVERS`
- `WALRUS_PUBLISHER_BASE_URL`
- `WALRUS_AGGREGATOR_BASE_URL`
- Helpers:
  - `buildWalrusPublisherPutBlobUrl(epochs)`
  - `buildWalrusAggregatorBlobUrls(blobId)`
- Normalise les base URLs (enleve trailing slash, evite `/v1` double).

## 7. Types metier

### `src/types/creators.ts`
- `ContentCreator`: forme frontend d'un createur on-chain.

### `src/types/content.ts`
- `CreatorContent`: metadonnees d'un contenu video.

### `src/types/subscriptions.ts`
- `UserSubscription`: abonnement utilisateur.

### `src/types/domain.ts`
- Types UI legacy/hybrides: `Video`, `Creator`, `User`, `DashboardStats`.

## 8. Utils partagees

### `src/utils/sui/objectParsing.ts`
- `getObjectFields(value)`:
  - extrait `fields` de structures Sui JSON-RPC.
- `extractObjectId(value)`:
  - resolve robustement un ObjectId (`0x...`) dans des structures imbriquees.

### `src/utils/sui/rpcRetry.ts`
- `withRpcRetry(operation, label)`:
  - retry exponentiel sur erreurs 429/rate-limit/fetch.

### `src/utils/sui/mutateAsync.ts`
- `mutateAsync(mutate, variables)`:
  - transforme API callback (`onSuccess/onError`) en Promise `await`.

### `src/utils/sui/amount.ts`
- `parseSuiToMist(string)`:
  - conversion decimal SUI -> `bigint` MIST (precision 9 decimales).
- `formatMistToSui(value, maxDecimals)`:
  - conversion inverse pour affichage.

### `src/utils/contentRef.ts`
- Encode/decode d'une reference composee:
  - format: `blobId::enc::encryptedId`.

### `src/utils/walrus.ts`
- `normalizeWalrusBlobId(raw)`:
  - accepte blobId brut, URL blob, ref composee,
  - extrait proprement l'identifiant blob final.

## 9. Mappers

### `src/mappers/mapOnChainCreator.ts`
- `mapOnChainCreatorObjectToContentCreator(object)`:
  - map objet Sui RPC -> `ContentCreator`.

### `src/mappers/mapCreatorToProfile.ts`
- `mapCreatorToProfile(creator)`:
  - map `ContentCreator` -> `Creator` (shape UI page profil).
  - Convertit `price_per_month` (MIST) vers SUI affichable.

## 10. Hooks - lecture on-chain

### `src/hooks/useGetAllCreators.ts`
Exports:
- `fetchAllCreators(suiClient)`
- `useGetAllCreators()`

Fonctionnement:
1. Lit `AllCreators` shared object.
2. Recupere `tableId` dynamic fields.
3. Paginate `getDynamicFields`.
4. Charge les entrees par chunks (`multiGetObjects`).
5. Extrait les IDs createurs.
6. Recharge les objets createurs par chunks.
7. Mappe en `ContentCreator[]`.

### `src/hooks/useGetCreatorById.ts`
- `useGetCreatorById(creatorId)`:
  - fetch direct d'un createur (utile en deep-link sans state routeur).

### `src/hooks/useGetCreatorContent.ts`
Exports:
- `fetchCreatorContent(suiClient, creatorId)`
- `useGetCreatorContent(creatorId)`

Fonctionnement:
1. Lit l'objet createur pour trouver `wallet` owner.
2. Strategie A: `getOwnedObjects` filtre `StructType ...::Content`.
3. Strategie B fallback: lit tous les objets owner et filtre localement le type.
4. Mappe en `CreatorContent[]`.

### `src/hooks/useUserSubscriptions.ts`
- `useUserSubscriptions()`:
  - lit les objets `Subscription` du wallet courant,
  - mappe en `UserSubscription[]`,
  - expose `subscriptions`, `isLoading`, `error`, `refetch`.

### `src/hooks/useGetOwnedObjects.ts`
- helper generique pour objets wallet (showContent + showType).

## 11. Hooks - transactions on-chain

### `src/hooks/usePublishContentTx.ts`
- `publishContent({title, description, blobId, creatorId})`

Pipeline:
1. Verifie wallet connecte.
2. Verifie `creatorId` present.
3. Lit objet createur et verifie qu'il appartient au wallet connecte.
4. Trouve `CreatorCap` dans les objets wallet.
5. Construit tx Move `upload_content`.
6. Signe/execut e via wallet.

### `src/hooks/useSubscribeToCreator.ts`
- `subscribeToCreator({creatorId})`

Pipeline:
1. Lit createur pour `price_per_month`.
2. Split `gas` coin avec ce montant.
3. Tx Move `subscribe(feeCoin, creator, clock)`.
4. Attend confirmation transaction et check status.

### `src/hooks/useEncryptAndUploadWalrus.ts`
- `encryptAndUpload(file, policyObject)`

Pipeline:
1. Genere `id` de policy (prefix object + nonce).
2. Chiffre bytes via Seal.
3. Upload bytes chiffres sur Walrus publisher.
4. Retourne metadata blob.

### `src/hooks/useDecryptContent.ts`
- `decryptContent({blobId, creatorId})`

Pipeline complet:
1. Verifie wallet + params.
2. Normalise blobId Walrus.
3. Recupere/renouvelle `SessionKey` Seal (cache memoire module).
4. Trouve l'abonnement le plus recent vers `creatorId`.
5. Telecharge blob chiffre depuis Walrus (multi-endpoint fallback).
6. Parse `EncryptedObject`, recupere `encryptedId`.
7. Construit tx-kind `seal_approve` (policy Move).
8. `sealClient.fetchKeys(...)` (controle d'acces).
9. `sealClient.decrypt(...)`.
10. Cree `Blob` video + `URL.createObjectURL`.

Gestion erreurs:
- messages utilisateur explicites (`wallet`, `subscription`, `walrus`, `keys`, `decrypt`).

## 12. Pages UI

### `src/pages/LandingPage.tsx`
- page d'atterrissage (CTA vers `/app`).

### `src/pages/ConnectWalletPage.tsx`
- ecran connexion wallet.

### `src/pages/HomePage.tsx`
- liste createurs (query `useGetAllCreators`).
- navigation vers profil createur.

### `src/pages/CreatorProfilePage.tsx`
- header createur, bouton abonnement, liste contenus du createur.
- lit `useGetCreatorContent(activeCreator.id)`.

### `src/pages/PublishContentPage.tsx`
- formulaire publication video.
- filtre createurs par wallet connecte.
- upload Walrus chiffre + tx publish Sui.
- feedback digest tx et blobId.

### `src/pages/ContentDetailPage.tsx`
- lance le decryption au mount.
- affiche loader / erreur / player video.

### `src/pages/CreateCreatorPage.tsx`
- formulaire creation profil createur.
- convertit prix SUI -> MIST.
- tx Move `new`.
- affiche digest de confirmation.

### `src/pages/AccountPage.tsx`
- page compte simple (etat abonnement global).

### `src/pages/VideoPlayerPage.tsx`
- player mock legacy (non relie au flux on-chain principal).

## 13. UI composants

### `src/ui/Button.tsx`
- variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`, `accent`), tailles, loading.

### `src/ui/Card.tsx`
- wrappers `Card` / `CardContent`.

### `src/ui/Badge.tsx`
- badges `default` / `premium` / `free`.

### `src/ui/index.ts`
- barrel exports UI.

### `src/styles/index.css`
- theme global, blobs animes, glassmorphism, scrollbar custom.

## 14. Services mock

### `src/services/mockApi.ts`
- API fictive (videos/utilisateur/dashboard).
- encore utilisee par:
  - `VideoRouteWrapper`.
- non critique pour le flux on-chain createur/contenu.

## 15. Contrat Move (reference)

### `move/move/hello-world/sources/creators.move`
Module `sui_fan::content_creator`:
- `new(...)`:
  - cree `ContentCreator`,
  - cree/transfere `CreatorCap`,
  - enregistre createur dans `AllCreators`.
- `upload_content(_cap, ...)`:
  - cree objet `Content` et le transfere au wallet createur.
- `subscribe(fee, creator, clock, ctx)`:
  - verifie `fee.value == price_per_month`,
  - transfere fee au wallet createur,
  - cree `Subscription` pour abonne.
- `seal_approve(id, sub, creator, clock)`:
  - valide policy d'acces pour Seal.

## 16. Variables d'environnement (pratique)

Variables reconnues dans le code:
- `VITE_CONTENT_CREATOR_PACKAGE_ID`
- `VITE_ALL_CREATOR_OBJECT_ID`
- `VITE_SUI_TESTNET_RPC_URL`
- `VITE_SUI_MAINNET_RPC_URL`
- `VITE_SEAL_SERVER_OBJECT_IDS` (CSV)
- `VITE_SEAL_KEY_THRESHOLD`
- `VITE_SEAL_VERIFY_KEY_SERVERS`
- `VITE_WALRUS_PUBLISHER_BASE_URL`
- `VITE_WALRUS_AGGREGATOR_BASE_URL`

Note: `src/vite-env.d.ts` declare seulement une partie de ces variables. Le code fonctionne, mais ajouter les nouvelles cles dans ce fichier ameliore l'intellisense TypeScript.

## 17. Configuration outillage

### `package.json`
Scripts principaux:
- `dev`, `build`, `preview`
- `typecheck`
- `lint`, `lint:fix`
- `format`, `format:check`

### `tsconfig.json`
- strict mode actif
- aliases `@router`, `@hooks`, `@config`, etc.

### `vite.config.ts`
- proxies RPC Sui en dev:
  - `/rpc/sui/testnet`
  - `/rpc/sui/mainnet`

### `eslint.config.js`
- TypeScript + React Hooks + React Refresh.

### `tailwind.config.js`
- scan `index.html` + `src/**/*`.

### `vercel.json`
- build Vite
- rewrite SPA vers `index.html`.

## 18. Flux metier detailles (sequence)

### Creation profil createur
1. UI remplit formulaire `CreateCreatorPage`.
2. Prix converti en MIST (`parseSuiToMist`).
3. tx `content_creator::new`.
4. On-chain cree `ContentCreator` + `CreatorCap` + update `AllCreators`.

### Publication contenu
1. UI selectionne createur du wallet courant.
2. Fichier chiffre via Seal.
3. Blob chiffre stocke Walrus -> recup blobId.
4. tx `content_creator::upload_content` avec `CreatorCap`.

### Abonnement
1. Utilisateur ouvre profil createur.
2. Click abonnment -> lit `price_per_month` on-chain.
3. tx `content_creator::subscribe` avec coin exact.
4. `Subscription` creee dans wallet utilisateur.

### Lecture video private
1. Detail content appelle `useDecryptContent`.
2. Trouve sub valide pour createur.
3. Download blob chiffre Walrus.
4. tx-kind `seal_approve` genere bytes policy.
5. Seal fetch keys + decrypt.
6. Video jouee en local via object URL.

## 19. Limites / zones legacy connues

- `VideoRouteWrapper` + `VideoPlayerPage` + `mockApi` = flux legacy mock.
- `BACKEND_INTEGRATION.md` decrit une architecture backend REST theorique, differente du flux on-chain actuel.
- `res.md` contient une proposition Move Walrus alternative, pas l'implementation active du projet.
- `move/README.md` et `move/CLAUDE.md` sont des docs template hello-world partiellement obsoletes par rapport a ce repo.

## 20. Regles de modification pour une IA (importantes)

1. Ne pas casser les IDs/config:
- verifier `CONTENT_CREATOR_PACKAGE_ID` et `ALL_CREATOR_OBJECT_ID` avant de modifier logique metier.

2. Garder coherence montant:
- ecriture on-chain en MIST (`u64`).
- affichage UI en SUI.

3. Publication securisee:
- ne jamais permettre de publier pour un createur qui n'appartient pas au wallet connecte.

4. Decrypt robuste:
- ne pas supprimer normalisation blobId,
- ne pas supprimer fallback endpoints Walrus,
- conserver policy `seal_approve` avant decrypt.

5. Queries:
- privilegier React Query (cache + refetch) plutot que `useEffect` ad hoc.

6. Si ajout de nouvelles env vars:
- mettre a jour `src/vite-env.d.ts`.

7. Toute modif des types Move:
- impacte parsing JSON-RPC (`getObjectFields`, `extractObjectId`, mappers/hooks).

## 21. Checklist rapide pour debug

- Wallet connecte ?
- `VITE_CONTENT_CREATOR_PACKAGE_ID` correct ?
- `VITE_ALL_CREATOR_OBJECT_ID` correct ?
- CreatorCap present dans wallet createur ?
- prix encode en MIST coherent ?
- blobId reel Walrus (pas URL incomplete) ?
- abonnement valide present pour le createur ?
- erreurs `walrus_fetch_failed_status_xxx` ?
- erreurs `NoAccessError` Seal (policy/subscription) ?

## 22. Fichiers importants a connaitre en premier (ordre conseille)

1. `src/hooks/useDecryptContent.ts`
2. `src/hooks/useEncryptAndUploadWalrus.ts`
3. `src/hooks/usePublishContentTx.ts`
4. `src/hooks/useSubscribeToCreator.ts`
5. `src/hooks/useGetAllCreators.ts`
6. `src/hooks/useGetCreatorContent.ts`
7. `src/router/AppShell.tsx`
8. `src/router/CreatorRouteWrapper.tsx`
9. `src/pages/PublishContentPage.tsx`
10. `move/move/hello-world/sources/creators.move`

---

Ce document est volontairement detaille pour servir de reference IA. Il doit etre maintenu a chaque changement structurant (types, hooks, flux, routes, config).
