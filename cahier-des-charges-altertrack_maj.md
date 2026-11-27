# Cahier des charges — Améliorations Altertrack

**Projet :** Altertrack
**Version du document :** 1.0
**Date :** 27 novembre 2026
**Objet :** Correctifs et évolutions fonctionnelles de l'application

---

## 1. Contexte

Altertrack sert à suivre les candidatures (entreprises contactées, historique des échanges, relances). Ce document décrit cinq évolutions qui corrigent un bug et améliorent l'usage au quotidien.

| # | Évolution | Type | Priorité |
|---|-----------|------|----------|
| 1 | Corriger l'importation du CV | Correctif (bug) | 🔴 Haute |
| 2 | Afficher les derniers événements de l'historique sur la carte entreprise | Évolution | 🟠 Moyenne |
| 3 | Navigation retour par geste | Évolution UX | 🟠 Moyenne |
| 4 | Vignette (icône) de l'app avec le logo seul | Évolution visuelle | 🟢 Basse |
| 5 | Délai de relance des appels : 2 semaines → 1 semaine | Évolution métier | 🔴 Haute |

---

## 2. Évolution 1 — Corriger l'importation du CV

### 2.1 Problème
L'importation du CV ne fonctionne pas correctement.

### 2.2 Objectif
L'utilisateur doit pouvoir importer son CV sans erreur, le retrouver dans l'app et le consulter.

### 2.3 Exigences fonctionnelles
- **EF-1.1** : L'utilisateur peut choisir un fichier depuis le stockage du téléphone (sélecteur de fichiers natif) et, si possible, depuis le cloud (Google Drive, iCloud…).
- **EF-1.2** : Formats acceptés : **PDF** au minimum ; DOCX, PNG et JPG en option.
- **EF-1.3** : Taille maximale : **10 Mo** (valeur à confirmer).
- **EF-1.4** : Une fois importé, le CV est enregistré de façon durable : il reste disponible après la fermeture et le redémarrage de l'app.
- **EF-1.5** : L'utilisateur voit le nom du fichier, la date d'import et un aperçu (ou un bouton « Ouvrir »).
- **EF-1.6** : L'utilisateur peut **remplacer** ou **supprimer** son CV.

### 2.4 Gestion des erreurs
| Cas | Comportement attendu |
|-----|----------------------|
| Format non supporté | Message : « Format non pris en charge. Importez un fichier PDF. » |
| Fichier trop lourd | Message : « Le fichier dépasse 10 Mo. » |
| Permission d'accès aux fichiers refusée | Message avec un bouton vers les réglages du téléphone |
| Échec de l'enregistrement ou de l'envoi | Message d'erreur et bouton « Réessayer » ; aucun fichier corrompu n'est enregistré |
| Import annulé par l'utilisateur | Retour à l'écran précédent sans message d'erreur |

### 2.5 Points à vérifier pendant le diagnostic
- Les permissions de stockage (Android 13+ : `READ_MEDIA_*` / sélecteur de documents ; iOS : `UIDocumentPicker`).
- La gestion des URI temporaires : il faut copier le fichier dans le stockage de l'app plutôt que garder un lien vers l'URI d'origine, qui peut expirer.
- Le type MIME envoyé et le type attendu.
- L'envoi au backend, si les CV sont stockés côté serveur.

### 2.6 Critères d'acceptation
- [ ] Un PDF de 2 Mo s'importe et s'affiche sur Android et sur iOS.
- [ ] Le CV est toujours là après un redémarrage de l'app.
- [ ] Chaque cas d'erreur du tableau 2.4 affiche le bon message.
- [ ] Le remplacement et la suppression fonctionnent.

---

## 3. Évolution 2 — Derniers événements de l'historique sur la carte entreprise

### 3.1 Objectif
Voir en un coup d'œil où en est chaque entreprise sans ouvrir sa fiche détaillée.

### 3.2 Exigences fonctionnelles
- **EF-2.1** : Chaque carte entreprise de la liste affiche les **2 derniers événements** de son historique (le nombre doit pouvoir changer facilement, par exemple 1 à 3).
- **EF-2.2** : Pour chaque événement, la carte affiche :
  - une icône selon le type (appel 📞, email ✉️, entretien 🤝, candidature envoyée 📤, relance 🔁, refus ❌, etc.) ;
  - un libellé court (une ligne, tronqué avec « … » si trop long) ;
  - une date relative (« il y a 3 j », « hier », « aujourd'hui »).
- **EF-2.3** : Les événements sont triés du plus récent au plus ancien.
- **EF-2.4** : Si l'entreprise n'a aucun événement, la carte affiche « Aucun événement » en texte discret.
- **EF-2.5** : Un appui sur la carte ouvre toujours la fiche détaillée avec l'historique complet.
- **EF-2.6** : La carte se met à jour aussitôt qu'un événement est ajouté, modifié ou supprimé.

### 3.3 Contraintes
- La carte doit rester compacte : 2 lignes d'événements au maximum, pour ne pas surcharger la liste.
- Performance : il faut éviter une requête par carte. Le dernier ou les derniers événements doivent être chargés en une seule requête, ou stockés directement sur l'entité entreprise.

### 3.4 Maquette indicative
```
┌──────────────────────────────────────┐
│ [Logo]  Entreprise ABC      ● En cours│
│         Développeur alternance        │
│ ──────────────────────────────────── │
│ 📞 Appel RH – rappel prévu   il y a 2j│
│ 📤 Candidature envoyée       il y a 9j│
└──────────────────────────────────────┘
```

### 3.5 Critères d'acceptation
- [ ] Les 2 derniers événements s'affichent sur chaque carte, avec icône, libellé et date.
- [ ] L'ajout d'un événement se voit tout de suite sur la carte.
- [ ] Une entreprise sans historique affiche « Aucun événement ».
- [ ] La liste défile toujours de façon fluide avec plus de 100 entreprises.

---

## 4. Évolution 3 — Retour en arrière par geste

### 4.1 Objectif
Revenir à l'écran précédent avec les gestes natifs du téléphone, et pas seulement avec le bouton retour de l'interface.

### 4.2 Exigences fonctionnelles
- **EF-3.1 (iOS)** : Le glissement depuis le bord gauche de l'écran vers la droite (*swipe back*) revient à l'écran précédent, avec l'animation native.
- **EF-3.2 (Android)** : Le geste retour système (glissement depuis le bord gauche ou droit) et le bouton retour physique ou virtuel reviennent à l'écran précédent. Prise en charge du *predictive back* (Android 14+) si la stack technique le permet.
- **EF-3.3** : Le geste fonctionne sur tous les écrans secondaires : fiche entreprise, détail d'un événement, paramètres, CV, etc.
- **EF-3.4** : Sur l'écran racine (accueil), le geste retour ne fait pas quitter l'app par erreur. Sur Android : comportement système standard, ou appuyer deux fois pour quitter.
- **EF-3.5** : Sur un formulaire avec des modifications non enregistrées, le geste retour affiche une confirmation : « Abandonner les modifications ? » avec les choix **Annuler** et **Abandonner**.
- **EF-3.6** : Les modales et les *bottom sheets* se ferment par un glissement vers le bas.

### 4.3 Points techniques (selon la stack)
- **React Native / Expo (React Navigation)** : vérifier `gestureEnabled: true` et éviter les `headerLeft` personnalisés qui désactivent le geste. Utiliser `beforeRemove` pour la confirmation.
- **Flutter** : utiliser `CupertinoPageRoute` ou `PageTransitionsTheme` pour iOS, et `PopScope` pour intercepter le retour.
- **Natif** : `interactivePopGestureRecognizer` (iOS) et `OnBackPressedDispatcher` (Android).

### 4.4 Critères d'acceptation
- [ ] Le *swipe back* fonctionne sur tous les écrans secondaires sous iOS.
- [ ] Le geste et le bouton retour Android fonctionnent partout.
- [ ] La confirmation s'affiche quand on quitte un formulaire modifié.
- [ ] Aucun conflit avec les gestes horizontaux internes (carrousels, *swipe* pour supprimer une carte).

---

## 5. Évolution 4 — Vignette de l'app avec le logo seul

### 5.1 Objectif
L'icône de l'app sur l'écran d'accueil du téléphone ne doit afficher **que le logo Altertrack**, sans texte, fond chargé ni autre élément.

### 5.2 Exigences fonctionnelles
- **EF-4.1** : L'icône ne contient que le logo, centré, sur un fond uni (couleur de la charte) ou transparent selon la plateforme.
- **EF-4.2** : Pas de texte dans l'icône. Le nom « Altertrack » est déjà affiché par le système sous l'icône.
- **EF-4.3** : Le logo respecte les **zones de sécurité** pour ne pas être rogné :
  - **Android (icône adaptative)** : premier plan de 108×108 dp, logo contenu dans le cercle central de 66 dp ; calque d'arrière-plan séparé.
  - **Android 13+** : fournir une **icône monochrome** pour les icônes à thème.
  - **iOS** : image de 1024×1024 px sans transparence ni coins arrondis (iOS les applique). Prévoir les variantes sombre et teintée (iOS 18+).
- **EF-4.4** : L'écran de démarrage (*splash screen*) reprend le même logo, pour rester cohérent.

### 5.3 Livrables graphiques
| Fichier | Format | Usage |
|---------|--------|-------|
| `icon.png` | 1024×1024 PNG | iOS / source principale |
| `adaptive-icon-foreground.png` | 432×432 PNG transparent | Android, premier plan |
| `adaptive-icon-background` | Couleur unie ou PNG | Android, arrière-plan |
| `monochrome-icon.png` | 432×432 PNG | Android 13+, icônes à thème |
| `splash.png` | Selon la plateforme | Écran de démarrage |

### 5.4 Critères d'acceptation
- [ ] L'icône n'affiche que le logo sur Android et sur iOS.
- [ ] Le logo n'est rogné avec aucune forme d'icône Android (cercle, carré arrondi, goutte).
- [ ] Le rendu est correct en mode clair, en mode sombre et en icônes à thème.

---

## 6. Évolution 5 — Délai de relance des appels : 1 semaine au lieu de 2

### 6.1 Contexte
Aujourd'hui, l'app propose une relance d'appel **14 jours** après le dernier contact. Ce délai est trop long.

### 6.2 Objectif
Passer ce délai à **7 jours**.

### 6.3 Exigences fonctionnelles
- **EF-5.1** : Le délai par défaut avant relance d'un appel passe de **14 à 7 jours**.
- **EF-5.2** : Le délai est défini dans une **constante unique ou un paramètre de configuration**, et non codé en dur à plusieurs endroits. Par exemple : `CALL_FOLLOW_UP_DELAY_DAYS = 7`.
- **EF-5.3** : Tous les éléments qui dépendent de ce délai sont mis à jour :
  - les notifications et rappels programmés ;
  - les badges et indicateurs « À relancer » sur les cartes entreprise ;
  - les filtres et tris (« Entreprises à relancer ») ;
  - les textes de l'interface qui mentionnent « 2 semaines » ou « 14 jours ».
- **EF-5.4 (migration)** : Les relances déjà programmées pour les entreprises existantes sont recalculées avec le nouveau délai, à partir de la date du dernier appel. Si la nouvelle date est déjà passée, l'entreprise passe directement en « À relancer ».
- **EF-5.5 (optionnel)** : Permettre à l'utilisateur de choisir son délai dans les Paramètres (3, 5, 7, 10 ou 14 jours), avec 7 jours par défaut.

### 6.4 Règle de calcul
```
date_relance = date_dernier_appel + 7 jours
si aujourd'hui >= date_relance ET aucun nouvel événement depuis → statut "À relancer"
```

### 6.5 Critères d'acceptation
- [ ] Un appel enregistré aujourd'hui génère une relance dans 7 jours.
- [ ] Les relances existantes sont recalculées après la mise à jour.
- [ ] Plus aucune mention de « 2 semaines » ou « 14 jours » liée aux appels dans l'interface.
- [ ] La notification de relance arrive au bon jour.

---

## 7. Exigences transverses

- **Plateformes** : Android et iOS (versions minimales à confirmer).
- **Non-régression** : les fonctionnalités existantes (ajout d'entreprise, historique, notifications) doivent continuer à fonctionner.
- **Performances** : aucune dégradation perceptible de la fluidité de la liste des entreprises.
- **Données** : aucune perte de données utilisateur lors de la mise à jour (CV, historique, relances).

---

## 8. Planning indicatif

| Lot | Contenu | Estimation |
|-----|---------|------------|
| Lot 1 | #1 Import CV + #5 Délai de relance | 2–3 jours |
| Lot 2 | #2 Événements sur la carte | 2 jours |
| Lot 3 | #3 Gestes retour | 1 jour |
| Lot 4 | #4 Icône de l'app | 0,5 jour (après livraison des visuels) |
| Recette | Tests sur appareils Android et iOS | 1 jour |

---

## 9. Validation

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Porteur du projet | | | |
| Développeur | | | |
