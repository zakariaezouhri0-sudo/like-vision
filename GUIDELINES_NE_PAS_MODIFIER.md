# 🛡️ Directives de Développement Like Vision (STABLE - NE PAS MODIFIER)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. Rapports & Impression
- **Nommage des fichiers** : Les rapports (Journalier et Clôture) DOIVENT être nommés `Like Vision - DD-MM-YYYY` (ex: Like Vision - 23-05-2024).
- **Design Impression** : Les tableaux doivent rester aérés, centrés, et les montants doivent être sur une seule ligne.

## 2. Tableau de Bord (Dashboard)
- **Centrage** : Toutes les cartes de statistiques (Ventes, CA, Restes, Clients) doivent avoir leurs textes et montants parfaitement centrés (`text-center`).

## 3. Formulaire de Vente (Nouvelle Vente)
- **Ordre des champs Client** : La ligne supérieure doit impérativement respecter l'ordre : `Téléphone / Nom Complet / Date de la vente`.
- **Sécurité Date** : Le sélecteur de date est désactivé (`disabled`) pour les utilisateurs standards. Seuls l'ADMIN et le mode PREPA y ont accès.
- **Logique de Remise** : Le système doit gérer les deux types : Montant Fixe (DH) et Pourcentage (%).
- **Automatisation** : La saisie du téléphone doit déclencher la recherche auto et l'affichage de l'alerte de dette si nécessaire.
- **Verrouillage Session** : Il est strictement interdit d'enregistrer ou de modifier une vente pour une date dont la caisse a déjà été clôturée (`status: CLOSED`).

## 4. Journal de Caisse
- **Groupement** : Les sessions de caisse sont groupées par mois.
- **Affichage** : Les mois passés sont repliés par défaut. Seul le mois actuel est ouvert.
- **Export** : Le bouton "EXCEL DU MOIS" doit être présent sur chaque section mensuelle.

## 5. Synchronisation & Données
- **Numérotation** : La synchronisation du mode PREPA vers le REEL ne doit JAMAIS changer les identifiants de factures (`FC-...`) ou de reçus (`RC-...`). Ils sont définitifs dès leur création.
- **Champ Mutuelle** : L'option "Autre" doit toujours afficher un champ de saisie libre.
- **Précision Financière** : TOUS les montants doivent être arrondis à 2 chiffres après la virgule (utilisation de `roundAmount`).

---
*Ce document fait office de mémoire pour l'assistant IA.*
