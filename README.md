# Like Vision - Système de Gestion Optique

Bienvenue dans votre application de gestion professionnelle.

## Pourquoi PythonAnywhere ne fonctionne pas ?
Cette application est développée avec **Next.js (Node.js)**. 
- **PythonAnywhere** ne supporte que les applications **Python**.
- Pour héberger cette application, vous devez utiliser un service compatible **Node.js** comme **Firebase App Hosting** ou **Vercel**.

## Comment mettre votre application en ligne (Gratuitement)

Pour que votre application soit accessible sur internet, suivez ces étapes simples :

### 1. Créer votre projet sur GitHub
- Connectez-vous sur [GitHub](https://github.com/).
- Créez un nouveau dépôt (Repository) nommé `like-vision`.
- Copiez l'adresse fournie (ex: `https://github.com/votre-nom/like-vision.git`).

### 2. Envoyer le code vers GitHub
- Ouvrez le **Terminal** ici dans Firebase Studio.
- Tapez ces commandes une par une (remplacez le lien par le vôtre) :
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin [VOTRE_LIEN_GITHUB_ICI]
  git push -u origin main
  ```

### 3. Configurer le déploiement sur Firebase
- Allez sur votre lien : [Console App Hosting](https://console.firebase.google.com/project/like-vision-187e1/apphosting)
- **Important :** Si Firebase vous demande de passer au forfait **Blaze (Pay-as-you-go)** :
  - C'est nécessaire pour activer l'hébergement moderne.
  - **Rassurez-vous :** Pour un petit projet, cela reste **0 DH**. Vous profitez du "Free Tier" (niveau gratuit) de Google Cloud.
- **Sur l'écran App Hosting :**
  - **Descendez tout en bas** de la page.
  - Cliquez sur le bouton bleu **"Commencer"** ou **"Créer un backend"**.
  - Connectez votre compte GitHub et sélectionnez votre dépôt `like-vision`.
  - Cliquez sur **"Suivant"** jusqu'à la fin.

## Fonctionnalités
- Tableau de bord en temps réel.
- Gestion de caisse et clôture.
- Facturation A5 paysage.
- Suivi des ordonnances.
