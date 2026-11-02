# Frontend

Interface web de l'application **Fanilo**, construite avec React et Vite. Elle contient actuellement les pages de connexion et d'inscription, la gestion du thème et une page d'accueil temporaire après connexion.

## Prérequis

- Node.js compatible avec Vite 8
- npm
- L'API configurée et accessible si vous souhaitez tester les formulaires

## Installation et lancement

Depuis le dossier `frontend/` :

```bash
npm install
npm run dev
```

Vite affiche l'adresse locale à ouvrir dans le navigateur (généralement `http://localhost:5173`).

## Configuration de l'API

Le client utilise la variable `VITE_API_URL`. Créez un fichier `.env.local` dans `frontend/` :

```dotenv
VITE_API_URL=http://localhost:8080/api
```

Cette valeur est l'URL de base Axios : les chemins comme `/login` et `/register` y sont ajoutés. Redémarrez Vite après toute modification de variable d'environnement.

> **À noter :** le frontend suppose une API d'authentification exposant `/login`, `/register`, `/logout`, `/refresh-token`, `/verify-token` et `/me`. Le backend présent dans ce dépôt ne fournit actuellement que les routes de détection d'images et de vidéos. Il faut donc connecter un service d'authentification compatible avant d'utiliser les formulaires.
>
> L'URL par défaut du frontend se termine par `/api`, alors que les routes de détection du backend sont actuellement exposées sans ce préfixe (`/check`, `/check-video`, etc.). Ajustez `VITE_API_URL` ou configurez un proxy selon le routage choisi. Le backend ne configure pas encore CORS ; pour un appel direct depuis une origine différente, cette configuration devra également être ajoutée.

## Commandes disponibles

```bash
npm run dev      # Serveur de développement avec rechargement à chaud
npm run build    # Génère la version de production dans dist/
npm run preview  # Prévisualise le build de production
npm run lint     # Vérifie le code avec Oxlint
```

## Structure du projet

```text
src/
├── components/  # Composants partagés
├── contexts/    # Contextes React, dont le thème
├── pages/       # Pages Connexion et Inscription
├── services/    # Client HTTP et gestion de l'authentification
├── styles/      # Styles Sass
└── utils/       # Fonctions utilitaires
public/          # Ressources statiques
```

## Authentification actuelle

- La connexion envoie `email` et `password`, puis attend une réponse contenant `token` et éventuellement `refreshToken`.
- L'inscription envoie `username`, `email`, `password` et `password_confirmation`.
- Les jetons sont conservés dans le `localStorage`. Les routes privées redirigent vers `/login` si aucun jeton valide n'est disponible.
- La page `/` après connexion est un tableau de bord temporaire.
