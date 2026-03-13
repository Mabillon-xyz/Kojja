---
id: pol-probes
title: PoL Probes
emoji: 🔬
lastUpdated: Mars 2026
---

## Probes Proof of Life

### Probe #1 — Volume de signaux (en cours)

**Hypothèse :** Indeed et la presse locale régionale génèrent au moins 5 signaux déclencheurs actionnables par semaine et par ville dans les principales villes régionales.

**Type :** Feasibility Check

**Méthode :** Collecte manuelle — Indeed + presse locale, Lyon + Bordeaux, 5 jours (~5h de travail total)

**Critères de succès :**
| Résultat | Verdict |
|----------|---------|
| ≥5 signaux actionnables / ville / semaine | ✅ PASS — passer au probe taux de réponse |
| 3–4 signaux / ville / semaine | ⚠️ BORDERLINE — combiner avec d'autres sources |
| <3 signaux / ville / semaine | ❌ FAIL — revoir la thèse produit |

**Statut :** 🔲 Documenté, prêt à lancer

**Fichier :** `pol-probe-signal-volume.md`

---

### Probe #2 — Taux de réponse (à venir, après PASS du probe #1)

**Hypothèse :** Des messages ancrés dans un événement réel (recrutement soudain, article presse locale) obtiennent >4% de taux de réponse vs ~1% pour un message froid générique.

**Type :** À définir (probablement Feasibility Check — envoyer 50 messages manuels, mesurer)

**Statut :** 🔲 Non démarré

---

### Probe #3 — Rétention hebdomadaire (à venir)

**Hypothèse :** La coach revient d'elle-même pour sa deuxième session hebdomadaire sans relance, parce que la première session a livré un vrai lead avec un vrai message envoyé.

**Type :** À définir

**Statut :** 🔲 Non démarré
