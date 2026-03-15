
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE (CRITIQUE)
- **INTERDICTION ABSOLUE D'ÉCRITURE SI CAISSE CLÔTURÉE** : Il est strictement impossible d'enregistrer, de modifier, de supprimer une vente ou d'encaisser un règlement si la session de caisse correspondante est fermée (`status: CLOSED`). 
- **PROCÉDURE DE MODIFICATION** : Pour modifier une donnée sur une journée clôturée, l'ADMIN doit obligatoirement utiliser la fonction "RÉ-OUVRIR LA CAISSE".

## 2. ISOLATION STRICTE (PREPA vs RÉEL)
- **Compte PREPA (ZAKARIAE)** : Est automatiquement et exclusivement en mode "Brouillon" (`isDraft: true`). 
- **ADMIN / OPTICIENNE** : Sont fixés exclusivement en mode "Réel" (`isDraft: false`).

## 3. Rapports & Impression
- **Nommage des fichiers** : Les rapports DOIVENT être nommés `Like Vision - DD-MM-YYYY`.
- **Design Impression** : Tableaux aérés, centrés, montants sur une seule ligne.

## 8. Notifications WhatsApp (SÉCURITÉ ABSOLUE)
- **Encodage** : Utilisation IMPÉRATIVE de `encodeURIComponent()` sur l'intégralité du message.
- **Emojis** : Utilisation EXCLUSIVE des séquences d'échappement Unicode (ex: \uD83D\uDC4B) dans le code source pour éviter toute corruption de caractères.
- **Messages Officiels** :
    - *Darija* : "السلام عليكم [Nom] \uD83D\uDC4B, équipe Like Vision ... \u2728 ... \u2705 ... \uD83D\uDC53 ... \uD83C\uDF1F\uD83D\uDE0E"
    - *Français* : "Bonjour [Nom] \uD83D\uDC4B, Toute l'équipe Like Vision ... \u2728 ... \u2705 ... \uD83D\uDC53 ... \uD83D\uDE0A\uD83C\uDF1F"

## 9. Optimisation des Ressources (Anti-Quota)
- **Limitation des Lectures** : Listes limitées à 100-200 résultats maximum.
- **Requêtes Ciblées** : La recherche de parrainage ne s'active qu'à partir de 8 chiffres saisis.
- **Précision Financière** : Utilisation systématique de `roundAmount()` pour tout calcul avant enregistrement Firestore.
