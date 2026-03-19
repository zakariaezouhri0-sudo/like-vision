
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE & MODIFICATION
- **UTILISATEURS (OPTICIENNE)** : Interdiction absolue d'écriture (création, modification, suppression) si la session de caisse est fermée (`status: CLOSED`). Les boutons "Enregistrer" et "Valider" doivent être désactivés.
- **EXCEPTION ADMIN/PREPA** : L'ADMIN et le compte ZAKARIAE ont l'autorisation de modifier ou supprimer des ventes même sur une journée clôturée (Mode Correction).
- **RÉ-OUVERTURE** : La procédure standard pour permettre à nouveau les modifications aux utilisateurs est la fonction "RÉ-OUVRIR LA CAISSE" (réservée à l'ADMIN).

## 2. ISOLATION STRICTE (PREPA vs RÉEL)
- **Compte PREPA (ZAKARIAE)** : Est automatiquement et exclusivement en mode "Brouillon" (`isDraft: true`). 
- **ADMIN / OPTICIENNE** : Sont fixés exclusivement en mode "Réel" (`isDraft: false`).

## 3. UNICITÉ DES DOCUMENTS (COMPTABILITÉ)
- **N° BON UNIQUE** : Le système doit bloquer l'enregistrement d'une vente si le "N° BON" existe déjà dans la base de données (pour le même mode Draft/Réel). 
- **OBJECTIF** : Garantir des références uniques pour l'export Sage et éviter les erreurs de saisie en double.

## 4. GESTION DES CLIENTS & PARRAINAGE
- **RECHERCHE HYBRIDE** : La recherche client doit s'effectuer soit par **Téléphone** (min. 8 chiffres), soit par **Nom** (min. 3 lettres).
- **PARRAINAGE MANUEL** : 
    - La liste des membres d'une famille s'affiche dès la saisie du téléphone.
    - Pour ajouter un **nouveau membre** sur un numéro existant, l'utilisateur doit **cocher manuellement** la case "PARRAINAGE / FAMILLE". 
    - L'activation de cette case vide le champ "Nom" pour permettre une nouvelle saisie tout en conservant le lien téléphonique.

## 5. RAPPORTS & IMPRESSION
- **Nommage des fichiers** : Les rapports DOIVENT être nommés `Like Vision - DD-MM-YYYY`.
- **Design Impression** : Tableaux aérés, centrés, montants sur une seule ligne.
- **Dimanches** : Dans le journal des sessions, les dimanches doivent être mis en évidence par une couleur de fond rouge claire.

## 8. NOTIFICATIONS WHATSAPP (SÉCURITÉ ABSOLUE)
- **Emojis** : Utilisation EXCLUSIVE des séquences d'échappement Unicode (ex: \uD83D\uDC4B) dans le code source pour éviter toute corruption de caractères.

## 9. OPTIMISATION DES RESSOURCES (ANTI-QUOTA)
- **Limitation des Lectures** : Sessions limitées à 500, Ventes/Transactions limitées à l'année en cours (depuis le 01/01/2026).
- **Précision Financière** : Utilisation systématique de `roundAmount()` pour tout calcul avant enregistrement Firestore.
