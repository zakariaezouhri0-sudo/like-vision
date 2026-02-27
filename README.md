
# Like Vision - Système de Gestion Optique 🚀

Félicitations ! Votre application est en ligne.

## Accès Rapide
- **Lien de Production :** [https://like-vision-w6y2.vercel.app/](https://like-vision-w6y2.vercel.app/)

## ⚠️ Comment mettre à jour votre site (Indispensable)
Pour que vos modifications soient visibles sur internet, vous devez **obligatoirement** taper ces 3 commandes dans le terminal, l'une après l'autre :

1. **Préparer les fichiers :**
   ```bash
   git add .
   ```
2. **Valider les changements :**
   ```bash
   git commit -m "Mise à jour des factures"
   ```
3. **Envoyer sur internet :**
   ```bash
   git push origin main
   ```

## Accès Mode Préparation (Historique)
Pour saisir vos anciennes données sans fausser la caisse réelle :
- **Login :** `prepa`
- **Pass :** `prepa123`

---

## 📊 Modèles d'Importation Excel

### 1. Historique des Ventes (Sales)
Utilisez ces colonnes pour importer vos anciennes factures :
- `N° Facture`
- `Nom Client`
- `Téléphone`
- `Total Brut`
- `Avance Payée (Entre en CA)` : Argent reçu ce jour.
- `Avance Antérieure (Hors CA)` : Argent déjà versé par le passé.
- `Date` (format JJ/MM/AAAA)
- `Mutuelle`
- `Coût Monture (Achat)`
- `Coût Verres (Achat)`

### 2. Journal de Caisse (Transactions)
Pour importer vos dépenses, versements ou achats groupés :
- `Type` : (VENTE, DEPENSE, VERSEMENT, ACHAT VERRES)
- `Libellé / Description`
- `Montant`
- `Date`
- `Catégorie` (Optionnel)

---
*Propulsé par Next.js, Firebase & Vercel*
