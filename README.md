# Like Vision - Système de Gestion Optique

Bienvenue dans votre application de gestion professionnelle.

## Comment mettre votre application en ligne (Gratuitement)

Pour que votre application soit accessible sur internet, suivez ces étapes simples :

### 1. Créer votre projet sur GitHub
- Connectez-vous sur [GitHub](https://github.com/).
- Cliquez sur le bouton **"+"** en haut à droite, puis sur **"New repository"**.
- Nommez-le `like-vision`.
- Cliquez sur le bouton vert **"Create repository"** en bas (ne cochez rien d'autre).
- Copiez l'adresse qui s'affiche (ex: `https://github.com/votre-nom/like-vision.git`).

### 2. Envoyer le code vers GitHub
- Ouvrez le terminal dans votre éditeur (Firebase Studio).
- Tapez ces commandes une par une :
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin [COLLEZ_VOTRE_LIEN_ICI]
  git push -u origin main
  ```

### 3. Configurer le déploiement sur Firebase
- Allez sur [console.firebase.google.com](https://console.firebase.google.com/).
- Créez ou sélectionnez votre projet **"Like Vision"**.
- Dans le menu de gauche, cliquez sur **"Build"** (ou "Construction"), puis sur **"App Hosting"**.
- Cliquez sur le gros bouton bleu **"Get Started"** au centre de la page.
- Connectez votre compte GitHub et sélectionnez votre dépôt `like-vision`.
- Laissez les réglages par défaut et cliquez sur **"Finish"**.
- Firebase s'occupe du reste ! Votre application sera en ligne dans 3 à 5 minutes.

## Fonctionnalités principales
- **Tableau de bord** : Statistiques en temps réel (CA, Ventes, Montant à recouvrir).
- **Caisse** : Ouverture/Clôture avec comptage des espèces et impression de rapports.
- **Facturation** : Génération de factures A5 professionnelles (Format paysage A4).
- **Clients** : Gestion complète des dossiers et ordonnances optiques.

Développé pour une expérience fluide sur PC, Tablette et Mobile.
