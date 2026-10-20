# Fiche de Suivi - Étape 12 : Choix de Navigation après Modification d'une Entreprise

**Date :** 20 Octobre 2026  
**Branche :** `main`  
**Auteur :** Antigravity AI & Rafael Martinez  
**Statut :** Terminé & Validé  

---

## 1. Contexte & Objectif

L'utilisateur a demandé d'adapter le dialogue de confirmation après modification d'une fiche entreprise :
> *"quand je modifie la fiche d'une entreprise sur la pop up de succès avoir la possibilité de revenir sur l'écran d'acceuil et ou rester sur la fiche de l'entreprise"*

---

## 2. Réalisations Techniques

1. **Pop-up de confirmation avec double choix d'action :**
   - Mise à jour de la fonction `handleSave` dans [CompanyDetailScreen.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/screens/CompanyDetailScreen.tsx).
   - Intégration de deux boutons distincts :
     - **« Rester sur la fiche »** (`style: 'cancel'`) : ferme la boîte de dialogue en conservant l'utilisateur sur la fiche modifiée pour continuer l'édition ou la consultation.
     - **« Retour à l'accueil »** (`style: 'default'`) : ferme la boîte de dialogue et déclenche `onBack()`, ramenant instantanément l'utilisateur sur la liste d'accueil mise à jour.

2. **Amélioration de l'affichage des boutons dans [CustomAlertModal.tsx](file:///home/rafael_martinez/Documents/Developpements/AlterTrack/apps/mobile/src/components/CustomAlertModal.tsx) :**
   - Centrage parfait horizontal et vertical du texte (`textAlign: 'center'`, `width: '100%'`).
   - Autorisation d'un retour à la ligne (`numberOfLines={2}`) avec centrage pour les libellés de boutons sur deux colonnes, évitant toute troncature sur les écrans de smartphones compacts.

---

## 3. Fichiers Modifiés et Créés

| Fichier | Nature | Description |
|---|---|---|
| `apps/mobile/src/screens/CompanyDetailScreen.tsx` | **Modification** | Ajout des boutons « Rester sur la fiche » et « Retour à l'accueil » dans la pop-up de succès. |
| `apps/mobile/src/components/CustomAlertModal.tsx` | **Modification** | Support de `numberOfLines={2}` sur les boutons d'alerte. |
| `docs/suivi/ETAPE_12_CHOIX_NAVIGATION_APRES_MODIFICATION_ENTREPRISE.md` | **Création** | Fiche de suivi d'étape et documentation technique. |

---

## 4. Contrôles et Validations Effectués

- [x] **Vérification TypeScript Mobile :** `npx tsc --noEmit` exécuté dans `apps/mobile` $\rightarrow$ **0 erreur de compilation**.
- [x] **Test de navigation :** Vérification de l'appel à `onBack()` sur l'action « Retour à l'accueil ».
- [x] **Ergonomie & Esthétique :** Style secondaire épuré pour « Rester sur la fiche » et bouton primaire d'action pour « Retour à l'accueil ».

---

## 5. Proposition de Commit Git

Conformément à la Règle 13 de `Regles.md` :

```bash
git add . && git commit -m "feat(mobile): options rester ou retour accueil sur la pop-up de modification d'entreprise" && git push
```
