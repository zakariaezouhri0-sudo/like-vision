
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE (CRITIQUE)
- **INTERDICTION ABSOLUE D'ÉCRITURE SI CAISSE CLÔTURÉE** : Il est strictement impossible d'enregistrer, de modifier, de supprimer une vente ou d'encaisser un règlement si la session de caisse correspondante est fermée (`status: CLOSED`). 
- **AUCUNE EXCEPTION** : Cette règle s'applique à TOUS les utilisateurs, y compris l'ADMIN. 
- **PROCÉDURE DE MODIFICATION** : Pour modifier une donnée sur une journée clôturée, l'ADMIN doit obligatoirement utiliser la fonction "RÉ-OUVRIR LA CAISSE". Sans cette action manuelle, le système rejette toute tentative (Boutons masqués et Transactions sécurisées).

## 2. ISOLATION STRICTE (PREPA vs RÉEL)
- **Compte PREPA (ZAKARIAE)** : Est automatiquement et exclusivement en mode "Brouillon" (`isDraft: true`). Toutes ses opérations (Ventes, Transactions, Clients, Sessions) sont invisibles pour les autres comptes.
- **ADMIN / OPTICIENNE** : Sont fixés exclusivement en mode "Réel" (`isDraft: false`). Ils ne voient jamais les données du compte PREPA.
- **Synchronisation** : Le transfert du Brouillon vers le Réel ne peut se faire que via l'outil "Synchroniser" dans les Paramètres (réservé à l'Admin).

## 3. Rapports & Impression
- **Nommage des fichiers** : Les rapports (Journalier et Clôture) DOIVENT être nommés `Like Vision - DD-MM-YYYY` (ex: Like Vision - 23-05-2024).
- **Design Impression** : Les tableaux doivent rester aérés, centrés, et les montants doivent être sur une seule ligne.
- **Nettoyage Libellés** : Dans les rapports et la caisse, les sorties doivent être formatées proprement : `TYPE | LIBELLÉ` (ex: `ACHAT MONTURE | OPTICALIA`).
- **Versements** : Doivent impérativement s'afficher comme `VERSEMENT | BANQUE` par défaut.
- **Agrégation BC** : Les opérations (Ventes, Achats) partageant le même numéro de BC (ex: BC:2516) sont automatiquement cumulées en une seule ligne affichant la somme totale.

## 4. Tableau de Bord & Accès
- **Centrage** : Toutes les cartes de statistiques (Ventes, CA, Restes, Clients) doivent avoir leurs textes et montants parfaitement centrés (`text-center`).
- **Restriction Accès** : Le Dashboard est réservé exclusivement à l'ADMIN et au mode PREPA. Les OPTICIENNES sont redirigées directement vers la Caisse après connexion.

## 5. Formulaire de Vente & Parrainage
- **Ordre des champs Client** : La ligne supérieure doit impérativement respecter l'ordre : `Téléphone / Nom Complet / Date de la vente`.
- **Parrainage / Famille** : Le numéro de téléphone est le pivot. Si coché, le numéro saisi lie le client au groupe familial (`parentPhone`).
- **Reconnaissance Automatique** : La saisie du numéro de téléphone affiche la liste des membres sous le champ Nom. 
- **Comportement Dropdown** : La liste disparaît après sélection d'un membre. Elle réapparaît au clic (focus) dans le champ Nom pour permettre de changer ou d'éditer.
- **Liberté d'Édition** : En mode "Parrainage", le nom peut être librement modifié/saisi même si le numéro est déjà lié à une famille.
- **Sécurité Date** : Le sélecteur de date est désactivé pour les utilisateurs standards. Seuls l'ADMIN et le mode PREPA y ont accès.

## 6. Journal de Caisse (Sessions)
- **Groupement Mensuel** : Les sessions sont groupées par mois. Seul le mois actuel est ouvert par défaut.
- **Calcul Flux Net (APRES CHARGES)** : 
    - Mois 01 (Janvier) : Déduction de **15 000 DH**.
    - Mois 02 à 12 : Déduction de **20 000 DH**.
- **Export** : Le bouton "EXCEL DU MOIS" doit être présent sur chaque section mensuelle.

## 7. Maintenance & Intégrité
- **Précision** : TOUS les montants sont arrondis à 2 chiffres après la virgule (`roundAmount`).
- **Outils de Maintenance** : 
    - **Harmoniser les données** : Nettoie les noms d'opérateurs et restaure les dates.
    - **Réparer les sessions** : Recalcule les soldes théoriques en fonction des transactions réelles.
    - **Recalculer les coûts BC** : Réaffecte les prix d'achat des verres/montures aux ventes correspondantes.

---
*Ce document fait office de mémoire centrale et de garde-fou pour l'assistant IA.*
