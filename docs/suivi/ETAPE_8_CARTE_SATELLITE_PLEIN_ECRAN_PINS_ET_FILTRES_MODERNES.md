# Fiche de Suivi — Étape 8 : Carte Plein Écran, Épingles (Pins) Vectorielles & Filtres Flottants Modernes

**Date :** 15 octobre 2026  
**Auteur :** Antigravity AI Assistant & Rafael Martinez  
**Projet :** AlterTrack — Gestionnaire Intelligent de Candidatures d'Alternance  
**Statut de l'étape :** ✅ TERMINÉE ET VALIDÉE

---

## 1. Objectifs de l'étape

Conformément à la demande de l'utilisateur (*« pour la map, je veux que la map prenne la majorité de l'écran et que les filtres soit mise d'une manière plus moderne et pour les points avec l'adresse des entreprise met plutôt un pin au lieu de »*) et au document de référence [Regles.md](../../Regles.md) :

1. **Plein écran immersif pour la carte** : Faire en sorte que la carte satellite prenne 100% de la hauteur d'écran utile (au-dessus de la barre de navigation `MainTabBar`), sans être écrasée par des en-têtes ou des blocs statiques.
2. **Remplacement des cercles par de vraies épingles (Pins) de carte** : Remplacer les simples pastilles rondes (`border-radius: 50%`) par de véritables épingles vectorielles *teardrop* (forme goutte avec pointe aiguille au sol orientée avec précision sur les coordonnées GPS exactes).
3. **Filtres modernes en surcouche flottante (Glassmorphism)** :
   - Capsule de recherche flottante translucide en haut avec recherche en direct et bouton d'accès aux filtres avec badge de comptage.
   - Barre de défilement horizontale de pilules de filtres interactives (tous, statuts avec couleurs officielles et compteurs en temps réel, filtres de rayon < 15 km, < 30 km, etc., et bascule rapide vers la vue liste radar).
4. **Réactivité 60fps sans rechargement de page** : Mise à jour dynamique des épingles via injection JavaScript Leaflet (`window.updateMapData`) pour un filtrage instantané sans clignotement ni rechargement de tuiles satellites.
5. **Fiche flottante interactive au clic** : Affichage d'une carte moderne en bas d'écran avec nom, commune, badge de statut, calcul de distance, bouton d'itinéraire GPS en 1 clic (Google Maps / Waze) et accès direct à la fiche entreprise complète.

---

## 2. Réalisations techniques

### 2.1 Punaises 3D Sphériques Réalistes & Gestion du Zoom (`CompanyMapView.tsx`)
- **Modélisation fidèle de la punaise de carte (pushpin) 3D** conforme à la photo de référence fournie par l'utilisateur :
  - Tête sphérique laquée brillante avec dégradé radial 3D (`#sphereVolume`), reflet spéculaire supérieur droit laqué blanc et ombre portée au sol.
  - Aiguille / tige métallique effilée en acier chromé (`#needleChrome`) pointant vers le bas avec pointe d'ancrage de haute précision au sol `(16, 47)`.
  - **Retrait strict de tous les émojis** : aucun émoji (`🏢`, `🏠`, `🎯`) sur les punaises pour un rendu professionnel, épuré et ultra-moderne.
  - Punaise de repère fixe / domicile en cyan signature AlterTrack avec disque central épuré et halo d'impulsion au sol.
- **Affichage dynamique des noms d'entreprises selon le zoom** :
  - **En zoom global (< 13)** (vue d'ensemble de la région / du département / du pays) : les noms d'entreprises sont automatiquement masqués pour conserver une carte nette, limpide et fluide sans encombrement visuel.
  - **En zoom ciblé (>= 13)** (zoom sur une commune, un quartier ou une zone d'activité) : les noms d'entreprises apparaissent automatiquement sous leur punaise respective avec une transition douce.
  - Les fiches d'entreprises et popups restent consultables par simple tap à tout niveau de zoom.

### 2.2 Agencement Plein Écran (`HomeScreen.tsx`)
- Mise en place d'un rendu dédié immédiat lorsque `viewMode === 'MAP'` :
  - La carte prend l'intégralité du conteneur `flex: 1`.
  - Retrait des en-têtes fixes encombrants et des doubles barres de filtres qui réduisaient la carte à une petite fenêtre.
  - La navigation se fait sans couture via l'onglet **Carte radar** de la barre inférieure `MainTabBar`.

### 2.3 Système de Filtres Flottants Glassmorphism (`CompanyMapView.tsx`)
- **Capsule de recherche flottante supérieure** :
  - Positionnement absolu au-dessus de la carte avec fond sombre translucide (`rgba(13, 19, 33, 0.92)`), bordure cyan discrète et ombre douce.
  - Champ de saisie instantané avec icône de loupe et bouton d'effacement rapide.
  - Bouton Filtres dédié avec pastille numérique affichant le nombre de filtres actifs et ouvrant la `FiltersModal`.
- **Barre horizontale de pilules de filtres** :
  - Défilement fluide de puces interactives au design moderne.
  - Puce de bascule rapide `🛰️ Vue Satellite` / `🎯 Vue Radar (liste)`.
  - Puces de statuts avec pastilles de couleur et compteurs : `Tous`, `À envoyer`, `En attente`, `À relancer`, `Réponses`, `À appeler`, `Accepté`, `Refusé`.
  - Puces de rayon kilométrique : `Toutes dist.`, `< 15 km`, `< 30 km`, `< 50 km`.
- **Contrôles flottants de carte** :
  - Puce « Tout voir » pour recadrer la vue sur l'ensemble des épingles affichées.
  - Puce « Mon adresse » pour recentrer instantanément sur son domicile/école.

---

## 3. Contrôles et Validations Exécutés

Conformément à la règle **1.12** (*« Ne jamais prétendre qu'une vérification a réussi si elle n'a pas été exécutée »*) :

| Contrôle | Commande | Résultat |
| :--- | :--- | :--- |
| **Typage TypeScript Mobile** | `cd apps/mobile && npx tsc --noEmit` | ✅ **0 erreur** (Code retour 0) |
| **Tests Unitaires Backend** | `npm --prefix apps/api run test` | ✅ **39/39 tests validés** (6 suites) |

---

## 4. Proposition de Commit Git

Conformément à [Regles.md](../../Regles.md) §13 :

```bash
git add . && git commit -m "feat(map): punaises 3d spheriques sans emoji et affichage adaptatif des noms selon le zoom" && git push
```

