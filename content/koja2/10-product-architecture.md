---
id: product-architecture
title: Architecture Produit
emoji: 🏗️
lastUpdated: Mars 2026
---

## Architecture Produit

### Flow core

```
1. Ingestion data
   France Travail / Indeed     → offres d'emploi par ville
   Presse locale (RSS)         → articles de croissance / changement
   Pappers / Infogreffe        → enrichissement contexte entreprise

2. Moteur de détection des triggers
   Mappe les combinaisons de signaux → archetypes de situations coaching
   (ex. "3 recrutements manager + article croissance" → Situation M1 Scaling Management)

3. Bibliothèque de situations de la coach
   La coach définit 5–8 "situations que j'accompagne" avec description
   Le système matche les leads entrants à ces situations

4. Génération de message
   L'IA rédige un message ancré dans le trigger spécifique
   La coach relit + approuve (toujours humain dans la boucle)

5. Routing campagne
   Lead approuvé → routé vers campagne Lemlist
   La coach review et envoie depuis Lemlist

6. Boucle de feedback analytique
   Quelle situation → taux de réponse → conversion en RDV discovery
   Remonté à la coach pour affiner sa bibliothèque de situations
```

### Ce que LinkedIn est (et n'est pas) utilisé pour

| Usage | Rôle LinkedIn |
|-------|--------------|
| Trouver les infos contact (nom, email via Sales Nav) | ✅ Toujours valide |
| LinkedIn InMail outreach | ⚠️ Basse priorité — les patrons TPE/PME vérifient rarement leur InMail |
| Personnalisation basée sur les posts | ❌ Remplacé par la data trigger événement |
| Détection de signaux | ❌ Remplacé par les sources françaises |

### Canal d'outreach principal pour ce segment

Email (via Lemlist) > Suggestion appel téléphonique > LinkedIn InMail

### Stack MVP

- **Frontend :** Next.js 14 App Router
- **Database :** Supabase (PostgreSQL + Auth)
- **AI :** Claude Opus 4.6 (classification + génération message)
- **Jobs data :** France Travail API (OAuth2, gratuit)
- **Enrichissement :** Pappers API (100 req/mois free tier)
- **Presse :** RSS feeds La Tribune / Les Echos Régions / SudOuest Éco
- **Outreach :** Lemlist API (la coach review directement dans Lemlist)
- **Cron :** GitHub Actions (lundi 8h → POST /api/pipeline/run)
