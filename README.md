# SEFS1026 — Planification des transports

Module fullstack de planification des transports pour Afrikedge : un répartiteur regroupe des
commandes de vente dans un ordre de transport, affecté à un véhicule pour une date, sans dépasser
la capacité du véhicule. API NestJS + SQL Server (sans ORM), front Vue 3 + Pinia.

## Prérequis

- Node.js LTS (testé avec Node v24.15.0 / npm 11.12.1)
- Docker + Docker Compose (testé avec Docker 29.9.0 / Compose v5.6.0)

## Démarrage

### 1. Base de données

```bash
# Depuis la racine du projet
docker compose up -d

# Attendre que le conteneur soit "healthy" (environ 30 s)
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

API disponible sur `http://localhost:3000`.

### 3. Front (Vue 3)

```bash
cd web
npm install
npm run dev
```

Front disponible sur `http://localhost:5173`.

### Tests

```bash
cd api && npm test          # tests unitaires (Jest)
cd api && npm run test:e2e  # tests e2e (nécessite SQL Server démarré, cf. section 1)
cd web && npm run lint
```

## Choix techniques

Voir [docs/DECISIONS.md](docs/DECISIONS.md) pour le détail des choix non triviaux et leurs
justifications (date "non passée", librairie de composants, client HTTP, etc.).

- **Architecture en couches côté API** : les règles métier vivent dans des fonctions pures
  (`domain/*.rules.ts`), sans aucun I/O, testables sans base de données. Le service orchestre
  la transaction et appelle ces règles ; le repository ne contient que du SQL.
- **Transactions + verrous** (`UPDLOCK`, `sp_getapplock`, vérification de `rowsAffected`) pour
  garantir en concurrence les règles que le schéma ERP ne peut pas garantir par contrainte
  (unicité véhicule+date, unicité commande→ordre).
- **`OPENJSON`** pour passer des listes de numéros en paramètre sans concaténation SQL.
- **Dates en `YYYY-MM-DD`** renvoyées directement en chaîne par SQL (`CONVERT(..., 23)`) pour
  éviter les décalages de fuseau horaire liés au type `Date` de JavaScript.
- **Format d'erreur unique** `{ statusCode, code, message, details }` : le `code` est stable,
  le front peut traduire sans parser `message`.
- **`rowversion` / `If-Match`** : contrôle de concurrence optimiste optionnel sur les mutations.

## Tableau des codes HTTP

| Situation | HTTP | code |
|---|---|---|
| Corps/paramètres invalides | 400 | `VALIDATION_ERROR` |
| `X-User-Id` absent ou inconnu | 401 | `UNAUTHENTICATED` |
| Rôle insuffisant | 403 | `FORBIDDEN_ROLE` |
| Ordre / commande / véhicule introuvable | 404 | `*_NOT_FOUND` |
| Véhicule déjà pris à cette date | 409 | `VEHICLE_ALREADY_BOOKED` |
| Commande pas à planifier / déjà dans un ordre | 409 | `SALES_ORDER_NOT_PLANNABLE` |
| Ordre pas dans le bon statut | 409 | `INVALID_STATUS_TRANSITION` / `ORDER_NOT_EDITABLE` |
| Version obsolète (`If-Match`) | 412 | `STALE_VERSION` |
| Véhicule inactif, date passée, capacité dépassée, ordre vide | 422 | `VEHICLE_INACTIVE` / `DELIVERY_DATE_IN_PAST` / `CAPACITY_EXCEEDED` / `EMPTY_ORDER` |

## Hypothèses

- "Date non passée" : comparée à la date du jour **du serveur SQL** (voir
  [docs/DECISIONS.md](docs/DECISIONS.md)). Aujourd'hui est autorisé.
- Poids total égal à la capacité : autorisé (la règle interdit de *dépasser*).
- Pas de retour en arrière de statut (Validé → Brouillon).

## Ce qui manque / avec plus de temps

- Index uniques filtrés en base (véhicule+date, commande→ordre) : non ajoutés pour ne pas
  toucher au schéma ERP fourni ; l'unicité est garantie côté API par transaction + verrous.
- Fuseau horaire du serveur SQL : le conteneur tourne en UTC alors que Douala est en UTC+1.
  Entre minuit et 1h du matin (heure de Douala), `GETDATE()` encore sur la veille peut refuser
  à tort une date de livraison "aujourd'hui". Solution : fixer `TZ=Africa/Douala` sur le
  conteneur, ou calculer "aujourd'hui" côté API dans un fuseau configurable.
- Vraie authentification (JWT) à la place de l'en-tête `X-User-Id` codé en dur.
- Audit / historique des changements de statut.
- Tests e2e en CI avec conteneur SQL Server éphémère.
- <À COMPLÉTER>

## Temps réellement passé

<À COMPLÉTER par le candidat>

## Utilisation d'outils d'IA

Ce projet a été réalisé avec l'assistance de Claude Code (Anthropic), comme autorisé par le
sujet du test technique.
