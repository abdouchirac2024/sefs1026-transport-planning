# Présentation (5 minutes)

> Script de présentation prévu pour l'entretien. **Non encore rejoué en conditions réelles** :
> la vérification contre la vraie base SQL Server est en attente (voir README, section
> "Ce qui manque"). Les scénarios ci-dessous sont ceux de la section 8 du sujet, à exécuter
> tels quels dès que la base est prête — ce document sera confirmé (ou corrigé) à ce moment-là.

## 1. Démo (2 min)

Scénario, dans l'ordre :

1. **diane** (DISPATCHER, sélecteur d'utilisateur dans l'en-tête) crée un ordre de transport
   pour `VH-01`, demain — écran "Ordres de transport" → "Nouvel ordre".
2. Sur l'écran "Commandes à planifier", diane sélectionne plusieurs commandes dont le poids
   cumulé dépasse la capacité restante de `VH-01` (1 500 kg) → l'API refuse avec un message
   clair (`422 CAPACITY_EXCEEDED`, poids demandé vs capacité affichés), la dialog reste ouverte
   sans rien avoir ajouté (tout ou rien).
3. diane ajoute un sous-ensemble de commandes qui tient dans la capacité restante → succès,
   retour sur l'ordre avec la jauge de remplissage mise à jour.
4. Bascule sur **eric** (LOGISTICS_MANAGER) via le sélecteur d'utilisateur. Sur l'écran détail
   de l'ordre, le bouton "Valider" apparaît (invisible pour diane). eric valide → statut passe
   à Validé, l'ordre n'est plus modifiable (plus de bouton "Ajouter des commandes").
5. Retour sur **diane** : le bouton "Marquer parti" apparaît sur l'ordre Validé. diane confirme
   le départ (confirmation demandée, action irréversible) → statut Parti, les commandes de
   l'ordre passent à "En livraison" (visible si on consulte une de ces commandes ailleurs —
   elle ne réapparaît plus dans "Commandes à planifier").

## 2. Architecture (1 min)

- **Couches API** : `controller` (fin, aucune logique) → `service` (ouvre une transaction,
  verrouille, appelle les règles, écrit, relit l'état à jour) → `repository` (SQL uniquement,
  requêtes paramétrées). Les règles métier vivent à part, dans
  `transport-orders/domain/transport-order.rules.ts` : des fonctions pures qui ne font ni I/O
  ni appel réseau, et qui lèvent une `DomainError` typée (code + statut HTTP + détails).
- **Pourquoi séparer ainsi** : les règles sont le cœur du sujet (10 règles métier à respecter
  "quel que soit le comportement du front") — les isoler permet de les tester à 100% (32 tests)
  sans jamais démarrer de base, et de les relire/justifier une par une en entretien.
- **Transaction et verrous** : chaque mutation (`création`, `ajout/retrait de lignes`,
  `validation`, `départ`) s'exécute dans `DatabaseService.withTransaction(...)`. L'ordre
  concerné est verrouillé (`WITH (UPDLOCK, ROWLOCK)`) avant toute vérification, pour que deux
  requêtes concurrentes sur le même ordre se sérialisent plutôt que de lire un état obsolète.
  La création d'ordre ajoute un verrou applicatif (`sp_getapplock`) pour sérialiser toutes les
  créations entre elles (nécessaire car le schéma ERP n'a pas de contrainte d'unicité
  véhicule+date).

## 3. Choix notables (1 min)

- **Absence de contraintes dans le schéma ERP** (pas de contrainte d'unicité véhicule+date, pas
  de contrainte empêchant une commande d'appartenir à deux ordres, pas de clés étrangères) :
  plutôt que de modifier un schéma qu'on nous demande explicitement de ne pas toucher, ces
  garanties sont reconstruites côté API avec des verrous + un garde-fou final sur
  `rowsAffected` (si le nombre de lignes mises à jour est inférieur au nombre attendu, c'est
  qu'une affectation concurrente a eu lieu entre la vérification et l'écriture → rejet).
- **Codes HTTP et format d'erreur unique** : `{ statusCode, code, message, details }`, avec un
  `code` stable (ex. `CAPACITY_EXCEEDED`) que le front utilise pour sa logique, indépendamment
  du texte du `message` (qui peut évoluer librement).
- **`rowversion` exposé en `version`** : contrôle de concurrence optimiste disponible via
  l'en-tête `If-Match`, optionnel pour le client — un vrai plus pour un outil de répartition où
  plusieurs personnes travaillent en parallèle sur les mêmes ordres.

## 4. Limites et suite (1 min)

- Vérification complète contre la vraie base : **en attente** au moment de la rédaction de ce
  document (voir README). Priorité n°1 avant toute autre amélioration.
- Pas de vraie authentification (JWT), pas d'index uniques filtrés en base (contournés par les
  verrous), fenêtre d'une heure autour de minuit où "aujourd'hui" côté serveur SQL (UTC) peut
  différer d'"aujourd'hui" à Douala (UTC+1).
- Bonus non traités faute de temps : Swagger, i18n FR/EN, tests e2e en CI.

---

## Questions probables du jury, avec réponses courtes

**Pourquoi pas d'ORM, et comment éviter l'injection SQL ?**
Le sujet l'impose. Toutes les requêtes utilisent `request.input('nom', sql.Type, valeur)` de la
librairie `mssql` — jamais de concaténation de chaîne avec une valeur venant de l'utilisateur,
y compris pour les listes (passées via `OPENJSON` sur un paramètre JSON unique).

**Que se passe-t-il si deux répartiteurs ajoutent la même commande en même temps ?**
Les deux transactions verrouillent la commande (`WITH (UPDLOCK, ROWLOCK)`) : la seconde attend
que la première se termine. Si la première a déjà affecté la commande, la seconde la voit avec
le statut "Planifiée" et la rejette (`409 SALES_ORDER_NOT_PLANNABLE`). En ultime secours, le
`UPDATE` de statut vérifie `rowsAffected` pour détecter tout cas limite.

**Pourquoi 409 à certains endroits et 422 à d'autres ?**
`409 Conflict` : la requête est valide mais entre en conflit avec l'état actuel des données
(véhicule déjà réservé, commande déjà affectée, ordre dans le mauvais statut). `422 Unprocessable
Entity` : la requête est "syntaxiquement" correcte mais viole une règle métier sur son propre
contenu (véhicule inactif, date passée, capacité dépassée, ordre vide). `404` reste réservé à
"la ressource référencée n'existe pas du tout".

**Comment sont testées les règles métier ?**
Dans `transport-order.rules.spec.ts` (32 tests, 100% de couverture du fichier de règles) : ce
sont des fonctions pures, testées directement avec des objets JS en entrée, sans base ni
framework. Le service qui les orchestre est testé séparément (19 tests) avec le repository et
la transaction mockés, pour vérifier l'ordre des appels et qu'aucune écriture n'a lieu quand une
règle rejette.

**Comment passerait-on à une vraie authentification ?**
Remplacer `CurrentUserGuard` par une stratégie JWT (`@nestjs/passport` + `passport-jwt`) qui
peuple `request.user` de la même forme (`{ id, role }`). `RolesGuard` et `@Roles(...)` restent
inchangés : ils ne dépendent que de la forme de `request.user`, pas de la façon dont il a été
authentifié.

**Comment gérer un très grand volume de commandes ?**
La pagination actuelle utilise `OFFSET/FETCH`, simple mais coûteuse sur de très grandes tables
(la base doit parcourir toutes les lignes jusqu'à l'offset). À volume important, on passerait à
une pagination par curseur ("keyset pagination", `WHERE [No_] > @lastSeenNo ORDER BY [No_]`),
et on ajouterait des index sur les colonnes filtrées (`Status`, `Delivery City`, `Delivery
Date`) qui n'existent pas aujourd'hui sur le schéma fourni.
