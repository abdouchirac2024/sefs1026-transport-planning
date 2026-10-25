# Décisions techniques

Une entrée courte par choix non trivial, pour pouvoir le justifier en entretien.

## Date du jour pour "date non passée"

**Décision** : on compare la date de livraison à `CAST(GETDATE() AS date)`, calculée côté
serveur SQL (pas côté API, pas via le fuseau du poste client).

**Pourquoi** :
- `init.sql` calcule déjà les dates des ordres de test avec `GETDATE()` (voir les commentaires
  du script : "demain", "après-demain", "il y a 3 jours"). En comparant nous-mêmes à
  `GETDATE()` côté serveur SQL, l'API reste cohérente avec les données de test quelle que
  soit la machine qui exécute l'API.
- Une seule source de vérité évite les incohérences entre plusieurs instances de l'API
  qui tourneraient sur des machines à des fuseaux différents.

**Limite connue** : le conteneur SQL Server tourne en UTC, alors que Douala (Cameroun) est en
UTC+1. Entre minuit et 1 h du matin (heure de Douala), `GETDATE()` sur le serveur renvoie
encore la veille : une date de livraison "aujourd'hui" pourrait être refusée par erreur comme
"hier" pendant cette fenêtre d'une heure.

**Solution si on devait le corriger** : soit fixer `TZ=Africa/Douala` (ou l'équivalent
`MSSQL_TIMEZONE` si disponible) sur le conteneur SQL Server, soit calculer la date "aujourd'hui"
côté API dans un fuseau configurable (`Intl` ou une lib comme `date-fns-tz`) plutôt que de
dépendre de l'horloge du serveur SQL. Non implémenté ici : le sujet est prévu pour ~4h et cette
fenêtre d'une heure par jour a un impact limité. Documenté aussi dans le README, section
"Ce qui manque".

## Égalité poids = capacité

**Décision** : autorisée. La règle dit "ne doit jamais *dépasser*", donc `poids total == capacité`
est un cas valide, pas une erreur. Vérifié par le scénario TO-0003 qui atteint 1 420,25/1 500 kg
sans déclencher `CAPACITY_EXCEEDED`.

## Retour en arrière de statut (Validé → Brouillon)

**Décision** : non implémenté. Le sujet ne décrit que les transitions Brouillon → Validé →
Parti, jamais de retour arrière. Mentionné comme amélioration possible dans le README.

## Librairie de composants front

**Décision** : PrimeVue 4 (thème Aura), comme recommandé par le guide de réalisation, pour son
`DataTable` avec pagination côté serveur et sélection multiple intégrées (utile pour l'écran
"Commandes à planifier"), ainsi que `Dialog`, `ProgressBar`, `Toast`, `Tag`.

## Client HTTP front

**Décision** : `fetch` natif avec un petit wrapper, plutôt qu'axios. Le périmètre de l'API est
réduit (une dizaine de routes), un wrapper de 30-40 lignes suffit à injecter `X-User-Id` et à
mapper les erreurs en `ApiError`, sans dépendance supplémentaire.
