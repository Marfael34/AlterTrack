# Fiche de Suivi - Étape 26 : Lot 3 du cahier des charges — Retour par geste (React Navigation)

**Date :** 27 Novembre 2026
**Version :** `v1.6.0` (MINOR : nouvelle fonctionnalité, changement de structure de la navigation)
**Branche :** `DEV`
**Référence :** `cahier-des-charges-altertrack_maj.md`, évolution #3
**Statut :** Développé, typage et bundle OK. **Nouveau build natif (APK) obligatoire.** Recette sur téléphone à faire.

---

## 1. Objectif

Revenir à l'écran précédent avec les gestes natifs du téléphone (glissement iOS, geste ou bouton retour Android), en plus du bouton de l'en-tête.

## 2. Décision

| Sujet | Décision |
|-------|----------|
| Navigation | Remplacement de la navigation maison (`App.tsx`, rendu conditionnel par `currentScreen`) par **React Navigation, native stack**. Choix de l'utilisateur (option 1). |

Pourquoi : seule la pile native donne le *swipe back* iOS avec l'animation système, le retour Android géré par le système et l'interception fiable du retour (`usePreventRemove`).

## 3. Réalisations techniques

### 3.1 Dépendances (`apps/mobile`)

Installées avec `npx expo install`, donc dans les versions de la matrice Expo SDK 58. `npx expo install --check` répond « Dependencies are up to date ».

- `@react-navigation/native` ^7.5.2
- `@react-navigation/native-stack` ^7.21.1
- `react-native-screens` ~4.30.1 : **module natif**, d'où le nouveau build obligatoire.

### 3.2 Structure de navigation

- **`src/navigation/types.ts`** : `RootStackParamList` contient `Main`, `CompanyDetail { company }`, `AddCompany` et `Settings`.
- **`src/navigation/RootNavigator.tsx`** :
  - `Main` : onglets Candidatures / Carte / Profil et barre d'onglets, comme avant ;
  - `CompanyDetail`, `AddCompany` et `Settings` sont empilés au-dessus, sans barre d'onglets ;
  - `headerShown: false` : chaque écran garde son propre en-tête, et le geste reste actif (`gestureEnabled: true`) ;
  - thème sombre aux couleurs de l'app, pour éviter un flash blanc pendant les transitions.
- **`App.tsx`** : garde l'état partagé (point de référence, statistiques du badge, compteur de rafraîchissement) et le bandeau de mise à jour, puis affiche `RootNavigator`. L'écran de connexion reste en dehors de la navigation : la déconnexion démonte toute la pile et efface son état.

### 3.3 Changements de comportement

| Avant | Maintenant | Raison |
|-------|------------|--------|
| « Ajouter » était un onglet, avec la barre visible | « Ajouter » ouvre un écran empilé, sans barre d'onglets | Le geste retour et la confirmation d'abandon s'y appliquent |
| Le retour d'une fiche ramenait toujours à la liste | Le retour ramène à l'onglet d'origine (liste ou carte) | Comportement standard d'une pile |
| La liste était démontée puis rechargée de zéro au retour | La liste reste montée et se recharge en arrière-plan à chaque retour | Les cartes restent à jour (y compris l'historique, EF-2.6) et la position de défilement est conservée |
| Le Profil était remonté au retour des Paramètres | Inchangé : le Profil est remonté à chaque retour sur l'écran principal | Ses statistiques sont chargées au montage |

### 3.4 Exigences du cahier des charges

- **EF-3.1 (iOS)** : glissement depuis le bord gauche sur tous les écrans empilés, avec l'animation native.
- **EF-3.2 (Android)** :
  - le geste et le bouton retour système dépilent l'écran ;
  - `app.json` : `android.predictiveBackGestureEnabled` passe à `true`, ce qui active le *predictive back* sur Android 14+.
- **EF-3.3** : fiche entreprise, ajout d'entreprise et Paramètres. Il n'existe pas d'écran séparé pour le détail d'un événement ou pour le CV : ce sont des modales (événements) ou une section du Profil (CV).
- **EF-3.4** :
  - depuis Carte ou Profil, le retour Android ramène à l'onglet Candidatures (`BackHandler`, actif seulement quand l'écran principal est affiché) ;
  - depuis Candidatures, c'est le comportement système standard.
- **EF-3.5** : `src/hooks/useDiscardChangesGuard.ts`, basé sur `usePreventRemove` :
  - intercepte le bouton de l'en-tête, le *swipe* iOS et le retour Android ;
  - affiche « Abandonner les modifications ? » avec **Annuler** et **Abandonner**, via la modale d'alerte de l'app, qui fonctionne aussi sur web ;
  - les sorties voulues (enregistrement, import, suppression) passent par `leaveWithoutConfirm()` et ne demandent pas de confirmation ;
  - le formulaire est considéré comme modifié dans ces cas :

    | Écran | Modifié si… |
    |-------|-------------|
    | Ajout d'entreprise | un champ est rempli ou le statut n'est plus « Envoi automatique » |
    | Fiche entreprise | un champ diffère de la dernière version enregistrée, après `trim`, champs vides et e-mail factice `@sans-email.altertrack` |
    | Paramètres | le profil, les identifiants Gmail ou le modèle de mail ont changé. Les champs de l'e-mail de test ne comptent pas |
- **EF-3.6** : `src/components/SwipeDownSheet.tsx`, réalisé avec `PanResponder` et `Animated`, sans nouvelle dépendance.
  - Une poignée en haut de la feuille permet de la fermer en glissant vers le bas : au-delà de 120 px ou à vitesse rapide, la feuille se ferme ; sinon, elle revient en place.
  - Le geste part **uniquement de la poignée**, pour ne pas entrer en conflit avec le défilement ou les champs du contenu.
  - La poignée a un libellé d'accessibilité et une action « activer » qui ferme la feuille.
  - Appliqué à : ajout d'action, modification d'action, aperçu d'e-mail, adresse de référence, Filtres & Tri (plein écran) et modification du profil.
  - Le bouton retour Android fermait déjà ces modales (`onRequestClose`).

### 3.5 Correctifs liés

- **Fiche entreprise, enregistrement** : quand le statut change, la fiche gardait en mémoire la réponse de `updateCompany`, avec l'ancien statut. Elle garde maintenant celle de `updateCompanyStatus`. Sans ce correctif, la fiche aurait paru encore modifiée juste après l'enregistrement.
- **Fiche entreprise, e-mail vidé** : un e-mail vidé n'est pas enregistré (l'ancien est conservé). Le champ affiche de nouveau l'e-mail réellement en base.
- Le domaine factice `@sans-email.altertrack`, répété 4 fois, devient la constante `NO_EMAIL_DOMAIN`.
- `app.json` : version `1.6.0`.

## 4. Contrôles exécutés

| Contrôle | Commande | Résultat |
|----------|----------|----------|
| Typage mobile | `cd apps/mobile && npx tsc --noEmit` | ✅ 0 erreur |
| Compatibilité Expo | `npx expo install --check` | ✅ Dependencies are up to date |
| Bundle web | `npx expo export -p web` | ✅ |
| Tests API (non-régression) | `cd apps/api && npx jest` | ✅ 84/84 |

**Non exécutés :**
- **aucun test sur un vrai téléphone ni dans un navigateur.** Les gestes, les animations, le *predictive back* et la confirmation n'ont pas été vérifiés visuellement ;
- le lint mobile : aucune configuration ESLint dans `apps/mobile` ;
- le build EAS de l'APK.

`npm install` signale 5 vulnérabilités « moderate » dans l'arbre des dépendances. Elles n'ont pas été analysées et `npm audit fix --force` n'a pas été lancé.

## 5. Recette manuelle à faire (nouvel APK obligatoire)

`react-native-screens` est un module natif. **Une mise à jour OTA ou l'ancien APK ne suffisent pas**, il faut construire un nouvel APK (`eas build -p android`).

1. Ouvrir une fiche, puis revenir :
   - Android : geste depuis le bord, puis bouton retour ;
   - iOS : glissement depuis le bord gauche.
2. Ouvrir une fiche depuis la **carte**, revenir : on retrouve la carte.
3. Modifier un champ d'une fiche, faire le geste retour : la confirmation s'affiche. **Annuler** reste sur la fiche, **Abandonner** revient à la liste. Après **Enregistrer**, le retour ne demande plus rien.
4. Même test sur « Ajouter » (champ rempli) et sur Paramètres (modèle de mail modifié).
5. Ajouter une action dans une fiche, revenir : la carte affiche l'action (lot 2) et la liste est restée à la même position.
6. Onglet Profil ou Carte, puis bouton retour Android : retour à Candidatures. Un nouveau retour applique le comportement système.
7. Ouvrir « Ajouter une action » ou « Filtres & Tri » et glisser la poignée vers le bas : la feuille se ferme. Faire défiler le contenu de la feuille : elle ne se ferme pas.
8. Android 14+ : en début de geste retour, l'aperçu *predictive back* s'affiche. Si un problème apparaît, mettre `predictiveBackGestureEnabled` à `false` dans `app.json`, ce qui rétablit le retour classique.
9. Version web : navigation et confirmation, avec le bouton de l'en-tête.

## 6. Risques et points à suivre

- **Changement de structure** : toute la navigation passe par React Navigation. Un défaut éventuel n'apparaîtra qu'à l'usage, d'où la recette du §5.
- Sur web, le bouton retour du navigateur ne dépile pas les écrans : aucun `linking` n'est configuré, ce n'est pas demandé.
- La modale de configuration du serveur (`ServerConfigModal`) n'a pas de `onRequestClose` : le retour Android ne la ferme pas. C'était déjà le cas avant, et non traité ici.
- La modification du profil, dans une modale du Profil, ne demande pas de confirmation à la fermeture.

## 7. Suite du planning

- **Lot 4** : icône de l'app (#4), après livraison des visuels (`icon.png` 1024×1024, premier plan adaptatif 432×432, icône monochrome, splash).
- **Recette** : tests sur appareils Android et iOS (lots 1 à 3).

## 8. Proposition de commit

Les étapes 25, 26 et 27 sont livrées dans un seul commit :

```bash
git add -A && git commit -m "v1.6.0 feat: derniers événements sur les cartes, retour par geste (React Navigation), dev Expo 100 % local en une commande et suppression de Cloudflare" && git tag v1.6.0 && git push && git push --tags
```
