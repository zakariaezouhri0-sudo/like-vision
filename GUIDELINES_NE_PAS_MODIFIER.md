
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE & MODIFICATION
- **UTILISATEURS (OPTICIENNE)** : Interdiction absolue d'écriture (création, modification, suppression) si la session de caisse est fermée (`status: CLOSED`).
- **EXCEPTION ADMIN/PREPA** : L'ADMIN et le compte ZAKARIAE ont l'autorisation de modifier ou supprimer des ventes même sur une journée clôturée (Mode Correction).
- **RÉ-OUVERTURE** : La fonction "RÉ-OUVRIR LA CAISSE" reste la procédure standard pour permettre à nouveau les modifications aux utilisateurs.

## 2. ISOLATION STRICTE (PREPA vs RÉEL)
- **Compte PREPA (ZAKARIAE)** : Est automatiquement et exclusivement en mode "Brouillon" (`isDraft: true`). 
- **ADMIN / OPTICIENNE** : Sont fixés exclusivement en mode "Réel" (`isDraft: false`).

## 3. UNICITÉ DES DOCUMENTS (COMPTABILITÉ)
- **N° BON UNIQUE** : Le système doit bloquer l'enregistrement d'une vente si le "N° BON" existe déjà dans la base de données (pour le même mode Draft/Réel). 
- **OBJECTIF** : Garantir des références uniques pour l'export Sage et éviter les erreurs de saisie en double.

## 4. RAPPORTS & IMPRESSION
- **Nommage des fichiers** : Les rapports DOIVENT être nommés `Like Vision - DD-MM-YYYY`.
- **Design Impression** : Tableaux aérés, centrés, montants sur une seule ligne.
- **Dimanches** : Dans le journal des sessions, les dimanches doivent être mis en évidence par une couleur de fond distinctive (sans badge texte).

## 8. NOTIFICATIONS WHATSAPP (SÉCURITÉ ABSOLUE)
- **Stratégie** : Priorité au `navigator.share()` si supporté.
- **Fallback Clipboard** : Si l'URL encoding échoue, copier le message dans le presse-papier (`navigator.clipboard`) puis ouvrir la discussion WhatsApp.
- **Emojis** : Utilisation EXCLUSIVE des séquences d'échappement Unicode (ex: \uD83D\uDC4B) dans le code source pour éviter toute corruption de caractères.

## 9. OPTIMISATION DES RESSOURCES (ANTI-QUOTA)
- **Limitation des Lectures** :
    - Sessions de caisse : Limitées à 500 (pour couvrir 1 an d'historique).
    - Ventes, Clients, Transactions : Limitées à 100-200 résultats maximum.
- **Requêtes Ciblées** : La recherche de parrainage/famille ne s'active qu'à partir de 8 chiffres saisis pour le téléphone.
- **Précision Financière** : Utilisation systématique de `roundAmount()` pour tout calcul avant enregistrement Firestore.
