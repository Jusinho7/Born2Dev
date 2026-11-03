# Backend Check-Eko

API REST FastAPI Check-Eko pour analyser des images et des vidéos avec Sightengine, lire les métadonnées EXIF, vérifier les manifestes de provenance C2PA et protéger les routes par clé API.

## Prérequis

- Python 3.10 ou plus récent
- Une clé API Sightengine pour la détection d'images et de vidéos
- Pour la vidéo en production, une URL HTTPS publique pour recevoir le callback Sightengine

## Installation

Depuis le dossier `backend/`, créez et activez un environnement virtuel :

```bash
python -m venv .venv
source .venv/bin/activate
```

Sous Windows PowerShell :

```powershell
.\.venv\Scripts\Activate.ps1
```

Installez le projet et ses dépendances définies dans `pyproject.toml` :

```bash
python -m pip install .
```

## Configuration

Copiez le modèle, puis modifiez `backend/.env` avec vos propres valeurs :

```bash
cp .env.example .env
```

Exemple de configuration :

```dotenv
api_key=REMPLACEZ_PAR_UNE_CLE_ALEATOIRE
rate_limit_per_minute=30

api_user=VOTRE_IDENTIFIANT_SIGHTENGINE
api_secret=VOTRE_SECRET_SIGHTENGINE
url=https://api.sightengine.com/1.0/check.json
models=genai

video_url=https://api.sightengine.com/1.0/video/check.json
models_video=genai
video_callback_url=https://votre-domaine.example/video-callback
video_callback_token=REMPLACEZ_PAR_UN_TOKEN_ALEATOIRE
video_results_db=video_results.sqlite3
source_directory_db=source_directory.sqlite3

# Facultatif : chemin local vers les certificats racines de confiance C2PA (PEM)
c2pa_trust_anchors_path=/chemin/vers/anchors.pem
```

Générez des secrets distincts, par exemple avec `openssl rand -hex 32`. Ne publiez et ne commitez jamais `.env`. La clé `api_key` est envoyée par les clients dans l'en-tête `X-API-Key` ; ne l'intégrez pas dans le code d'un frontend public. Si des identifiants réels ont été exposés dans un dépôt ou un exemple, révoquez-les et remplacez-les.

Les variables `api_user`, `api_secret`, `url` et `models` sont nécessaires à l'analyse d'images. Pour l'analyse vidéo, renseignez aussi `video_url`, `models_video`, `video_callback_url` et `video_callback_token`. Le callback doit être publiquement accessible en HTTPS. `video_results_db` est facultative et vaut `video_results.sqlite3` par défaut.

La route de rapport combine Sightengine, EXIF et C2PA. Pour vérifier si le certificat C2PA est approuvé par une autorité de confiance, fournissez un fichier PEM à `c2pa_trust_anchors_path`. Sans ce fichier, le backend peut examiner le manifeste, mais ne peut pas déclarer son certificat de confiance. La liste officielle peut être téléchargée depuis [contentcredentials.org/trust/anchors.pem](https://contentcredentials.org/trust/anchors.pem) ; conservez-la localement et mettez-la à jour selon vos besoins.

## Lancement

Depuis `backend/` et avec l'environnement virtuel activé :

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

L'API répond sur `http://localhost:8080`. La route `/health` vérifie la disponibilité. La documentation interactive est disponible sur `/docs`, et le schéma OpenAPI sur `/openapi.json`.

## Routes

| Méthode | Route | Authentification | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Aucune | Vérifie que le serveur répond. |
| `POST` | `/check` | `X-API-Key` | Envoie une image à Sightengine pour détecter si elle a été générée par IA. |
| `POST` | `/authenticity` | `X-API-Key` | Produit un rapport combinant score IA, EXIF et provenance C2PA. |
| `POST` | `/exif` | `X-API-Key` | Lit les métadonnées EXIF sélectionnées d'une image. |
| `POST` | `/check-video` | `X-API-Key` | Soumet une vidéo au traitement asynchrone (HTTP 202). |
| `GET` | `/check-video/{request_id}` | `X-API-Key` | Récupère le statut et le résultat d'une tâche vidéo. |
| `POST` | `/video-callback?token=...` | Token de callback | Reçoit et enregistre le résultat envoyé par Sightengine. |
| `GET` | `/sources` | `X-API-Key` | Liste les sources enregistrées. |
| `POST` | `/sources` | `X-API-Key` | Ajoute une source à l'annuaire. |
| `GET` | `/sources/{source_id}` | `X-API-Key` | Consulte une source. |
| `PUT` | `/sources/{source_id}` | `X-API-Key` | Modifie une source. |
| `DELETE` | `/sources/{source_id}` | `X-API-Key` | Supprime une source. |
| `POST` | `/sources/{source_id}/evaluations` | `X-API-Key` | Ajoute une évaluation datée avec notes justificatives. |
| `GET` | `/sources/{source_id}/evaluations` | `X-API-Key` | Consulte l'historique des évaluations. |
| `GET` | `/articles` | `X-API-Key` | Liste les articles soumis manuellement à vérification. |
| `POST` | `/articles` | `X-API-Key` | Enregistre un article associé à une source de l'annuaire. |
| `GET` | `/articles/{article_id}` | `X-API-Key` | Consulte un article. |
| `GET` | `/articles/{article_id}/claims` | `X-API-Key` | Liste les affirmations de l'article et leur état de recoupement. |
| `POST` | `/articles/{article_id}/claims` | `X-API-Key` | Ajoute une affirmation à vérifier. |
| `GET` | `/claims/{claim_id}/evidence` | `X-API-Key` | Liste les éléments de preuve associés à une affirmation. |
| `POST` | `/claims/{claim_id}/evidence` | `X-API-Key` | Ajoute un élément de preuve associé à une source de l'annuaire. |

Les routes protégées sont limitées à 30 requêtes par minute et par adresse IP par défaut ; configurez `rate_limit_per_minute` pour modifier cette limite. Une clé manquante ou incorrecte produit une réponse 401. Le callback vidéo ne demande pas `X-API-Key` : il valide le paramètre `token` avec `video_callback_token`.

### Exemples d'appels

Toutes les routes d'analyse utilisent un formulaire multipart dont le champ fichier est nommé `file`.

```bash
# Vérifier l'état du serveur
curl http://localhost:8080/health

# Lire les métadonnées EXIF
curl -X POST http://localhost:8080/exif \
  -H "X-API-Key: VOTRE_API_KEY" \
  -F "file=@./photo.jpg"

# Analyser une image
curl -X POST http://localhost:8080/check \
  -H "X-API-Key: VOTRE_API_KEY" \
  -F "file=@./photo.jpg"

# Obtenir le rapport d'indices d'authenticité
curl -X POST http://localhost:8080/authenticity \
  -H "X-API-Key: VOTRE_API_KEY" \
  -F "file=@./photo.jpg"

# Soumettre une vidéo (la réponse fournit un request_id)
curl -X POST http://localhost:8080/check-video \
  -H "X-API-Key: VOTRE_API_KEY" \
  -F "file=@./video.mp4"

# Consulter ensuite le résultat
curl http://localhost:8080/check-video/REQUEST_ID \
  -H "X-API-Key: VOTRE_API_KEY"

# Ajouter une source à l'annuaire
curl -X POST http://localhost:8080/sources \
  -H "X-API-Key: VOTRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Radio Madagasikara",
    "source_type": "Média",
    "region": "National",
    "language": "Malagasy",
    "url": "https://example.org",
    "description": "Description facultative"
  }'

# Évaluer une source (remplacer SOURCE_ID par l'identifiant retourné)
curl -X POST http://localhost:8080/sources/SOURCE_ID/evaluations \
  -H "X-API-Key: VOTRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluator": "Équipe rédaction",
    "criteria": {
      "transparency": {"score": 2, "note": "Auteur clairement identifié"},
      "citations": {"score": 1, "note": "Certaines affirmations sont sourcées"},
      "verifiable_evidence": {"score": 2, "note": "Documents consultables"},
      "corrections_policy": {"score": 1, "note": "Politique difficile à trouver"},
      "independent_corroboration": {"score": 2, "note": "Recoupée avec d'autres sources"}
    }
  }'
```

Chaque critère est noté par une personne de 0 (« non observé pendant cette évaluation »), 1 (« partiel ») à 2 (« clairement documenté »). Une note de 0 ne prouve pas une défaillance : elle indique seulement qu'aucun élément n'a été consigné pour ce critère. Le total sur 10 est descriptif et ne constitue pas un verdict automatique de fiabilité. Les évaluations conservent leur date et leur historique ; la suppression d'une source supprime aussi ses évaluations liées.

### Vérification d'un article et recoupement manuel

L'article et ses affirmations sont saisis manuellement : l'API ne télécharge pas les pages web et n'en extrait pas automatiquement le contenu. L'article doit référencer une source existante. Pour chaque affirmation, ajoutez des preuves issues de sources déjà inscrites dans l'annuaire, avec leur URL, leur relation (`supports`, `contradicts` ou `contextualizes`), et éventuellement un extrait ou une note.

Exemple de parcours (remplacez les identifiants par les valeurs renvoyées par les appels précédents) :

```bash
# Enregistrer l'article
curl -X POST http://localhost:8080/articles \
  -H "X-API-Key: VOTRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "SOURCE_ID",
    "title": "Titre de l’article",
    "url": "https://example.org/article",
    "author": "Nom de l’auteur",
    "published_at": "2025-03-08"
  }'

# Ajouter une affirmation
curl -X POST http://localhost:8080/articles/ARTICLE_ID/claims \
  -H "X-API-Key: VOTRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "L’affirmation précise à vérifier"}'

# Consigner une preuve trouvée dans une autre source
curl -X POST http://localhost:8080/claims/CLAIM_ID/evidence \
  -H "X-API-Key: VOTRE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "AUTRE_SOURCE_ID",
    "url": "https://example.net/document",
    "relation": "supports",
    "excerpt": "Extrait pertinent",
    "note": "Vérification éditoriale",
    "independent_source_confirmed": true
  }'

# Relire l’état de l’affirmation et les éléments enregistrés
curl http://localhost:8080/articles/ARTICLE_ID/claims \
  -H "X-API-Key: VOTRE_API_KEY"
curl http://localhost:8080/claims/CLAIM_ID/evidence \
  -H "X-API-Key: VOTRE_API_KEY"
```

Les statuts sont calculés à partir des preuves consignées : `to_verify` (aucune preuve), `inconclusive` (preuves contextuelles seulement), `partially_corroborated` (au moins une preuve de soutien), `corroborated` (au moins deux sources distinctes de soutien, et chaque preuve de soutien marquée comme indépendante), `contradictory` (au moins une preuve contradictoire). Le champ `independent_source_confirmed` est une appréciation humaine, pas une vérification automatique de l'indépendance réelle des sources. Un statut indique l'état du travail éditorial enregistré, pas une décision automatisée sur la véracité. Supprimer une source supprime aussi en cascade les articles, preuves et évaluations qui lui sont associés.

Formats acceptés pour les images : JPEG, PNG et WebP (10 Mo maximum). Formats vidéo : MP4, MOV, WebM, AVI et MKV (100 Mo maximum). Le contenu du fichier est aussi vérifié, pas uniquement son type MIME.

## Tests

Les tests API se trouvent dans `test_api.py`. Installez pytest si nécessaire, puis lancez-les depuis `backend/` :

```bash
python -m pip install pytest
python -m pytest -q
```

Les tests couvrent les routes locales et utilisent des données synthétiques ; ils ne vérifient pas les identifiants Sightengine ni une détection réelle auprès du service externe.

## Structure

```text
backend/
├── app/
│   ├── features/
│   │   ├── image_authenticity/  # Détection IA, EXIF, C2PA et routes image
│   │   ├── source_reliability/  # Sources, évaluations et recoupement
│   │   ├── national_watch/      # Besoin 3
│   │   ├── multilingual/        # Besoin 4
│   │   ├── offline_access/      # Besoin 5
│   │   ├── experts_directory/   # Besoin 6
│   │   ├── live_statistics/     # Besoin 7
│   │   └── editorial_inspiration/ # Besoin 8
│   ├── check_video.py       # Soumission, callback et stockage des tâches vidéo
│   ├── media_validation.py  # Validation des fichiers image et vidéo
│   └── security.py          # Clé API et limitation de débit
├── main.py                  # Application FastAPI et routes
├── pyproject.toml           # Métadonnées et dépendances
└── test_api.py              # Tests des routes
```

Chaque package de besoin peut évoluer séparément dans le code ; tous sont actuellement exécutés et déployés dans la même API FastAPI. Le package `image_authenticity` est le premier fonctionnel. Les autres packages sont des espaces réservés, prêts à recevoir leur implémentation quand nous aborderons ces besoins.

## Notes

- Le cache des résultats d'images est en mémoire et est réinitialisé au redémarrage.
- Les tâches vidéo sont enregistrées dans SQLite ; sauvegardez le fichier configuré si vous devez conserver ces données.
- L'API ne définit pas de route `/` : utilisez `/health` ou `/docs`.
- Les routes d'authentification consommées par le frontend ne sont pas fournies par ce backend.
