# closing-board-demo-quiz

API de démonstration d'un petit LMS (quiz, tentatives, feedback, administration), utilisée pour la **démo du Closing Board**. Toutes les données sont fictives.

## Lancer

```bash
cp .env.example .env
npm install
npm run seed       # comptes fictifs, mot de passe demo1234
npm start          # http://localhost:3000/api/health
npm test           # tests node:test sur une base MongoDB locale
```

Avec Docker (API + MongoDB) : `docker compose up --build`, puis `docker compose exec api npm run seed`.

## Routes principales

| Méthode | Route | Rôle | Rôle de la route |
|---|---|---|---|
| POST | `/api/auth/login` | public | jeton JWT (8 h) |
| GET | `/api/quizzes` | tous | quiz, sans les bonnes réponses pour un apprenant |
| POST | `/api/quizzes` | formateur | créer un quiz (validation, erreurs JSON) |
| POST | `/api/attempts` | apprenant | tentative notée, 3 au plus, e-mail de score |
| GET | `/api/attempts/me` | connecté | mes tentatives seulement |
| GET | `/api/attempts/progression` | connecté | meilleur score par quiz, moyenne |
| POST | `/api/feedback` | formateur | feedback sur une tentative, e-mail |
| GET/PATCH | `/api/me/preferences` | formateur | heure et modules du résumé quotidien |
| GET/PATCH | `/api/admin/settings` | admin | e-mails, cron du résumé quotidien |
| POST | `/api/admin/jobs/digest` | admin | lancer le résumé à la main |
| GET | `/api/admin/stats` | admin | statistiques pour un tableau de bord React |

Toutes les routes sauf `/api/health` et `/api/auth/login` demandent `Authorization: Bearer <jeton>`. Un apprenant n'accède qu'aux modules qu'il suit, un formateur qu'aux modules qu'il enseigne.

## Erreurs

Toutes les erreurs ont la même forme : `{ "error": { "code", "message", "details?" } }`.

## Documentation

- OpenAPI : `docs/openapi.yaml`
- Collection Postman : `docs/lms-api-demo.postman_collection.json`

## À faire

- Envoi SMTP réel.
