
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE (CRITIQUE)
- **INTERDICTION ABSOLUE DE VENTE SI CAISSE CLÔTURÉE** : Il est strictement impossible d'enregistrer, de modifier, de supprimer une vente ou d'encaisser un règlement si la session de caisse correspondante est fermée (`status: CLOSED`). 
- **AUCUNE EXCEPTION** : Cette règle s'applique à TOUS les utilisateurs, y compris l'ADMIN. 
- **PROCÉDURE DE MODIFICATION** : Pour modifier une donnée sur une journée clôturée, l'ADMIN doit obligatoirement utiliser la fonction "RÉ-OUVRIR LA CAISSE". Sans cette action manuelle, le système doit rejeter toute tentative d'écriture (UI et Database Transaction).

## 2. Rapports & Impression
- **Nommage des fichiers** : Les rapports (Journalier et Clôture) DOIVENT être nommés `Like Vision - DD-MM-YYYY` (ex: Like Vision - 23-05-2024).
- **Design Impression** : Les tableaux doivent rester aérés, centrés, et les montants doivent être sur une seule ligne.
- **Nettoyage Libellés** : Dans les rapports et la caisse, les sorties doivent être formatées proprement : `TYPE | LIBELLÉ` (ex: `ACHAT MONTURE | OPTICALIA`).
- **Versements** : Doivent impérativement s'afficher comme `VERSEMENT | BANQUE` par défaut.
- **Agrégation BC** : Les opérations (Ventes, Achats) partageant le même numéro de BC (ex: BC:2516) sont automatiquement cumulées en une seule ligne affichant la somme totale.

## 3. Tableau de Bord (Dashboard)
- **Centrage** : Toutes les cartes de statistiques (Ventes, CA, Restes, Clients) doivent avoir leurs textes et montants parfaitement centrés (`text-center`).
- **Accès** : Le Dashboard est réservé exclusivement à l'ADMIN et au mode PREPA. Les OPTICIENNES sont redirigées vers la Caisse.

## 4. Formulaire de Vente (Nouvelle Vente)
- **Ordre des champs Client** : La ligne supérieure doit impérativement respecter l'ordre : `Téléphone / Nom Complet / Date de la vente`.
- **Sécurité Date** : Le sélecteur de date est désactivé (`disabled`) pour les utilisateurs standards. Seuls l'ADMIN et le mode PREPA y ont accès.
- **Logique de Remise** : Le système doit gérer les deux types : Montant Fixe (DH) et Pourcentage (%).
- **Traçabilité des Ventes** : Une vente (`RC` ou `FC`) doit TOUJOURS conserver sa date de création d'origine (`createdAt`), même lors d'un règlement ultérieur.

## 5. Journal de Caisse (Sessions)
- **Groupement** : Les sessions de caisse sont groupées par mois. Seul le mois actuel est ouvert par défaut.
- **Calcul Flux Net Mensuel (DÉDUCTION CHARGES)** : 
    - Le "Flux Net Total" affiché pour chaque mois inclut une déduction automatique des charges fixes.
    - **Mois 01 (Janvier)** : Déduction de **15 000 DH**.
    - **Mois 02 à 12** : Déduction de **20 000 DH**.
- **Export** : Le bouton "EXCEL DU MOIS" doit être présent sur chaque section mensuelle.

## 6. Synchronisation & Maintenance
- **Précision Financière** : TOUS les montants sont arrondis à 2 chiffres après la virgule (`roundAmount`).
- **Outils de Maintenance (Paramètres)** : 
    - **Harmoniser les données** : Restaure les dates et nettoie les noms d'opérateurs.
    - **Réparer les sessions** : Recalcule les soldes théoriques en fonction des transactions réelles.
    - **Recalculer les coûts BC** : Réaffecte automatiquement les prix d'achat des verres et montures aux ventes correspondantes.

## 7. Isolation des Comptes & Modes
- **Compte PREPA** : Est automatiquement et exclusivement en mode "Brouillon". Toutes ses opérations sont isolées dans l'espace de test (ZAKARIAE).
- **Autres Comptes (ADMIN / OPTICIENNE)** : Sont fixés exclusivement en mode "Réel". Le sélecteur de mode manuel est supprimé.

## 8. Stabilité & Intégrité (VERROUILLAGE)
- **Aucune Modification Non Sollicitée** : L'IA ne doit JAMAIS modifier, "optimiser" ou supprimer une fonctionnalité, une logique ou un élément de design déjà mis en place sans une demande explicite.
- **Respect du Code Existant** : Tout ce qui a été configuré et validé doit rester intact lors de l'ajout de nouvelles fonctions.

---
*Ce document fait office de mémoire centrale et de garde-fou pour l'assistant IA.*
