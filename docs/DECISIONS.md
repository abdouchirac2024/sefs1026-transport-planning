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

## Doublons et liste vide dans l'ajout de commandes

**Ambiguïté** : le guide de réalisation mentionne, pour `POST /transport-orders/:no/lines`,
"dédoublonner" (suggérant une suppression silencieuse des doublons), mais liste par ailleurs
"doublons dans la requête" et "liste vide" comme des scénarios de test qui doivent produire
"des erreurs avec le bon code", et la signature documentée de `assertPlannable` indique
explicitement `// existence + statut 0 + doublons` (donc une vérification qui peut échouer).

**Décision** : `assertPlannable` rejette (plutôt que de silencieusement dédupliquer) :
- une liste vide → `400 VALIDATION_ERROR` ;
- des numéros de commande en double dans la requête → `400 VALIDATION_ERROR`.

Ces deux cas sont des problèmes de forme de la requête (détectables sans aucun accès à la
base), donc `400`, à la différence des commandes introuvables (`404`) ou non planifiables
(`409`) qui dépendent de l'état réel en base.

## Version de @nestjs/swagger

**Décision** : `@nestjs/swagger@7.4.2` plutôt que la dernière version (12.x). La version 12
exige `@nestjs/common@^12.0.0`, incompatible avec le NestJS 10 utilisé dans ce projet. 7.4.2
est la dernière version de la branche 7.x compatible avec Nest 10, sans forcer une montée de
version de tout le framework pour un bonus.

## Conversion du rowversion en hexadécimal (bug trouvé à la vérification)

**Piège** : `CONVERT(varchar(18), [timestamp], 1)` ne produit **pas** une chaîne hexadécimale en
SQL Server. Les styles de `CONVERT` (0/1/2) qui ajoutent ou non le préfixe `0x` ne s'appliquent
que dans le sens caractère→binaire (interpréter une chaîne de chiffres hex comme des octets).
Dans l'autre sens (binaire→caractère, notre cas avec `rowversion`), SQL Server réinterprète
simplement chaque octet brut comme un caractère : un `rowversion` de 8 octets devient une chaîne
de 8 caractères, pouvant contenir des octets nuls (`\x00`) ou tout autre octet non imprimable.

**Conséquence concrète** : le champ `version` renvoyé par l'API contenait ces octets bruts. Une
fois replacés dans l'en-tête `If-Match` d'une requête suivante (flux normal : créer un ordre →
ajouter des lignes), le navigateur (`fetch()`) refusait silencieusement d'envoyer un en-tête
contenant un octet nul -- notre client HTTP affichait alors "Impossible de contacter le serveur",
un message trompeur qui ressemblait à une vraie panne réseau.

**Décision** : utiliser `master.dbo.fn_varbintohexstr([timestamp])`, la fonction système conçue
pour cet usage, qui produit bien `0x00000000000007d1` (18 caractères, valide en en-tête HTTP).

**Pourquoi ça n'a pas été détecté par les tests automatisés** : aucun test (unitaire ou e2e)
n'exerçait le chemin `If-Match` (capturer une `version` puis la renvoyer) -- seul le test manuel
dans le navigateur l'a révélé. 2 tests e2e ont été ajoutés après coup pour combler ce trou
(succès avec la bonne version, `412 STALE_VERSION` avec une version volontairement fausse).

## Configuration partagée entre main.ts et les tests e2e (bug trouvé à la vérification)

**Constat** : lors de la première exécution des tests e2e contre une vraie base, 20 des 24
tests échouaient -- la plupart en `500 Internal Server Error` au lieu du code attendu (401,
403, 404, 409, 422...). Cause : `Test.createTestingModule({ imports: [AppModule] })
.createNestApplication()` crée une instance Nest à partir du seul `AppModule`, sans jamais
exécuter la fonction `bootstrap()` de `main.ts` -- donc sans `ValidationPipe` (DTO jamais
transformés : `page`/`pageSize` restaient des chaînes, cassant la pagination SQL) ni
`DomainErrorFilter` (toute `DomainError` remontait comme une exception non gérée → 500).

**Décision** : extraire cette configuration commune dans `src/configure-app.ts`
(`configureApp(app)`), appelée à la fois par `main.ts` et par les deux fichiers e2e. Au-delà
du correctif, ça garantit que les tests e2e vérifient exactement le même comportement que le
serveur réellement déployé -- une divergence entre les deux aurait pu masquer de vrais bugs à
l'avenir.

**Point important** : ce bug n'affectait que l'environnement de test, pas le serveur réel
(`npm run start:dev` applique correctement `main.ts`). Un second bug trouvé à la même
vérification, lui, affectait bien le serveur réel : `addLines`, `validate` et `depart`
renvoyaient `201 Created` au lieu de `200 OK` (NestJS applique 201 par défaut à toute route
`@Post()` sans `@HttpCode` explicite) -- corrigé en ajoutant `@HttpCode(HttpStatus.OK)` sur
les trois routes. Voir le README, section "Vérification contre la vraie base", pour le détail
complet et les commits `fix(api):` correspondants.

## Client HTTP front

**Décision** : `fetch` natif avec un petit wrapper, plutôt qu'axios. Le périmètre de l'API est
réduit (une dizaine de routes), un wrapper de 30-40 lignes suffit à injecter `X-User-Id` et à
mapper les erreurs en `ApiError`, sans dépendance supplémentaire.
