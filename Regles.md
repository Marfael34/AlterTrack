# Règles de développement --- React Native / Expo, NestJS, PostgreSQL et Prisma

**Version :** 1.0\
**Langue :** français\
**Objectif :** définir les règles communes de conception, de
développement, de sécurité, de tests et de maintenance d'une application
mobile avec React Native / Expo, une API NestJS et une base PostgreSQL
gérée avec Prisma.

------------------------------------------------------------------------

## 1. Principes non négociables

1.  **Privilégier la simplicité.** Ne pas ajouter de dépendance,
    d'abstraction ou de service sans besoin concret.
2.  **Respecter l'architecture existante.** Avant toute modification,
    examiner les fichiers, conventions, scripts et dépendances déjà
    présents.
3.  **Ne pas inventer le métier.** En cas d'ambiguïté fonctionnelle,
    demander une précision ou documenter explicitement l'hypothèse avant
    de coder.
4.  **Ne pas casser l'existant.** Identifier les effets de bord
    possibles et exécuter les contrôles adaptés après chaque
    modification.
5.  **Séparer les responsabilités.** L'interface, la logique métier,
    l'accès aux données et les préoccupations transversales ne doivent
    pas être mélangés.
6.  **Valider les données aux frontières.** Toute donnée externe doit
    être considérée comme non fiable.
7.  **Ne jamais exposer de secret côté mobile.** Tout ce qui est livré
    dans l'application Expo peut être extrait par un utilisateur.
8.  **Ne pas faire confiance au client.** Les permissions, rôles, prix,
    statuts et règles métier doivent être vérifiés côté serveur.
9.  **Rendre les erreurs compréhensibles.** Les messages utilisateur
    sont sûrs et utiles ; les détails techniques restent dans les
    journaux privés.
10. **Automatiser la qualité.** Formatage, lint, tests, vérifications
    TypeScript et contrôles de migration doivent être reproductibles.
11. **Documenter les décisions structurantes.** Les choix importants,
    compromis et procédures d'exploitation doivent être consignés.
12. **Ne jamais prétendre qu'une vérification a réussi si elle n'a pas
    été exécutée.**
13. **Timeout opérationnel (300 secondes maximum) :** Si une étape,
    commande ou tâche dure plus de 300 secondes, l'interrompre et passer à
    autre chose (approche alternative ou suite du flux) sans rester bloqué.

## 2. Architecture générale recommandée

Organiser le dépôt en monorepo ou en dépôts séparés selon les besoins du
projet. Dans les deux cas, conserver une frontière claire entre mobile,
serveur et base de données.

Exemple indicatif de monorepo :

``` text
project/
├── apps/
│   ├── mobile/                 # React Native + Expo
│   └── api/                    # NestJS
├── packages/
│   └── shared/                 # Types/schémas réellement partageables
├── docs/
├── .env.example
├── package.json
└── README.md
```

Adapter cette structure au gestionnaire de paquets et aux conventions
déjà adoptés. Ne pas déplacer ou renommer tout le projet uniquement pour
correspondre à cet exemple.

### Règles d'architecture

-   Le mobile communique avec le serveur via une API documentée,
    généralement REST/JSON.
-   Le mobile ne se connecte **jamais directement à PostgreSQL**.
-   NestJS est responsable de l'authentification, des autorisations, de
    la validation, des règles métier et de l'accès aux données.
-   Prisma est l'interface d'accès à PostgreSQL côté serveur.
-   Les types partagés ne doivent pas créer un couplage excessif entre
    le mobile et le serveur.
-   Ne pas importer de code serveur dans l'application mobile.
-   Définir une stratégie de versionnement de l'API lorsqu'il devient
    nécessaire de maintenir plusieurs clients.
-   Éviter de dupliquer les règles métier critiques dans le mobile : le
    serveur reste l'autorité.

## 3. Outils, versions et dépendances

-   Utiliser une version de Node.js encore maintenue et compatible avec
    la version d'Expo et de NestJS retenue.
-   Choisir une version stable d'Expo et respecter la matrice de
    compatibilité Expo / React Native.
-   Vérifier la compatibilité de chaque bibliothèque native avec Expo et
    le mode de build utilisé.
-   Épingler les versions via le lockfile et le committer.
-   Installer, mettre à jour et supprimer les dépendances avec le
    gestionnaire de paquets choisi ; ne pas mélanger npm, pnpm et Yarn
    dans le même projet sans raison documentée.
-   Éviter les dépendances abandonnées, redondantes ou excessivement
    permissives.
-   Examiner les permissions natives demandées par toute bibliothèque
    mobile.
-   Mettre à jour régulièrement, mais par lots maîtrisés avec tests et
    lecture des notes de version.
-   Ne pas lancer une mise à niveau majeure globale sans plan de
    migration et sauvegarde.
-   Documenter les versions requises dans le README et dans les fichiers
    de configuration appropriés.

## 4. TypeScript et qualité du code

### Règles générales

-   Utiliser TypeScript en mode strict autant que possible.
-   Éviter `any`. Préférer `unknown`, des types précis, des unions
    discriminées et des fonctions de validation.
-   Ne pas contourner le compilateur avec `as any`, `@ts-ignore` ou des
    assertions répétées. Si une exception est inévitable, la limiter et
    l'expliquer.
-   Définir des noms explicites et cohérents.
-   Préférer des fonctions petites, focalisées et testables.
-   Éviter les fichiers ou composants qui cumulent trop de
    responsabilités.
-   Extraire une abstraction uniquement lorsqu'elle clarifie le code ou
    évite une duplication réelle.
-   Supprimer le code mort, les imports inutilisés, les commentaires
    périmés et les logs de débogage avant livraison.
-   Commenter principalement le **pourquoi**, pas ce que le code dit
    déjà.
-   Éviter les nombres et chaînes magiques : définir des constantes
    nommées lorsqu'elles portent un sens métier.
-   Gérer explicitement les valeurs nulles, les états vides et les
    erreurs.
-   Ne pas utiliser une promesse sans traiter le chemin d'erreur
    attendu.
-   Éviter les effets de bord dans les fonctions qui devraient être
    pures.

### Formatage et contrôles

Configurer et appliquer, selon le dépôt : - ESLint ; - Prettier ; -
TypeScript `strict` ; - scripts `lint`, `typecheck`, `test` et `build`
ou leurs équivalents.

Avant de livrer une modification, exécuter les contrôles disponibles et
signaler précisément ceux qui n'ont pas pu être exécutés.

## 5. Frontend mobile --- React Native / Expo

### 5.1 Composants et organisation

-   Utiliser des composants fonctionnels et des hooks.
-   Garder les composants d'écran concentrés sur l'assemblage de
    l'interface et la coordination de l'état.
-   Extraire les composants réutilisables lorsqu'ils ont une
    responsabilité claire.
-   Séparer les composants visuels, les hooks, les services API, les
    schémas de validation et les types.
-   Éviter les composants géants et les chaînes de conditions
    imbriquées.
-   Utiliser des listes virtualisées (`FlatList` ou solution appropriée)
    pour les collections longues ; éviter de rendre de longues listes
    avec un simple `ScrollView` et `map`.
-   Ajouter des clés stables aux éléments de liste ; ne pas utiliser
    l'index comme clé lorsque la liste peut changer.
-   Utiliser les primitives React Native (`View`, `Text`, `Pressable`,
    etc.) plutôt que des éléments HTML.
-   Utiliser Expo Router si le projet l'a choisi ; ne pas mélanger
    plusieurs systèmes de navigation sans raison.

### 5.2 Hooks et rendu

-   Respecter strictement les règles des hooks : appeler les hooks au
    niveau supérieur des composants ou hooks personnalisés.
-   Déclarer les dépendances des hooks correctement.
-   Ne pas ajouter `useMemo`, `useCallback` ou `memo` systématiquement :
    les utiliser lorsque cela apporte un bénéfice mesurable ou évite un
    problème identifié.
-   Éviter les effets (`useEffect`) pour calculer une valeur qui peut
    être dérivée directement du state ou des props.
-   Nettoyer les abonnements, écouteurs et tâches lorsque le composant
    est démonté.
-   Empêcher les réponses réseau obsolètes de remplacer un état plus
    récent.
-   Prévoir les états de chargement, de succès, d'erreur, de contenu
    vide et de rafraîchissement.

### 5.3 État et données

-   Distinguer l'état local de l'interface, l'état partagé de
    l'application et les données distantes.
-   Choisir une seule approche cohérente pour les données serveur (par
    exemple TanStack Query ou une solution déjà installée) au lieu de
    multiplier les mécanismes.
-   Ne pas utiliser le stockage local comme source de vérité pour les
    autorisations ou les données sensibles.
-   Éviter de recopier les mêmes données dans plusieurs stores.
-   Réinitialiser les données propres à un utilisateur lors de la
    déconnexion ou d'un changement de compte.
-   Gérer les erreurs réseau, délais d'attente, absence de connexion et
    tentatives de nouvelle requête.
-   N'effectuer une nouvelle tentative automatique que pour les
    opérations où elle est sûre ; éviter de répéter une mutation non
    idempotente sans stratégie adaptée.
-   Prévoir une stratégie de pagination ou de chargement progressif pour
    les grands volumes.

### 5.4 Navigation

-   Définir des routes et paramètres typés lorsque l'outil de navigation
    le permet.
-   Valider les paramètres reçus par une route avant de les utiliser.
-   Gérer les liens profonds et les redirections d'authentification si
    le produit en a besoin.
-   Empêcher l'accès visuel aux écrans privés lorsque l'utilisateur
    n'est pas connecté, tout en sachant que **la vraie protection reste
    côté API**.
-   Ne pas passer de données secrètes dans les URLs ou les paramètres de
    navigation.

### 5.5 Interface et accessibilité

-   Utiliser un système cohérent de couleurs, espacements, typographies
    et composants.
-   Éviter les valeurs de style dupliquées lorsqu'un thème ou des tokens
    sont disponibles.
-   Prendre en compte les tailles d'écran, orientations et zones de
    sécurité.
-   Vérifier le clavier, les formulaires, les champs, le défilement et
    les petits écrans.
-   Ajouter des libellés accessibles, des rôles et des indications
    pertinentes.
-   Ne pas transmettre une information uniquement par la couleur.
-   Respecter les préférences de réduction des animations lorsque
    pertinent.
-   Prévoir des zones tactiles suffisamment grandes et des états
    pressés/focus visibles.
-   Tester les textes longs, les erreurs de validation et les
    traductions si l'application est multilingue.
-   Ne pas utiliser une animation qui bloque inutilement les
    interactions.

### 5.6 Formulaires

-   Définir clairement les champs obligatoires, formats et limites.
-   Afficher les erreurs près des champs concernés et résumer les
    erreurs générales si nécessaire.
-   Conserver les données saisies lorsque cela améliore l'expérience et
    ne crée pas de risque.
-   Valider côté client pour l'expérience utilisateur, puis **revalider
    côté serveur**.
-   Désactiver les soumissions répétées pendant une opération en cours
    lorsque cela convient.
-   Gérer correctement les erreurs serveur et les pertes de connexion.

### 5.7 Stockage mobile et secrets

-   Considérer le code, les variables `EXPO_PUBLIC_*`, les assets et le
    bundle mobile comme publics.
-   Ne jamais inclure de mot de passe de base de données, clé privée
    serveur, secret JWT ou clé d'administration dans l'application.
-   Utiliser le stockage sécurisé adapté, tel que `expo-secure-store`,
    pour les petits secrets d'authentification lorsque cela convient.
-   Ne pas stocker un jeton sensible dans un stockage non sécurisé sans
    analyse explicite du risque.
-   Limiter les données personnelles persistées sur l'appareil.
-   Nettoyer les données de session lors de la déconnexion.
-   Ne jamais journaliser les jetons, mots de passe ou informations
    personnelles sensibles.

### 5.8 Réseau mobile

-   Utiliser une URL de base configurable par environnement.
-   Ne pas coder en dur `localhost` pour un appareil physique : sur
    mobile, `localhost` désigne l'appareil lui-même. Utiliser l'adresse
    accessible du serveur en développement.
-   Utiliser HTTPS en production.
-   Gérer les délais d'attente, les erreurs réseau et les réponses non
    conformes.
-   Vérifier le code HTTP et la forme des données avant de les utiliser.
-   Éviter de disperser des appels `fetch` dans les composants ;
    centraliser les fonctions réseau dans un client API cohérent.
-   Ne pas désactiver la validation TLS pour contourner un problème de
    certificat.
-   Ne pas supposer que le réseau est disponible en permanence.

### 5.9 Performance et Expo

-   Mesurer avant d'optimiser.
-   Réduire les re-rendus inutiles et les transformations coûteuses dans
    les listes.
-   Optimiser la taille des images et les ressources embarquées.
-   Tester les builds de production, pas uniquement Expo Go.
-   Vérifier si une bibliothèque exige un development build ou un module
    natif.
-   Utiliser EAS Build / EAS Submit si le projet en a besoin et si la
    stratégie retenue le justifie.
-   Vérifier les permissions iOS et Android réellement nécessaires.
-   Ne pas exposer de secrets dans `app.json`, `app.config.*` ou les
    variables embarquées.
-   Documenter les profils de build et les paramètres spécifiques aux
    plateformes.

## 6. Backend --- NestJS

### 6.1 Modules et responsabilités

Organiser l'API en modules métier cohérents. Un module peut contenir un
controller, un service, des DTO et des tests selon sa complexité.

-   **Controller** : reçoit la requête HTTP, applique les mécanismes
    transversaux et délègue au service.
-   **Service** : porte la logique métier.
-   **DTO** : définit et valide la forme des données
    entrantes/sortantes.
-   **Prisma service/repository** : gère l'accès aux données.
-   **Guard** : contrôle l'authentification ou l'autorisation.
-   **Pipe** : valide ou transforme les entrées.
-   **Interceptor** : traite les préoccupations transversales adaptées,
    sans cacher la logique métier.
-   **Filter** : transforme les exceptions en réponses HTTP cohérentes.

Règles : - Les controllers ne doivent pas contenir de logique métier
complexe. - Ne pas accéder directement à Prisma depuis les
controllers. - Éviter les services fourre-tout. - Ne pas créer une
couche repository supplémentaire si elle ne fait que recopier Prisma
sans bénéfice. - Injecter les dépendances via le système NestJS. -
Éviter les dépendances circulaires ; les résoudre par une meilleure
séparation des responsabilités. - Garder les règles métier testables
sans démarrer tout le serveur lorsque c'est possible.

### 6.2 API et conventions HTTP

-   Utiliser des ressources et noms de routes cohérents.
-   Respecter la sémantique HTTP : GET pour lire, POST pour créer ou
    lancer une action, PATCH pour une modification partielle, PUT pour
    un remplacement, DELETE pour supprimer.
-   Ne pas utiliser GET pour une action qui modifie des données.
-   Employer des codes HTTP adaptés (`200`, `201`, `204`, `400`, `401`,
    `403`, `404`, `409`, `422` si la convention du projet l'utilise,
    `429`, `500`, etc.).
-   Définir un format d'erreur stable et documenté.
-   Mettre en place une pagination, un tri et des filtres contrôlés pour
    les collections volumineuses.
-   Valider et limiter les paramètres de pagination, filtres et tris.
-   Éviter de retourner des champs internes ou confidentiels.
-   Utiliser Swagger/OpenAPI avec les décorateurs et DTO appropriés si
    le projet expose une API REST.
-   Documenter les routes, permissions, entrées, sorties et erreurs
    attendues.
-   Prévoir une stratégie de versionnement lorsqu'une évolution
    incompatible devient nécessaire.
-   Utiliser des clés d'idempotence pour les opérations critiques
    lorsque cela est pertinent.

### 6.3 Validation des entrées

-   Activer une `ValidationPipe` globale avec des options strictes
    adaptées au projet, notamment `whitelist` et `forbidNonWhitelisted`
    lorsque possible.
-   Utiliser des DTO explicites et des validateurs adaptés.
-   Transformer les types uniquement de manière contrôlée.
-   Ne pas utiliser directement le corps HTTP comme objet Prisma.
-   Ne pas faire confiance à un identifiant fourni par le client sans
    vérifier l'accès à la ressource.
-   Valider les fichiers envoyés : type réel, taille, extension, nom et
    destination.
-   Limiter la taille des requêtes et les paramètres susceptibles
    d'épuiser les ressources.
-   Valider aussi les données issues de services tiers.

### 6.4 Authentification et autorisation

-   Séparer clairement l'identification de l'utilisateur de ses
    permissions.
-   Choisir une stratégie d'authentification documentée (sessions ou
    jetons) adaptée aux clients.
-   Si JWT est utilisé : définir les expirations, l'émetteur, l'audience
    et les algorithmes autorisés selon l'architecture ; valider toutes
    les propriétés nécessaires.
-   Garder les secrets et clés de signature côté serveur, dans un
    gestionnaire de secrets ou une configuration sécurisée.
-   Ne pas stocker les mots de passe en clair ; utiliser un algorithme
    de hachage adapté comme Argon2id ou bcrypt avec des paramètres
    actuels et vérifiés.
-   Mettre en place une procédure de réinitialisation de mot de passe
    sûre.
-   Prévoir révocation, rotation et renouvellement des jetons si
    l'architecture l'exige.
-   Limiter les tentatives d'authentification et surveiller les abus.
-   Contrôler les permissions sur chaque opération et chaque ressource
    privée.
-   Prévenir les accès directs non autorisés à des ressources d'autres
    utilisateurs (IDOR/BOLA).
-   Ne jamais considérer un rôle envoyé par le client comme fiable.
-   Répondre de façon prudente aux tentatives de connexion afin de
    limiter l'énumération de comptes.
-   Si des cookies sont utilisés, étudier `HttpOnly`, `Secure`,
    `SameSite` et les protections CSRF nécessaires.

### 6.5 Sécurité applicative

-   Configurer des en-têtes de sécurité adaptés, par exemple via Helmet.
-   Configurer CORS avec une liste d'origines autorisées ; ne pas
    utiliser une politique permissive par défaut en production.
-   Appliquer une limitation de débit aux routes sensibles.
-   Limiter la taille des corps de requête, le nombre de fichiers et la
    durée des opérations.
-   Ne jamais construire des requêtes SQL à partir de chaînes
    utilisateur non contrôlées.
-   Éviter les fuites d'informations dans les erreurs et journaux.
-   Ne pas retourner de stack trace au client en production.
-   Ne pas autoriser un chemin de fichier fourni par l'utilisateur sans
    contrôle strict.
-   Utiliser une protection adaptée aux SSRF si le serveur récupère des
    URL fournies par les utilisateurs.
-   Évaluer les risques XSS, CSRF, injection, brute force, IDOR/BOLA et
    déni de service selon les fonctionnalités.
-   Ne pas considérer CORS comme un mécanisme d'authentification.
-   Garder les dépendances à jour et examiner les alertes de sécurité.

### 6.6 Configuration et cycle de vie

-   Centraliser la configuration et valider les variables
    d'environnement au démarrage.
-   Fournir un `.env.example` sans aucune vraie valeur secrète.
-   Ne jamais committer un fichier `.env` contenant des secrets.
-   Ne pas utiliser des valeurs de production par défaut en
    développement.
-   Utiliser les hooks de cycle de vie NestJS pour gérer proprement les
    connexions et l'arrêt.
-   Prévoir des contrôles de santé qui n'exposent pas d'informations
    sensibles.
-   Configurer des délais d'attente et l'arrêt gracieux lorsque c'est
    pertinent.
-   Séparer les journaux de développement et de production.

### 6.7 Erreurs, logs et observabilité

-   Utiliser des exceptions HTTP cohérentes.
-   Centraliser le formatage des erreurs.
-   Distinguer les erreurs métier attendues des erreurs inattendues.
-   Ajouter des identifiants de corrélation aux requêtes si utile.
-   Journaliser le contexte nécessaire sans secrets ni données
    sensibles.
-   Prévoir des logs structurés en production.
-   Ne pas renvoyer directement les messages d'erreur internes de la
    base de données.
-   Mesurer les erreurs, la latence et les pannes de dépendances.
-   Éviter de journaliser chaque événement à un niveau excessif.
-   Prévoir des alertes pour les pannes qui nécessitent une
    intervention.

## 7. PostgreSQL et Prisma ORM

### 7.1 Modélisation des données

-   Concevoir le schéma en fonction des règles métier réelles.
-   Utiliser des noms cohérents et documenter les exceptions.
-   Définir explicitement les relations, cardinalités et contraintes.
-   Ajouter les contraintes `NOT NULL`, `UNIQUE`, clés étrangères et
    validations SQL pertinentes.
-   Utiliser les types adaptés : ne pas stocker systématiquement des
    nombres, dates ou structures en texte.
-   Définir la stratégie de suppression : `Restrict`, `Cascade`,
    `SetNull` ou logique métier explicite, selon les cas.
-   Choisir une convention cohérente pour les identifiants (`uuid`,
    `cuid`, entiers, etc.).
-   Utiliser les dates en UTC côté serveur et définir clairement les
    règles de fuseau horaire d'affichage.
-   Stocker les montants monétaires dans un type décimal adapté ou en
    unités mineures entières ; éviter les calculs financiers avec des
    nombres flottants.
-   Définir précisément les statuts métier, transitions autorisées et
    valeurs par défaut.
-   Ne pas dupliquer des données calculables sans raison documentée.
-   Ajouter des index selon les requêtes réelles, les filtres et les
    contraintes d'unicité ; vérifier leur coût en écriture.
-   Ne pas indexer chaque colonne par défaut.

### 7.2 Prisma Schema et accès aux données

-   Utiliser `schema.prisma` comme source déclarative du modèle Prisma.
-   Utiliser les migrations versionnées pour faire évoluer le schéma.
-   Ne pas modifier manuellement la base de production pour contourner
    le processus de migration.
-   Ne pas utiliser `prisma db push` comme stratégie normale de
    déploiement en production.
-   Utiliser `prisma migrate dev` en développement et une procédure de
    déploiement de migrations adaptée en production, généralement
    `prisma migrate deploy`.
-   Générer le client Prisma après les changements nécessaires du
    schéma.
-   Ne pas modifier manuellement les fichiers générés.
-   Utiliser des sélections de champs explicites pour limiter les
    données chargées et retournées.
-   Éviter les requêtes N+1 ; privilégier les relations et requêtes
    groupées appropriées.
-   Paginer les grandes collections.
-   Ne pas exposer directement un résultat Prisma complet si celui-ci
    contient des champs internes ou sensibles.
-   Transformer les données en réponses API explicites.
-   Gérer les erreurs Prisma sans exposer les détails internes au
    client.
-   Utiliser des transactions pour les opérations qui doivent réussir ou
    échouer ensemble.
-   Garder les transactions courtes ; éviter les appels réseau externes
    à l'intérieur d'une transaction.
-   Utiliser des opérations atomiques ou des contraintes de base de
    données pour protéger les invariants en cas de concurrence.
-   Vérifier le comportement de concurrence pour les stocks, paiements,
    réservations ou autres opérations critiques.
-   Réutiliser une instance PrismaService gérée par NestJS et fermer
    proprement la connexion.
-   Ne pas créer une nouvelle instance de PrismaClient à chaque requête.

### 7.3 Migrations et données

-   Chaque migration doit être versionnée, relue et testée.
-   Éviter les changements destructifs sans plan de transition.
-   Pour un changement incompatible, envisager une migration en
    plusieurs étapes : ajout, déploiement compatible, transformation des
    données, puis suppression différée.
-   Sauvegarder la base avant une migration risquée.
-   Tester les migrations sur une base de test représentative.
-   Utiliser des scripts de seed uniquement pour les données nécessaires
    au développement, aux tests ou à une initialisation explicitement
    contrôlée.
-   Ne jamais utiliser de données personnelles réelles en test sans base
    légale et protections adaptées.
-   Ne jamais réinitialiser ou supprimer une base de production dans le
    cadre d'une opération de développement.
-   Prévoir une procédure de restauration et la tester.

### 7.4 Transactions et intégrité

-   Appliquer les invariants critiques dans la base de données lorsque
    possible.
-   Utiliser des transactions Prisma pour les opérations multi-écritures
    atomiques.
-   Comprendre le niveau d'isolation requis pour les opérations
    concurrentes.
-   Prévoir les conflits et erreurs de contrainte.
-   Ne pas supposer qu'une vérification préalable suffit à empêcher une
    course concurrente.
-   Pour une opération financière, un stock ou une réservation, prévoir
    une stratégie explicite d'idempotence et de concurrence.
-   Ne pas stocker les données de carte bancaire : utiliser un
    prestataire de paiement conforme lorsque nécessaire.

### 7.5 PostgreSQL en exploitation

-   Utiliser un compte applicatif aux privilèges minimaux.
-   Ne pas exposer le port PostgreSQL publiquement sans nécessité
    exceptionnelle et protection forte.
-   Utiliser TLS sur les connexions réseau lorsque cela est pertinent.
-   Séparer les identifiants de développement, de test et de production.
-   Planifier des sauvegardes et une rétention adaptées.
-   Surveiller l'espace disque, les connexions, les requêtes lentes et
    les erreurs.
-   Documenter les versions de PostgreSQL et les procédures de mise à
    niveau.
-   Protéger les sauvegardes comme la base elle-même.
-   Tester périodiquement la restauration : une sauvegarde non
    restaurable n'est pas une sauvegarde fiable.

## 8. Contrat API entre mobile et serveur

-   Définir les formats de requête et de réponse.
-   Utiliser des DTO côté NestJS et des types client dérivés ou
    maintenus de façon cohérente.
-   Ne pas supposer que les types TypeScript garantissent la validité
    des données reçues à l'exécution.
-   Valider les réponses externes ou utiliser un schéma runtime lorsque
    le risque le justifie.
-   Définir les formats des dates, identifiants, montants et erreurs.
-   Éviter les changements incompatibles sans versionnement ou période
    de transition.
-   Ne pas partager automatiquement tous les modèles Prisma avec le
    mobile.
-   Générer un client API à partir d'OpenAPI si cela réduit les erreurs
    et s'intègre au workflow.
-   Documenter les règles de pagination, tri, filtres et
    authentification.
-   Définir clairement les codes HTTP et le comportement des erreurs.

## 9. Gestion des fichiers et médias

-   Stocker les fichiers hors du code applicatif et du répertoire
    source.
-   Ne pas faire confiance au nom ou au type MIME déclaré par le client.
-   Limiter la taille, le nombre et les formats acceptés.
-   Générer des noms de fichiers côté serveur.
-   Empêcher les traversées de répertoires.
-   Définir qui peut consulter, modifier ou supprimer chaque fichier.
-   Éviter de rendre public par défaut un fichier privé.
-   Pour les médias volumineux, évaluer un stockage objet compatible S3
    plutôt que le disque local.
-   Prévoir la sauvegarde des fichiers et la cohérence avec les
    références en base.
-   Ne pas charger de fichiers exécutables ou dangereux sans besoin et
    contrôle spécifiques.

## 10. Tests

### 10.1 Frontend mobile

Tester : - les composants critiques ; - les formulaires et validations
; - les états de chargement, vide, succès et erreur ; - la navigation et
les accès aux écrans ; - les comportements de session et de déconnexion
; - les interactions importantes ; - les cas de réseau lent ou
indisponible ; - les différences de plateformes iOS et Android
lorsqu'elles comptent.

Utiliser les outils de test déjà retenus par le projet. Ajouter des
tests d'intégration ou end-to-end pour les parcours essentiels.

### 10.2 Backend

Prévoir : - des tests unitaires de la logique métier ; - des tests des
controllers et de la validation ; - des tests d'intégration avec
PostgreSQL de test ; - des tests d'authentification et d'autorisation
; - des tests de permissions sur les ressources ; - des tests de
pagination et filtres ; - des tests des cas d'erreur ; - des tests de
concurrence pour les opérations critiques ; - des tests des migrations
lorsque nécessaire.

### 10.3 Qualité des tests

-   Les tests doivent être déterministes autant que possible.
-   Ne pas dépendre de données de production.
-   Nettoyer les données de test.
-   Éviter les tests qui vérifient uniquement l'implémentation interne
    au lieu du comportement.
-   Couvrir les cas nominaux, limites et erreurs.
-   Corriger les tests devenus obsolètes ; ne pas les désactiver
    simplement pour faire passer la CI.
-   Documenter les tests impossibles à automatiser.

## 11. Sécurité et confidentialité des données

-   Collecter uniquement les données nécessaires.
-   Définir les durées de conservation et les procédures de suppression.
-   Restreindre l'accès aux données selon le besoin.
-   Ne pas stocker de mots de passe en clair.
-   Chiffrer les communications réseau avec HTTPS en production.
-   Protéger les sauvegardes et les secrets.
-   Masquer les informations personnelles dans les logs lorsque
    possible.
-   Prévoir l'export ou la suppression des données utilisateur si le
    produit et la réglementation l'exigent.
-   Évaluer les obligations applicables, notamment RGPD si des données
    personnelles de personnes concernées dans l'UE sont traitées.
-   Documenter les traitements, finalités, durées de conservation et
    accès pertinents.
-   Ne pas considérer ces règles comme un avis juridique complet.

## 12. Environnements et configuration

Prévoir des environnements distincts : - développement ; - test ; -
staging/préproduction si utile ; - production.

Règles : - Chaque environnement possède sa propre configuration et ses
propres identifiants. - Ne jamais pointer les tests vers la base de
production. - Fournir `.env.example` avec des valeurs fictives et des
descriptions. - Ajouter les fichiers secrets à `.gitignore`. - Valider
la configuration au démarrage. - Éviter les valeurs sensibles dans les
arguments de commande ou les logs. - Utiliser le gestionnaire de secrets
de la plateforme en production si disponible. - Documenter les
variables, leur rôle et si elles sont obligatoires. - Les variables
`EXPO_PUBLIC_*` sont publiques et ne doivent contenir aucun secret.

## 13. Git et workflow de développement

-   Utiliser Git pour tout le code source et la configuration non
    secrète.
-   Ne jamais committer les secrets, tokens, certificats privés, bases
    locales ou fichiers de build volumineux non nécessaires.
-   Faire des commits cohérents, décrivant une modification logique.
-   Garder les changements ciblés et faciles à relire.
-   Éviter de mélanger refactorisation massive et changement fonctionnel
    dans le même commit.
-   Relire les différences avant de committer.
-   Utiliser des branches et revues de code selon la taille de l'équipe.
-   Ajouter des contrôles CI pour le lint, le typecheck, les tests et le
    build.
-   Vérifier les migrations et les variables d'environnement avant un
    déploiement.
-   Documenter les procédures de retour arrière.
-   Ne pas réécrire l'historique partagé sans coordination.
-   À chaque fin de grande étape, proposer systématiquement à l'utilisateur un commit selon le modèle :
    `git add . && git commit -m "[commentaire]" && git push`
-   À chaque fin de grande étape, produire ou mettre à jour une fiche de suivi d'étape (objectifs, réalisations techniques, validations/tests exécutés, décisions d'architecture et points suivants).

## 14. CI/CD et déploiement

-   Construire et tester l'application dans un environnement
    reproductible.
-   Séparer les secrets de la configuration versionnée.
-   Ne déployer que des versions validées.
-   Exécuter les migrations avec une procédure explicite et contrôlée.
-   Prévoir une stratégie de retour arrière pour le code et les données
    ; un rollback de base n'est pas toujours possible après une
    migration destructive.
-   Vérifier les endpoints de santé après déploiement.
-   Conserver les logs et les informations de version utiles au
    diagnostic.
-   Éviter les déploiements automatiques en production sans contrôles
    adaptés.
-   Pour Expo, distinguer les builds natifs, les mises à jour OTA et les
    changements nécessitant une nouvelle compilation.
-   Ne pas utiliser les mises à jour OTA pour contourner les règles de
    compatibilité native ou les contrôles de publication.
-   Documenter les étapes de publication iOS et Android.

## 15. Performance et évolutivité

-   Mesurer les problèmes avant d'optimiser.
-   Ajouter des index à partir des requêtes observées et des plans
    d'exécution.
-   Éviter les appels API redondants et les payloads excessifs.
-   Paginer les réponses volumineuses.
-   Mettre en cache uniquement avec une stratégie d'invalidation claire.
-   Limiter la concurrence et la taille des traitements coûteux.
-   Utiliser une file de tâches pour les traitements longs ou
    réessayables si le besoin le justifie.
-   Définir des timeouts pour les services externes.
-   Ne pas faire dépendre la réponse HTTP d'un traitement long qui
    pourrait être asynchrone.
-   Surveiller les temps de réponse, erreurs, consommation mémoire et
    connexions PostgreSQL.
-   Ne pas introduire prématurément des microservices ou une
    architecture complexe.

## 16. Accessibilité, ergonomie et contenu

-   Les écrans doivent avoir un objectif clair.
-   Les actions importantes doivent être identifiables.
-   Prévoir des états vides utiles et des erreurs compréhensibles.
-   Ne pas laisser l'utilisateur sans retour pendant une opération
    longue.
-   Respecter les principes d'accessibilité mobile.
-   Éviter les confirmations inutiles, mais demander confirmation pour
    les actions destructrices.
-   Les textes doivent être cohérents et relus.
-   Les formulaires doivent indiquer clairement le format attendu.
-   Prévoir les états de session expirée et de perte de connexion.

## 17. Règles de collaboration avec une IA de développement

Lorsqu'un assistant IA intervient sur le projet, il doit respecter les
règles suivantes :

1.  Lire les fichiers concernés et leurs dépendances avant de proposer
    une modification.
2.  Comprendre l'architecture, les conventions et les scripts existants.
3.  Ne pas remplacer une implémentation fonctionnelle sans
    justification.
4.  Ne pas créer de fichiers ou dépendances supplémentaires sans besoin
    réel.
5.  Ne pas supprimer de fonctionnalités existantes sans demande
    explicite.
6.  Ne pas inventer des fichiers, API, schémas, commandes ou résultats
    de tests.
7.  En cas d'information manquante, demander le fichier ou préciser
    l'hypothèse.
8.  Proposer des modifications ciblées et expliquer leur impact.
9.  Préserver la compatibilité entre mobile, API et schéma de base.
10. Mettre à jour les tests et la documentation lorsque le comportement
    change.
11. Vérifier les erreurs de typage, lint, tests et build lorsque les
    outils le permettent.
12. Signaler les contrôles qui n'ont pas pu être exécutés.
13. Ne jamais exposer ou reproduire des secrets dans la réponse.
14. Ne pas appliquer de migration destructive sans avertissement
    explicite.
15. Fournir les étapes de validation et les commandes exactes.
16. Distinguer clairement ce qui a été modifié, ce qui reste à faire et
    ce qui est seulement recommandé.
17. Produire systématiquement une fiche de suivi par étape documentant les réalisations, les contrôles effectués et la suite du planning.

## 18. Checklist avant livraison

### Frontend

-   [ ] Les écrans et composants suivent les conventions du projet.
-   [ ] Les états de chargement, erreur, vide et succès sont gérés.
-   [ ] Les formulaires sont validés côté client et côté serveur.
-   [ ] Aucun secret n'est inclus dans le bundle.
-   [ ] Les sessions et données utilisateur sont nettoyées à la
    déconnexion.
-   [ ] L'accessibilité et les tailles d'écran importantes ont été
    vérifiées.
-   [ ] Les erreurs réseau sont gérées.

### Backend

-   [ ] Les entrées sont validées.
-   [ ] Les permissions sont contrôlées côté serveur.
-   [ ] Les réponses ne divulguent pas de données internes.
-   [ ] Les erreurs sont cohérentes.
-   [ ] Les limites, filtres et paramètres sont contrôlés.
-   [ ] Les secrets sont chargés depuis la configuration sécurisée.
-   [ ] Les tests pertinents passent.

### Base de données

-   [ ] Le schéma et les migrations sont versionnés.
-   [ ] Les contraintes et index pertinents sont définis.
-   [ ] Les requêtes ne chargent pas inutilement des données.
-   [ ] Les opérations multi-écritures utilisent les transactions
    nécessaires.
-   [ ] Les migrations ont été testées.
-   [ ] Les sauvegardes et la restauration sont documentées.

### Livraison

-   [ ] Le lint passe.
-   [ ] Le typecheck passe.
-   [ ] Les tests pertinents passent.
-   [ ] Le build passe lorsque disponible.
-   [ ] Les variables d'environnement sont documentées.
-   [ ] Les changements d'API et de base sont documentés.
-   [ ] Les risques ou contrôles non effectués sont signalés.

## 19. Commandes et scripts

Les noms exacts dépendent du dépôt. Conserver une liste claire de
scripts dans les `package.json` appropriés, par exemple :

``` json
{
  "scripts": {
    "lint": "commande-de-lint",
    "typecheck": "commande-de-verification-types",
    "test": "commande-de-tests",
    "build": "commande-de-build"
  }
}
```

Cet exemple est illustratif : remplacer les valeurs par de vraies
commandes compatibles avec les outils effectivement installés. Ne pas
copier ces valeurs fictives telles quelles dans un projet.

Pour Prisma, les commandes courantes comprennent selon la version et la
configuration : - génération du client Prisma ; - création et
application de migrations en développement ; - application contrôlée des
migrations en production ; - ouverture de Prisma Studio pour les
environnements autorisés.

Vérifier la documentation correspondant aux versions réellement
installées avant de définir les commandes finales.

## 20. Décisions à confirmer pour chaque projet

Ce document fournit une base générale. Au démarrage d'un projet,
confirmer les points suivants :

-   monorepo ou dépôts séparés ;
-   gestionnaire de paquets ;
-   version de Node.js ;
-   version d'Expo et de React Native ;
-   stratégie de navigation ;
-   solution de gestion des données serveur ;
-   stratégie de gestion d'état global ;
-   format de l'API et documentation OpenAPI ;
-   stratégie d'authentification ;
-   gestion des rôles et permissions ;
-   stratégie de validation ;
-   version de PostgreSQL ;
-   version de Prisma et stratégie de migrations ;
-   stockage des fichiers ;
-   hébergement et déploiement ;
-   sauvegardes et supervision ;
-   niveau de tests attendu ;
-   exigences de confidentialité et de conformité.

**Règle finale :** ces règles sont un cadre de référence, pas une raison
de compliquer le projet. Les décisions doivent rester adaptées aux
besoins réels, aux versions installées, au niveau de risque et aux
contraintes du produit.
