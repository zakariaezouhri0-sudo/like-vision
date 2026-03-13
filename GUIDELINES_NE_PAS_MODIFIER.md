
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE (CRITIQUE)
- **INTERDICTION ABSOLUE DE VENTE SI CAISSE CLÔTURÉE** : Il est strictement impossible d'enregistrer, de modifier, de supprimer une vente ou d'encaisser un règlement si la session de caisse correspondante est fermée (`status: CLOSED`). 
- **AUCUNE EXCEPTION** : Cette règle s'applique à TOUS les utilisateurs, y compris l'ADMIN. 
- **PROCÉDURE DE MODIFICATION** : Pour modifier une donnée sur une journée clôturée, l'ADMIN doit obligatoirement utiliser la fonction "RÉ-OUVRIR LA CAISSE". Sans cette action manuelle, le système doit rejeter toute tentative d'écriture (UI et Database Transaction).

## 2. Rapports & Impression
- **Nommage des fichiers** : Les rapports (Journalier et Clôture) DOIVENT être nommés `Like Vision - DD-MM-YYYY` (ex: Like Vision - 23-05-2024).
- **Design Impression** : Les tableaux doivent rester aérés, centrés, et les montants doivent être sur une seule ligne.
- **Nettoyage Libellés** : Dans les rapports, les sorties de caisse doivent être formatées proprement : `TYPE | LIBELLÉ` (ex: `ACHAT MONTURE | OPTICALIA`).

## 3. Tableau de Bord (Dashboard)
- **Centrage** : Toutes les cartes de statistiques (Ventes, CA, Restes, Clients) doivent avoir leurs textes et montants parfaitement centrés (`text-center`).

## 4. Formulaire de Vente (Nouvelle Vente)
- **Ordre des champs Client** : La ligne supérieure doit impérativement respecter l'ordre : `Téléphone / Nom Complet / Date de la vente`.
- **Sécurité Date** : Le sélecteur de date est désactivé (`disabled`) pour les utilisateurs standards. Seuls l'ADMIN et le mode PREPA y ont accès.
- **Logique de Remise** : Le système doit gérer les deux types : Montant Fixe (DH) et Pourcentage (%).
- **Trabilité des Ventes** : Une vente (`RC` ou `FC`) doit TOUJOURS conserver sa date de création d'origine (`createdAt`), même lors d'un règlement ultérieur.

## 5. Journal de Caisse
- **Groupement** : Les sessions de caisse sont groupées par mois.
- **Affichage** : Les mois passés sont repliés par défaut. Seul le mois actuel est ouvert.
- **Calcul Flux Net** : Le "Flux Net Total" mensuel inclut une déduction automatique des charges fixes : **15 000 DH** pour Janvier (Mois 01) et **20 000 DH** pour tous les mois suivants.
- **Export** : Le bouton "EXCEL DU MOIS" doit être présent sur chaque section mensuelle. Le filtrage des dates pour l'export "Opérations" doit être strictement limité aux 24h du jour sélectionné.

## 6. Synchronisation & Données
- **Champ Mutuelle** : L'option "Autre" doit toujours afficher un champ de saisie libre.
- **Précision Financière** : TOUS les montants doivent être arrondis à 2 chiffres après la virgule (utilisation de `roundAmount`).
- **Maintenance** : 
    - L'outil "Harmoniser les données" permet de restaurer les dates de création des factures.
    - L'outil "Réparer les sessions" permet de recalculer les soldes théoriques en fonction des transactions.

## 7. Isolation des Comptes
- **Compte PREPA** : Est automatiquement et exclusivement en mode "Brouillon". Toutes ses opérations sont isolées dans l'espace de test (ZAKARIAE).
- **Autres Comptes (ADMIN / OPTICIENNE)** : Sont fixés exclusivement en mode "Réel". Le sélecteur de mode manuel a été supprimé.

## 8. Stabilité & Intégrité (VERROUILLAGE)
- **Aucune Modification Non Sollicitée** : L'IA ne doit JAMAIS modifier, "optimiser" ou supprimer une fonctionnalité, une logique ou un élément de design déjà mis en place sans une demande explicite et détaillée de l'utilisateur. 
- **Respect du Code Existant** : Tout ce qui a été configuré et validé doit rester intact lors de l'ajout de nouvelles fonctions.

---
*Ce document fait office de mémoire pour l'assistant IA.*
