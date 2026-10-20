# Fiche de Suivi - Étape 11 : Centrage Automatique des Champs de Saisie au Focus Clavier

**Date :** 20 Octobre 2026  
**Branche :** `main`  
**Auteur :** Antigravity AI & Rafael Martinez  
**Statut :** Terminé & Validé  

---

## 1. Contexte & Objectif

L'utilisateur a demandé d'adapter le comportement de saisie sur smartphone (notamment Android via Expo Go) :
> *"je veux que le champ se centre au milieu quand je vais pour taper du texte sur le claviers"*

### Problématiques identifiées :
1. **Comportement Android `adjustResize` :** Sur Android, le clavier virtuel réduit nativement la hauteur disponible de la fenêtre. L'ancien algorithme soustrayait une seconde fois la hauteur du clavier, repoussant les champs tout en haut sous le header plutôt qu'au centre.
2. **Champs non connectés au centrage :** Dans le composant d'adresse intelligente (`AddressFieldAssistant`), les champs de recherche d'adresse, de ville et d'adresse postale utilisaient des `<TextInput>` basiques qui ne déclenchaient pas le défilement centré.
3. **Conflit de handlers `scrollToEnd` :** Les champs de notes personnelles (`notes`) dans `AddCompanyScreen` et `CompanyDetailScreen` exécutaient un `scrollToEnd()` forcé qui entrait en conflit avec le centrage.
4. **Calcul universel de la zone visible :** Il fallait mesurer le cadre réel du ScrollView sur l'écran et la position du clavier pour placer le centre de n'importe quel champ exactement sur la ligne médiane de l'espace visible.

---

## 2. Réalisations Techniques

1. **Refonte de `KeyboardAwareCenteredScrollView.tsx` :**
   - Mesure directe du conteneur en coordonnées écran (`measureNodeInWindow`).
   - Calcul exact de la hauteur visible disponible au-dessus du clavier :
     $$\text{visibleTop} = \max(\text{containerY}, \text{topOffset})$$
     $$\text{visibleBottom} = \min(\text{containerY} + \text{containerHeight}, \text{keyboardTop})$$
     $$\text{targetCenterY} = \text{visibleTop} + \frac{\text{visibleHeight}}{2}$$
   - Ajustements automatiques échelonnés (`0ms`, `120ms` et `260ms`) lors de l'ouverture du clavier pour absorber la fin de l'animation de redimensionnement de l'OS Android.
   - Centrage immédiat lors de la navigation d'un champ à un autre lorsque le clavier est déjà ouvert.
   - Marge basse dynamique (`paddingBottom: Math.max(keyboardHeight + 60, 320)`) pour garantir que même le tout dernier champ de n'importe quel écran puisse atteindre le milieu de l'écran.

2. **Connexion d'`AddressFieldAssistant.tsx` :**
   - Remplacement des entrées `<TextInput>` de la barre de recherche intelligente d'adresses, du champ de ville et de l'adresse postale par `<CenteredTextInput>`.

3. **Nettoyage des handlers de défilement concurrents :**
   - Suppression des `handleNotesFocus` qui forçaient un défilement en bas de page dans `AddCompanyScreen.tsx` et `CompanyDetailScreen.tsx`.

4. **Prise en charge des modals de formulaire :**
   - Intégration de `KeyboardAwareCenteredScrollView` et `CenteredTextInput` dans `EmailPreviewModal.tsx` pour l'édition de l'objet et du corps de mail.

---

## 3. Fichiers Modifiés et Créés

| Fichier | Nature | Description |
|---|---|---|
| `apps/mobile/src/components/KeyboardAwareCenteredScrollView.tsx` | **Modification** | Algorithme de centrage optique en temps réel, support Android/iOS, stabilisation post-resize et padding bas. |
| `apps/mobile/src/components/AddressFieldAssistant.tsx` | **Modification** | Intégration de `CenteredTextInput` sur les champs d'adresse et de ville. |
| `apps/mobile/src/screens/AddCompanyScreen.tsx` | **Modification** | Retrait du `scrollToEnd` sur le champ de notes. |
| `apps/mobile/src/screens/CompanyDetailScreen.tsx` | **Modification** | Retrait du `scrollToEnd` sur le champ de notes. |
| `apps/mobile/src/components/EmailPreviewModal.tsx` | **Modification** | Intégration du centrage automatique pour l'édition de mail. |
| `docs/suivi/ETAPE_11_CENTRAGE_CLAVIER_CHAMPS_FORMULAIRES.md` | **Création** | Fiche de suivi et documentation technique. |

---

## 4. Contrôles et Validations Effectués

- [x] **Vérification TypeScript Mobile :** `npx tsc --noEmit` dans `apps/mobile` $\rightarrow$ **0 erreur de compilation**.
- [x] **Vérification TypeScript API :** `npx tsc --noEmit` dans `apps/api` $\rightarrow$ **0 erreur de compilation**.
- [x] **Compatibilité multi-écrans :** Vérification sur `AddCompanyScreen`, `CompanyDetailScreen`, `AuthScreen`, `SettingsScreen`, `ProfileScreen` et `EmailPreviewModal`.

---

## 5. Proposition de Commit Git

Conformément à la Règle 13 de `Regles.md` :

```bash
git add . && git commit -m "fix(mobile): centrage automatique des champs au milieu de l'ecran au focus clavier" && git push
```
