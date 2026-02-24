# Like Vision - Système de Gestion Optique

Bienvenue dans votre application de gestion professionnelle.

## Comment mettre votre application en ligne (Gratuitement)

Pour que votre application soit accessible sur internet, suivez ces étapes :

### 1. Créer votre projet sur GitHub
- Connectez-vous sur [GitHub](https://github.com/).
- Cliquez sur le bouton **"+"** en haut à droite, puis sur **"New repository"**.
- Nommez-le `like-vision`.
- Cliquez sur le bouton vert **"Create repository"** en bas (ne cochez rien d'autre).
- Copiez l'adresse qui s'affiche (ex: `https://github.com/votre-nom/like-vision.git`).

### 2. Envoyer le code vers GitHub
- Ouvrez le terminal dans votre éditeur.
- Tapez ces commandes une par une :
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin [COLLEZ_VOTRE_LIEN_ICI]
  git push -u origin main
  ```

### 3. Configurer le déploiement Firebase
- Allez sur [console.firebase.google.com](https://console.firebase.google.com/).
- Créez un projet nommé **"Like Vision"**.
- Dans le menu de gauche, allez dans **App Hosting**.
- Cliquez sur **"Get Started"** et connectez votre compte GitHub.
- Sélectionnez votre dépôt `like-vision`.
- Firebase s'occupe du reste ! Votre application sera en ligne dans quelques minutes.

## Fonctionnalités principales
- **Tableau de bord** : Statistiques en temps réel (CA, Ventes, Montant à recouvrir).
- **Caisse** : Ouverture/Clôture avec comptage des espèces et impression de rapports.
- **Facturation** : Génération de factures A5 professionnelles (Format paysage A4).
- **Clients** : Gestion complète des dossiers et ordonnances optiques.

Développé pour une expérience fluide sur PC, Tablette et Mobile.
