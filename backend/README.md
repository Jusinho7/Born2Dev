# Backend

API REST **AI Media Detector**, développée avec FastAPI. Elle envoie les images et vidéos à un service externe de détection. Les images sont traitées de manière synchrone ; les vidéos utilisent un traitement asynchrone avec callback et stockage local SQLite.

## Prérequis

- Python 3.10 ou plus récent
- Un accès et des identifiants pour le service externe de détection
- Pour les vidéos : une URL HTTPS publique permettant au service externe d'appeler le backend

## Installation

Depuis le dossier `backend/` :

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Sous Windows (PowerShell), activez l'environnement avec :

```powershell
.\.venv\Scripts\Activate.ps1
```

## Configuration

Créez un fichier `.env` dans `backend/` et renseignez les valeurs fournies par le service de détection :

```dotenv
api_user=...
api_secret=...
url=https://.../image-endpoint
models=...

video_url=https://.../video-endpoint
models_video=...
video_callback_url=https://votre-domaine.example/video-callback
video_callback_token=...
video_results_db=video_results.sqlite3
```

Les quatre premières variables sont nécessaires à la détection d'images. Les variables `video_url`, `models_video`, `video_callback_url` et `video_callback_token` sont nécessaires au traitement vidéo. `video_results_db` est facultative et vaut `video_results.sqlite3` par défaut. Ne commitez jamais le fichier `.env` ni les secrets.

Le callback vidéo doit être accessible publiquement en HTTPS. Le backend ajoute automatiquement le paramètre `token` à l'URL de callback et le compare au secret `video_callback_token`.

## Démarrage

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

L'API est alors accessible sur `http://localhost:8080`. La documentation interactive FastAPI est disponible à `/docs` et `/redoc`.

## Routes disponibles

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Vérifie que l'API répond (`{"status":"ok"}`). |
| `POST` | `/check` | Envoie une image et renvoie le résultat de détection. |
| `POST` | `/check-video` | Soumet une vidéo au traitement asynchrone ; répond avec le `request_id` et le statut `processing` (HTTP 202). |
| `GET` | `/check-video/{request_id}` | Récupère le statut et le résultat d'une tâche vidéo. |
| `POST` | `/video-callback?token=...` | Reçoit le résultat asynchrone du service externe. |

### Détection d'image

Le champ multipart doit s'appeler `file`. Formats acceptés : JPEG, PNG et WebP. Taille maximale : 10 Mo.

```bash
curl -X POST http://localhost:8080/check \
  -F "file=@./image.jpg"
```

La réponse contient notamment `name`, `id`, `ai_generated` et `result`. Les réponses identiques sont mises en cache en mémoire pendant la durée de vie du processus.

### Détection vidéo

Le champ multipart doit également s'appeler `file`. Formats acceptés : MP4, MOV, WebM, AVI et MKV. Taille maximale : 100 Mo.

```bash
curl -X POST http://localhost:8080/check-video \
  -F "file=@./video.mp4"
```

Interrogez ensuite `GET /check-video/{request_id}` avec l'identifiant reçu. Les résultats et statuts sont conservés dans le fichier SQLite configuré par `video_results_db`.

## Limites et intégration

- Les routes d'authentification consommées par le frontend (`/login`, `/register`, etc.) ne sont pas implémentées dans ce backend.
- Les routes de détection n'ont pas de préfixe `/api` et aucun middleware CORS n'est configuré par défaut.
- Le cache des images est en mémoire ; il est réinitialisé au redémarrage du serveur.
- Le callback vidéo et le service externe doivent pouvoir joindre le backend depuis Internet en environnement déployé.
