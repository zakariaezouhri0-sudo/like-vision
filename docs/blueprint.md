# **App Name**: VisionGere

## Core Features:

- Authentification & Gestion Utilisateurs: Système d'authentification pour les rôles Admin (accès complet) et UserCaissier (accès restreint). Les Administrateurs peuvent gérer les comptes utilisateurs.
- Configuration du Magasin: Une page dédiée aux Administrateurs pour configurer le nom, l'adresse, le téléphone, l'ICEPatent du magasin et télécharger un logo. Ces informations sont dynamiquement affichées dans l'application et sur les en-têtes des factures PDF.
- Gestion Caisse Quotidienne: Fonctionnalité 'Ouvrir la caisse' avec Solde Initial. Enregistrement des transactions (dépenses, versements, apports) et clôture automatique avec calcul du solde théorique et de l'écart (difference).
- Enregistrement Vente & Prescription: Saisie des ventes avec numéro de facture auto-généré (OPT-YYYY-XXX). Sélection de Mutuelle avec un champ de texte additionnel si 'Autre' est choisi. Saisie précise des champs ODOG (Sph, Cyl, Axe) pour les prescriptions.
- Suivi des Marges (Admin): Champ 'Prix d'achat Verres/Monture' masqué sur l'interface de vente mais modifiable par l'Admin à tout moment pour calculer la marge brute par client.
- Génération de Factures PDF Professionnelles: Génération de factures PDF format A4 Portrait divisé en deux sections A5 identiques, incluant les détails du magasin, la prescription, la mutuelle, la facturation et les zones de signature. Permet la réimpression (Duplicata) à partir de l'historique.
- Rapports et Analyses Financières (Admin): Tableau de Marge détaillé (Prix de Vente - Prix d'achat = Marge Brute) par client, rapports globaux (Chiffre d'Affaires, Crédits), export des données vers Excel et visualisation graphique de la performance des ventes et de la distribution des Mutuelles.

## Style Guidelines:

- Palette de couleurs centrée sur un bleu-gris profond comme couleur principale (#31577A), évoquant la confiance et la modernité. Un fond lumineux et légèrement teinté (#EBEFF3) pour la clarté. Un bleu-vert vif et contrastant (#34B9DB) pour les éléments interactifs et les mises en avant, ajoutant une touche de dynamisme sans compromettre le professionnalisme.
- Utilisation de la police sans-serif 'Inter' pour tous les textes, y compris les titres et le corps. Cette police offre une esthétique moderne, nette et lisible, parfaitement adaptée à un outil de gestion professionnel et épuré.
- Intégration cohérente des icônes de 'Lucide React' (telles que Eye, Wallet), en suivant leur style moderne et léger, pour une navigation intuitive et une représentation claire des actions.
- Conception d'une interface utilisateur propre et fonctionnelle, avec une disposition claire des informations, de larges espaces blancs et des éléments de navigation bien définis. Optimisée pour une utilisation sur des écrans de bureau, offrant une expérience efficace et agréable.
- Animations subtiles et non intrusives, telles que des transitions douces lors du chargement des pages ou des modifications d'état, améliorant l'expérience utilisateur sans distraire de l'objectif principal de gestion.