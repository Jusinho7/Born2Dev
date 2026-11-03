# Frontend

Interface web de **Check-Eko**, construite avec React, Vite et Sass. Elle contient les pages de connexion et d'inscription, la gestion du thème, un espace de vérification éditoriale et le centre de veille nationale. Le centre de veille utilise TypeScript, Leaflet et Recharts.

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
VITE_API_URL=http://localhost:8080
```

C'est l'URL racine de l'API FastAPI : les chemins comme `/login` et `/register` y sont ajoutés. Redémarrez Vite après toute modification de variable d'environnement.

Le backend fournit les routes d'authentification et utilise le jeton Bearer pour les appels depuis l'interface. Il autorise par défaut les origines locales `http://localhost:5173` et `http://127.0.0.1:5173`. En production, définissez la liste `frontend_origins` côté backend avec les origines exactes du frontend.

## Commandes disponibles

```bash
npm run dev      # Serveur de développement avec rechargement à chaud
npm run build    # Génère la version de production dans dist/
npm run preview  # Prévisualise le build de production
npm run lint     # Vérifie le code avec Oxlint
npm run typecheck  # Vérifie les fichiers TypeScript
```

## Structure du projet

```text
src/
├── components/  # Composants partagés
├── contexts/    # Contextes React, dont le thème
├── pages/       # Authentification, vérification et veille nationale
├── services/    # Client HTTP et gestion de l'authentification
├── styles/      # Styles Sass
└── utils/       # Fonctions utilitaires
public/          # Ressources statiques
```

## Authentification actuelle

- La connexion envoie `email` et `password`, puis attend une réponse contenant `token` et éventuellement `refreshToken`.
- L'inscription envoie `username`, `email`, `password` et `password_confirmation` ; le mot de passe doit contenir au moins 8 caractères.
- Les jetons sont conservés dans le `localStorage`. Les routes privées redirigent vers `/login` si aucun jeton valide n'est disponible.
- Le jeton d'accès expire après 15 minutes ; le client renouvelle automatiquement la session à l'aide d'un jeton rotatif de 7 jours. La déconnexion révoque la session sur le backend.
- La page privée `/` après connexion est l'espace de vérification des articles.
- Le module « Veille nationale » est accessible dans le menu des modules et consomme les routes `/api/v1/monitoring/*`.
- Le sélecteur de langue en haut des pages permet d’afficher l’interface en malagasy, français ou anglais ; le choix est conservé dans le navigateur.
- Les titres et contenus récupérés auprès des médias restent dans leur langue d’origine : le changement de langue traduit l’interface, pas les articles.
- Le centre de veille fournit les indicateurs, actualités paginées et filtres, carte des 23 régions, tendances lexicales, alertes et gestion des flux RSS.
- Les données de la carte et des graphiques proviennent de l'API ; les marqueurs géographiques sont approximatifs et seuls les articles avec région justifiée sont comptabilisés.
- La gestion des sources et les modifications rédactionnelles nécessitent que l'adresse email de l'utilisateur figure dans `MONITORING_ADMIN_EMAILS` côté backend.
- Les données de l'espace de vérification sont fournies par `/sources`, `/articles`, `/articles/{id}/claims` et `/claims/{id}/evidence`.
- Depuis l'interface, la rédaction peut créer une source, enregistrer un article, ajouter des affirmations et consigner des preuves en indiquant si leur indépendance a été vérifiée manuellement.
