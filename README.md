# SEFS1026 — Planification des transports

Module fullstack de planification des transports pour Afrikedge : un répartiteur regroupe des
commandes de vente dans un ordre de transport, affecté à un véhicule pour une date, sans dépasser
la capacité du véhicule. API NestJS + SQL Server (sans ORM, requêtes paramétrées avec `mssql`),
front Vue 3 + Pinia + PrimeVue.

*(Pas de capture d'écran pour l'instant : l'application n'a pas encore tourné de bout en bout
contre une vraie base — voir "Ce qui manque" ci-dessous.)*

## Prérequis

- Node.js LTS (testé avec Node v24.15.0 / npm 11.12.1)
- Docker + Docker Compose (testé avec Docker 29.9.0 / Compose v5.6.0)

## Démarrage pas à pas

### 1. Base de données

```bash
# Depuis la racine du projet (là où se trouve docker-compose.yml)
docker compose up -d

# Attendre que le conteneur soit "healthy" (normalement ~30 s ; voir "Ce qui manque")
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
- Swagger : non implémenté (bonus non traité, voir "Ce qui manque")

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
E2E_DB=true npm run test:e2e  # tests e2e : nécessite SQL Server démarré + init.sql exécuté (section 1)

# Front
cd web
npm run lint
npm test                      # tests unitaires (Vitest) : domain/permissions.ts
npm run build                 # vérifie aussi le typage (vue-tsc)
```

Sans `E2E_DB=true`, les tests e2e API sont ignorés (`describe.skip`) pour que
`npm run test:e2e` reste vert même sans base disponible.

### Utilisateurs de test

En-tête `X-User-Id`, sélecteur dans l'en-tête de l'application :

| Utilisateur | Rôle | Peut faire |
|---|---|---|
| `diane` | `DISPATCHER` | Créer un ordre, ajouter/retirer des commandes, marquer parti |
| `eric` | `LOGISTICS_MANAGER` | Tout ce que fait `diane`, et valider un ordre |

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

**Important — honnêteté avant tout** : à cause d'un téléchargement Docker de l'image SQL Server
anormalement lent et instable dans l'environnement de développement (débit très faible, coupures
de connexion répétées après quelques Mo malgré plusieurs tentatives, y compris en limitant le
nombre de téléchargements simultanés), **les requêtes SQL et les scénarios de la section 8 du
sujet n'ont pas encore pu être exécutés contre une vraie instance SQL Server** au moment de la
rédaction de ce README. Tout le code (API et front) a été écrit en suivant scrupuleusement la
syntaxe T-SQL attendue (noms de colonnes entre crochets, `OPENJSON`, `OFFSET/FETCH`,
`sp_getapplock`, etc.), et est couvert par 79 tests API + 11 tests front qui ne nécessitent pas
de base — mais rien ne remplace une exécution réelle. **Cette section sera mise à jour dès que
la vérification contre la vraie base aura été faite**, avec la liste des éventuels correctifs.

Risques les plus probables identifiés à l'avance (à vérifier en priorité) :
- La combinaison `GROUP BY` + fenêtre `COUNT(*) OVER()` + `OFFSET/FETCH` dans la liste des
  ordres de transport.
- La syntaxe exacte de `EXEC sp_getapplock` avec un paramètre nommé plutôt qu'une valeur littérale.
- Le comportement d'`OPENJSON` avec un tableau de chaînes JSON en paramètre `NVARCHAR(MAX)`.
- Les noms de colonnes entre crochets contre le schéma réel créé par `init.sql`.

Hors de cette vérification en attente, ce que je ferais avec plus de temps :
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
- Tests de composants Vue (Vitest + @vue/test-utils) au-delà de `domain/permissions.ts`.
- Bonus non traités : Swagger, i18n FR/EN.

## Temps réellement passé

<À COMPLÉTER par le candidat>

## Utilisation d'outils d'IA

Ce projet a été réalisé avec l'assistance de Claude Code (Anthropic), comme autorisé par le
sujet du test technique.
