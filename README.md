# SEFS1026 — Planification des transports

Module fullstack de planification des transports pour Afrikedge : un répartiteur regroupe des
commandes de vente dans un ordre de transport, affecté à un véhicule pour une date, sans dépasser
la capacité du véhicule. API NestJS + SQL Server (sans ORM, requêtes paramétrées avec `mssql`),
front Vue 3 + Pinia + PrimeVue.

*(Pas de capture d'écran pour l'instant. L'application a été vérifiée de bout en bout contre une
vraie instance SQL Server — voir "Vérification contre la vraie base" ci-dessous — mais aucune
capture n'a été prise pendant la session de vérification.)*

## Prérequis

- Node.js LTS (testé avec Node v24.15.0 / npm 11.12.1)
- Docker + Docker Compose (testé avec Docker 29.9.0 / Compose v5.6.0)

## Démarrage pas à pas

### 1. Base de données

```bash
# Depuis la racine du projet (là où se trouve docker-compose.yml)
docker compose up -d

# Attendre que le conteneur soit "healthy" (quelques secondes une fois l'image téléchargée)
docker compose ps

# Créer la base et les données de test (peut être relancé à tout moment : repart de zéro)
docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Afk_Transport2026" -C -i /scripts/init.sql
```

### 2. API (NestJS)

```bash
cd api
cp .env.example .env   # valeurs déjà alignées avec le docker-compose fourni
npm install
npm run start:dev
```

- API : `http://localhost:3000`
- Swagger : `http://localhost:3000/api/docs` (en-tête `X-User-Id` documenté sur chaque route,
  avec un exemple de réponse pour chaque code d'erreur possible). **Vérifié** : se charge
  correctement (`/api/docs` en HTML, `/api/docs-json` pour le document OpenAPI), 9 chemins /
  10 opérations présents, en-têtes `X-User-Id` et `If-Match` documentés, exemples d'erreur
  conformes sur chaque route testée.

### 3. Front (Vue 3)

```bash
cd web
npm install
npm run dev
```

Front : `http://localhost:5173` (proxy/URL de l'API configurable via `VITE_API_URL`, défaut
`http://localhost:3000`).

### Tests

```bash
# API
cd api
npm run lint
npm test                      # tests unitaires (Jest) : règles métier, DTO, service. Aucune dépendance externe.
npm run test:cov              # couverture (100% sur domain/transport-order.rules.ts)
npm run db:reset              # relance init.sql via docker compose exec + sqlcmd (repart de zéro)
npm run test:e2e:live         # db:reset puis E2E_DB=true npm run test:e2e -- tous les scénarios de la section 8

# Front
cd web
npm run lint
npm test                      # tests unitaires (Vitest) : domain/permissions.ts
npm run build                 # vérifie aussi le typage (vue-tsc)
```

Sans `E2E_DB=true`, les tests e2e API sont ignorés (`describe.skip`) pour que
`npm run test:e2e` reste vert même sans base disponible (confirmé : 31 tests skip, exit
code 0). `test/section8-scenarios.e2e-spec.ts` couvre tous les scénarios de la section 8 du
skill (lectures, liste paginée des ordres avec filtres statut/date, création, capacité,
tout-ou-rien, rôles, transitions de statut, et le cas de concurrence — deux ajouts simultanés
de la même commande dans deux ordres), regroupés en 7 `describe` thématiques
**indépendants** : chaque groupe relance `db:reset` (`beforeAll` ou `beforeEach` selon que
des tests du groupe mutent ou non les mêmes lignes partagées), et aucun test ne dépend de
l'effet d'un autre — chacun peut être lancé seul.

**Vérifié contre une vraie instance SQL Server** (voir "Vérification contre la vraie base") :
31/31 tests e2e passent (21 scénarios de la section 8 + 2 tests If-Match + 3 tests
auth/vehicles de base + 5 tests de la liste paginée `GET /transport-orders`, filtres statut/
date inclus), 81/81 tests unitaires API, 30/30 tests unitaires front (dont les stores Pinia
`sales-orders`/`transport-orders` : cache par page, invalidation après mutation).

### Utilisateurs de test

En-tête `X-User-Id`, sélecteur dans l'en-tête de l'application :

| Utilisateur | Rôle | Peut faire |
|---|---|---|
| `diane` | `DISPATCHER` | Créer un ordre, ajouter/retirer des commandes, marquer parti |
| `eric` | `LOGISTICS_MANAGER` | Tout ce que fait `diane`, et valider un ordre |

## Vérification contre la vraie base

L'application a été vérifiée de bout en bout contre une vraie instance SQL Server (image
`mcr.microsoft.com/mssql/server:2022-latest`, le téléchargement initial ayant pris plusieurs
heures à cause d'un débit réseau anormalement faible dans l'environnement de développement —
voir l'historique Git pour le détail de cette période). Résultat : **21/21 scénarios de la
section 8 passent**, Swagger se charge correctement, le front fonctionne.

| # | Scénario | Attendu | Obtenu |
|---|---|---|---|
| 1 | `GET /vehicles` | 9 véhicules, VH-07 exclu | ✅ |
| 2 | `GET /sales-orders/to-plan` | 33 commandes (SO-1008→SO-1040) | ✅ |
| 3 | Sans `X-User-Id` | 401 | ✅ |
| 4 | `X-User-Id: bob` | 401 | ✅ |
| 5 | Créer VH-07 demain | 422 `VEHICLE_INACTIVE` | ✅ |
| 6 | Créer VH-03 demain (déjà réservé) | 409 `VEHICLE_ALREADY_BOOKED` | ✅ |
| 7 | Créer VH-05 hier | 422 `DELIVERY_DATE_IN_PAST` | ✅ |
| 8 | Créer VH-05 aujourd'hui | 201, `TO-0005` | ✅ |
| 9 | TO-0003 + SO-1013 (145,50 kg) | 422 `CAPACITY_EXCEEDED` | ✅ |
| 10 | TO-0003 + [SO-1027,SO-1040] (145,25 kg) | 422, aucune ajoutée | ✅ |
| 11 | TO-0003 + SO-1027 seule | 200, 1 420,25 kg, SO-1027→Planifiée | ✅ |
| 12 | TO-0003 + SO-1003 (déjà dans TO-0002) | 409 `SALES_ORDER_NOT_PLANNABLE` | ✅ |
| 13 | Ajout sur TO-0002 (Validé) | 409 `ORDER_NOT_EDITABLE` | ✅ |
| 14 | Retirer SO-1006 de TO-0003 | 200, SO-1006→À planifier | ✅ |
| 15 | Valider TO-0003 par diane | 403 `FORBIDDEN_ROLE` | ✅ |
| 16 | Valider TO-0004 (vide) par eric | 422 `EMPTY_ORDER` | ✅ |
| 17 | Valider TO-0003 par eric | 200, `validatedBy=eric` | ✅ |
| 18 | Départ TO-0004 (Brouillon) | 409 `INVALID_STATUS_TRANSITION` | ✅ |
| 19 | Départ TO-0002 par diane | 200, SO-1003/1004/1005→En livraison | ✅ |
| 20 | Départ TO-0001 (déjà parti) | 409 `INVALID_STATUS_TRANSITION` | ✅ |
| 21 | Deux ajouts concurrents de SO-1008 | un seul réussit (200/409) | ✅ |

### Bugs trouvés et corrigés (4, chacun avec un commit `fix(api): ...` séparé)

1. **Les tests e2e ne configuraient pas `ValidationPipe`/`DomainErrorFilter`** comme `main.ts`
   le fait. `Test.createTestingModule().createNestApplication()` ne rejoue pas le `bootstrap()`
   de `main.ts` : sans cette config, toute erreur métier remontait en `500` brut au lieu du bon
   code HTTP, et les DTO de requête n'étaient jamais transformés (`string` au lieu de `number`),
   ce qui cassait aussi la pagination SQL (`OFFSET` non entier). Corrigé en extrayant la config
   commune dans `configure-app.ts`, appelée par `main.ts` et par les deux fichiers e2e.
   *N'affectait pas le serveur réellement déployé — uniquement l'environnement de test.*
2. **`addLines`, `validate`, `depart` renvoyaient `201` au lieu de `200`** (NestJS applique 201
   par défaut à toute route `@Post()` sans `@HttpCode` explicite). Corrigé en ajoutant
   `@HttpCode(HttpStatus.OK)` sur les trois routes. *Celui-ci affectait bien le serveur réel —
   un vrai bug métier, pas un artefact de test.*
3. **`CONVERT(varchar(18), [timestamp], 1)` ne produit pas une chaîne hexadécimale** en SQL
   Server (le style de conversion ne s'applique pas dans ce sens binaire→caractère) : il
   réinterprète simplement les 8 octets bruts du `rowversion` comme des caractères, dont des
   octets nuls (`\x00`). Le champ `version` renvoyé par l'API contenait donc des octets
   invalides. Une fois replacés dans l'en-tête `If-Match` d'une requête suivante (flux normal
   du front : créer un ordre → ajouter des lignes), `fetch()` refusait silencieusement d'envoyer
   un en-tête avec un octet nul, ce que notre client HTTP affichait à tort comme "Impossible de
   contacter le serveur". **Trouvé uniquement via le test manuel dans le navigateur** — aucun
   test automatisé n'exerçait le chemin `If-Match` (capturer une version puis la renvoyer).
   Corrigé avec `master.dbo.fn_varbintohexstr([timestamp])`, la fonction système correcte, et
   2 tests e2e ajoutés pour combler ce trou de couverture. *Affectait bien le serveur réel dès
   qu'un client respectait `If-Match`.*
4. **`GET /transport-orders/:no` ne renvoyait pas `lineCount`** : la requête SQL d'en-tête du
   détail sélectionnait `no`, `vehicleCode`, `status`... mais jamais `lineCount` (seules la liste
   paginée et la validation interne l'avaient). Aucune erreur TypeScript ne l'a signalé : le type
   front `TransportOrderDetail` est une interface indépendante du DTO API, non partagée entre les
   deux projets. Conséquence concrète : `canValidate()` côté front fait `lineCount >= 1`, qui vaut
   toujours `false` quand `lineCount` est `undefined` — **le bouton "Valider" ne s'affichait donc
   jamais sur l'écran de détail, pour aucun ordre, quel que soit le rôle**, rendant la règle
   métier n°8 (seul un `LOGISTICS_MANAGER` peut valider) inatteignable depuis l'UI. **Trouvé en
   répondant à une question sur `/transport-orders/TO-0005`**, pas par un test automatisé.
   Corrigé en calculant `lineCount = lines.length` dans `toTransportOrderDetailDto` (les lignes
   sont déjà chargées pour `totalWeightKg`, aucune requête SQL supplémentaire), avec 2 tests
   unitaires ajoutés. *Affectait bien le serveur réel.*

Aucun des risques identifiés à l'avance (combinaison `GROUP BY` + `COUNT(*) OVER()` +
`OFFSET/FETCH`, syntaxe `sp_getapplock`, `OPENJSON`, noms de colonnes entre crochets) ne s'est
révélé être un problème : le SQL écrit en suivant la documentation était correct du premier
coup. Les 4 bugs réels trouvés portaient tous sur des détails plus subtils (configuration du
bootstrap de test, code HTTP par défaut de NestJS, sens de conversion `CONVERT`, un champ
manquant dans une requête SQL de détail).

## Choix techniques et pourquoi

Voir [docs/DECISIONS.md](docs/DECISIONS.md) pour le détail de chaque choix et sa justification
complète (date "non passée", doublons/liste vide, librairie de composants, client HTTP...).
Résumé :

**Côté API**
- **Architecture en couches** : les règles métier vivent dans des fonctions pures
  (`transport-orders/domain/transport-order.rules.ts`), sans aucun accès base ni dépendance
  NestJS, testables seules. Le service (`transport-orders.service.ts`) orchestre la transaction
  et appelle ces règles ; le repository ne contient que du SQL. Objectif : pouvoir tester
  exhaustivement les règles métier (32 tests) sans jamais démarrer de base.
- **Transactions + verrous** (`WITH (UPDLOCK, ROWLOCK)`, `sp_getapplock`, vérification de
  `rowsAffected`) : le schéma ERP fourni n'a ni contrainte d'unicité (véhicule+date, commande→
  ordre) ni clé étrangère. Plutôt que d'y toucher, ces garanties sont reconstruites côté API
  dans une transaction : verrouiller avant de vérifier, vérifier avant d'écrire, et un
  garde-fou final sur `rowsAffected` pour détecter une affectation concurrente qui aurait
  glissé entre deux requêtes.
- **`OPENJSON`** pour passer des listes de numéros de commande en paramètre unique, sans jamais
  concaténer de valeurs dans le SQL.
- **Dates en `YYYY-MM-DD`**, en chaîne de bout en bout (SQL → API → front), jamais via un objet
  `Date` JavaScript : évite les décalages liés au fuseau horaire du driver `mssql`.
- **Format d'erreur unique** `{ statusCode, code, message, details }` : le `code` est stable
  dans le temps, le front s'appuie dessus plutôt que de parser `message`.
- **`rowversion` exposé en `version`, contrôle optimiste via `If-Match`** : optionnel côté
  client (le sujet ne l'exige pas), mais honoré si fourni → `412 STALE_VERSION`.
- **Pas d'ORM** : requêtes paramétrées avec `mssql` et `request.input(...)` partout, comme
  imposé par le sujet.

**Côté front**
- **Pinia en stores "setup" (Composition API)** : un store par ressource (`user`, `vehicles`,
  `sales-orders`, `transport-orders`), chacun expose son propre état `loading`/`error` pour
  piloter le composant `AsyncState` de façon uniforme sur les 3 écrans.
- **`domain/permissions.ts`** : fonctions pures (`canEditLines`, `canValidate`, `canDepart`)
  testées (11 tests Vitest), réutilisées par la vue détail pour afficher/masquer les actions.
  Purement indicatif : l'API revérifie tout, quoi qu'il arrive côté front.
- **PrimeVue 4 (thème Aura)** : `DataTable` avec pagination côté serveur et sélection multiple
  intégrées, `Dialog`, `ConfirmDialog`, `Toast`, `Tag` — couvre tous les besoins des 3 écrans
  sans code UI supplémentaire.
- **`fetch` natif** plutôt qu'axios : le périmètre de l'API est réduit (une dizaine de routes),
  un wrapper de 70 lignes (`api/http-client.ts`) suffit à injecter `X-User-Id` et à mapper les
  erreurs en `ApiError`.
- **Dates en `<input type="date">` natif** plutôt qu'un composant de calendrier : manipule
  directement une chaîne `YYYY-MM-DD`, cohérent avec le choix côté API.

## Tableau des codes HTTP

| Situation | HTTP | code |
|---|---|---|
| Corps/paramètres invalides, date mal formée | 400 | `VALIDATION_ERROR` |
| `X-User-Id` absent ou inconnu | 401 | `UNAUTHENTICATED` |
| Rôle insuffisant | 403 | `FORBIDDEN_ROLE` |
| Ordre / commande / véhicule introuvable, commande absente de l'ordre | 404 | `*_NOT_FOUND` |
| Véhicule déjà pris à cette date | 409 | `VEHICLE_ALREADY_BOOKED` |
| Commande pas à planifier / déjà dans un ordre | 409 | `SALES_ORDER_NOT_PLANNABLE` |
| Ordre pas dans le bon statut (modif sur validé, départ d'un brouillon...) | 409 | `INVALID_STATUS_TRANSITION` / `ORDER_NOT_EDITABLE` |
| Version obsolète (`If-Match`) | 412 | `STALE_VERSION` |
| Véhicule inactif, date passée, capacité dépassée, validation d'un ordre vide | 422 | `VEHICLE_INACTIVE` / `DELIVERY_DATE_IN_PAST` / `CAPACITY_EXCEEDED` / `EMPTY_ORDER` |

## Hypothèses

- **"Date non passée"** : comparée à la date du jour **du serveur SQL** (`CAST(GETDATE() AS date)`),
  cohérent avec `init.sql` qui calcule ses dates de test de la même façon. Aujourd'hui est
  autorisé. Limite connue : fuseau horaire du conteneur (voir "Ce qui manque").
- **Poids total égal à la capacité** : autorisé (la règle interdit de *dépasser*, pas d'atteindre).
- **Doublons et liste vide** dans l'ajout de commandes : rejetés en `400 VALIDATION_ERROR`
  plutôt que silencieusement dédupliqués (voir DECISIONS.md pour l'ambiguïté tranchée).
- **Pas de retour en arrière de statut** (Validé → Brouillon, Parti → Validé) : non prévu par
  le sujet, donc non implémenté.
- **Liste des villes** (`GET /sales-orders/cities`) : limitée aux commandes au statut "À
  planifier", pour correspondre exactement à ce qui est filtrable sur l'écran concerné.
- **`If-Match`** optionnel pour le client : le sujet ne l'impose pas, mais l'API l'honore s'il
  est fourni.

## Ce qui manque / avec plus de temps

Le code a été vérifié de bout en bout contre une vraie base (voir "Vérification contre la vraie
base" ci-dessus) : les deux bugs trouvés sont corrigés et documentés. Ce qui reste, avec plus de
temps :
- Index uniques filtrés en base (véhicule+date, commande→ordre) : non ajoutés pour ne pas
  toucher au schéma ERP fourni ; l'unicité est garantie côté API par transaction + verrous,
  mais un index serait une seconde ligne de défense naturelle en production.
- Fuseau horaire du serveur SQL : le conteneur tourne en UTC alors que Douala est en UTC+1.
  Entre minuit et 1h du matin (heure de Douala), `GETDATE()` encore sur la veille pourrait
  refuser à tort une date de livraison "aujourd'hui". Solution : fixer `TZ=Africa/Douala` sur
  le conteneur, ou calculer "aujourd'hui" côté API dans un fuseau configurable.
- Vraie authentification (JWT) à la place de l'en-tête `X-User-Id` codé en dur.
- Audit / historique des changements de statut.
- Tests e2e en CI avec conteneur SQL Server éphémère (le test e2e existe déjà, gaté par
  `E2E_DB=true`, mais n'est pas branché dans une pipeline).
- Tests de composants Vue (Vitest + @vue/test-utils) : les règles pures (`domain/permissions.ts`)
  et les stores Pinia (`sales-orders`, `transport-orders`, cache par page inclus) sont testés,
  mais aucun composant `.vue` (DataTable, dialogues) ne l'est — vérifiés manuellement seulement.
- Bonus non traités : i18n FR/EN. Swagger est fait et vérifié (`@nestjs/swagger`, `/api/docs`,
  `@ApiHeader` pour `X-User-Id`, exemples de réponses d'erreur par route).

## Temps réellement passé

<À COMPLÉTER par le candidat>

## Utilisation d'outils d'IA

Ce projet a été réalisé avec l'assistance de Claude Code (Anthropic), comme autorisé par le
sujet du test technique.
