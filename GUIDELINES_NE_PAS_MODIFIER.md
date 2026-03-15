
# 🛡️ Directives de Développement VisionGere (STABLE)

Ce fichier répertorie les fonctionnalités et règles de design définitives. Elles ne doivent être modifiées sous aucun prétexte, sauf demande explicite de l'utilisateur.

## 1. RÈGLE D'OR : SÉCURITÉ DE CLÔTURE (CRITIQUE)
- **INTERDICTION ABSOLUE D'ÉCRITURE SI CAISSE CLÔTURÉE** : Il est strictement impossible d'enregistrer, de modifier, de supprimer une vente ou d'encaisser un règlement si la session de caisse correspondante est fermée (`status: CLOSED`). 
- **PROCÉDURE DE MODIFICATION** : Pour modifier une donnée sur une journée clôturée, l'ADMIN doit obligatoirement utiliser la fonction "RÉ-OUVRIR LA CAISSE".

## 2. ISOLATION STRICTE (PREPA vs RÉEL)
- **Compte PREPA (ZAKARIAE)** : Est automatiquement et exclusivement en mode "Brouillon" (`isDraft: true`). 
- **ADMIN / OPTICIENNE** : Sont fixés exclusivement en mode "Réel" (`isDraft: false`).

## 3. Rapports & Impression
- **Nommage des fichiers** : Les rapports DOIVENT être nommés `Like Vision - DD-MM-YYYY`.
- **Design Impression** : Tableaux aérés, centrés, montants sur une seule ligne.

## 8. Notifications WhatsApp (SÉCURITÉ ABSOLUE)
- **Encodage** : Utilisation IMPÉRATIVE de `encodeURIComponent()` sur l'intégralité du message bilingue pour supporter l'arabe et les emojis.
- **Messages Officiels** :
    - *Darija* : "السلام عليكم [Nom] 👋، فريق Like Vision كيشكرك بزاف على الثقة ديالك فينا 👓✨. الطلب ديالك تسجل بنجاح ✅. غادي نعلموك غير يوجدو النظارات ديالك 📲. شكراً ليك ونهار مبروك! 🌟😎"
    - *Français* : "Bonjour [Nom] 👋, Toute l'équipe Like Vision vous remercie pour votre visite ✨👓. Votre commande a été enregistrée avec succès ✅. Nous vous contacterons dès qu'elle sera prête 📲. Merci pour votre confiance ! 😊🌟"

## 9. Optimisation des Ressources (Anti-Quota)
- **Limitation des Lectures** : Listes limitées à 100-200 résultats maximum.
- **Requêtes Ciblées** : La recherche de parrainage ne s'active qu'à partir de 8 chiffres saisis.
- **Précision Financière** : Utilisation systématique de `roundAmount()` pour tout calcul avant enregistrement Firestore.
