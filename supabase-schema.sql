-- ============================================================
-- Koj²a — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Documents (Notion-like, readable by RAG)
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📄',
  content      TEXT NOT NULL DEFAULT '',
  last_updated TEXT NOT NULL DEFAULT '',
  sort_order   INT  NOT NULL DEFAULT 0,
  is_system    BOOLEAN NOT NULL DEFAULT false,  -- true = strategy docs managed by Claude
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: authenticated users can read/write all documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- Seed — 10 strategy docs (system docs, is_system = true)
-- ============================================================

INSERT INTO documents (id, title, emoji, content, last_updated, sort_order, is_system) VALUES

('icp', 'ICP — Coach Claire', '👤', '## Coach Claire — "La Coach des Patrons"

### Qui elle est

| Attribut | Détail |
|----------|--------|
| **Âge** | 42–55 ans |
| **Localisation** | Lyon, Grenoble, Bordeaux, Marseille, Nantes — France régionale (pas Paris) |
| **Parcours** | Ex-directrice commerciale, ops manager ou DRH dans une PME — 12–18 ans de terrain avant de devenir coach |
| **Structure** | Strictement solo |
| **Revenus** | 50k–120k€/an |
| **Pricing** | 150–300€/h ou packages 3k–10k€ |
| **Certification** | RNCP coach ou équivalent |
| **Réseau** | CCI, BNI, Réseau Entreprendre, CGPME, petits-déjeuners business locaux |
| **Présence digitale** | Profil LinkedIn, poste 1x/semaine au mieux, site basique. Pas LinkedIn-native. |
| **Tech** | Google Workspace, WhatsApp, Calendly, peut-être Notion. Pas une power-user SaaS. |

### Sa voix

> *"Je vis de ma réputation. Si j''envoie un message déplacé à un dirigeant que je croise à la CCI le lendemain, c''est terminé pour moi."*

> *"Je fonctionne surtout par recommandation. Mais quand un client part, j''ai rien dans le pipe. Je repars de zéro à chaque fois."*

> *"Je sais pas qui a besoin de moi maintenant. Je pourrais accompagner 20 patrons demain, mais je sais pas les trouver ni quoi leur dire."*

> *"Je suis pas commerciale. J''ai jamais été à l''aise avec la prospection. C''est pour ça que je suis devenue coach."*

### Ses objectifs

| Horizon | Objectif |
|---------|----------|
| Maintenant (0–3 mois) | Combler le pipeline sans sacrifier les heures de coaching |
| Ensuite (3–9 mois) | Générer 30–50k€ de nouveau CA via prospection proactive |
| Plus tard (1–2 ans) | 6 mois de pipeline visible en permanence — plus d''anxiété revenu |
| Aspirationnel | La coach de référence pour les PME en croissance dans sa région |

### Déclencheurs d''adoption

- **Budget** : décideuse solo, plafond 99–149€/mois
- **ROI requis** : 1 RDV discovery en 30 jours paie 3 mois d''abonnement
- **Trigger d''adoption** : un pair coach dans son réseau CCI/BNI la recommande
- **Trigger de rejet** : setup > 20 min, ou premier message qui sonne robotique', 'Mars 2026', 1, true),

('problem', 'Problème', '🎯', '## Statement du problème

### Formulation finale

> Coach Claire, coach business indépendante accompagnant des TPE/PME en France régionale, n''a aucun moyen de trouver systématiquement des dirigeants qui traversent **en ce moment** une situation qui nécessite du coaching — parce que les signaux qui révèlent ce besoin sont enfuis dans les données des registres d''entreprises français, l''activité locale de recrutement et la presse régionale, plutôt que sur LinkedIn, et aucun outil ne traduit ces signaux en messages personnalisés qu''elle peut envoyer en quelques minutes. Elle est piégée dans un pipeline dépendant des recommandations qui se tarit de façon imprévisible, la laissant alterner entre pleine capacité et anxiété revenus — malgré une expertise suffisante pour remplir sa pratique plusieurs fois.

### Les 4 blocages

**1. Les vrais signaux de douleur sont invisibles sur LinkedIn**
Les dirigeants de TPE/PME en France régionale ont un profil LinkedIn mais n''y postent presque jamais. Leur réalité professionnelle — un collaborateur clé vient de partir, l''entreprise vient de doubler de taille, le fondateur prépare une succession — n''apparaît jamais dans leur feed.

**2. Les signaux qui existent sont épars et manuels à agréger**
Un changement de dirigeant sur Infogreffe, une vague soudaine d''offres Indeed, une croissance visible dans un bilan déposé, une mention dans La Tribune — ce sont les vrais indicateurs qu''un besoin de coaching s''est activé. Les rassembler pour 10 leads prend des heures.

**3. Aucun outil ne connecte ces signaux à l''outreach**
Les outils d''automatisation LinkedIn ont été construits pour le B2B tech à Paris et San Francisco — pas pour une coach à Lyon qui prospecte un gérant de garage avec 30 salariés.

**4. La recherche manuelle + rédaction prend 30–60 min par lead**
À ce rythme, elle peut contacter 1–2 personnes par jour au mieux. Dix, c''est impossible. Sa prospection ne devient jamais un système — elle reste un effort sporadique qu''elle abandonne dès qu''elle est occupée à coacher.', 'Mars 2026', 2, true),

('jtbd', 'Jobs To Be Done', '⚙️', '## Jobs To Be Done

### La coach (cliente payante de Koj²a)

**Jobs fonctionnels**
- Identifier les dirigeants qui traversent **en ce moment** une situation nécessitant du coaching
- Contacter 10 nouveaux leads par semaine en moins d''1h au total
- Rédiger des messages suffisamment spécifiques à la situation du destinataire pour ouvrir une conversation
- Passer d''un premier contact à un RDV discovery en moins de 3 touchpoints
- Maintenir un pipeline prévisible pour que le revenu ne dépende pas des recommandations

**Jobs sociaux**
- Être perçue comme une coach qui a contacté pour une raison — pas un démarcheur générique
- Maintenir sa réputation dans une petite communauté professionnelle où brûler un contact = brûler les recommandations

**Jobs émotionnels**
- Se sentir confiante que le pipeline ne se tarira pas quand un contrat se termine
- Éviter l''inconfort d''envoyer de l''outreach générique en masse (incompatible avec l''identité coach)
- Sentir que le développement commercial est sous contrôle pour se concentrer sur le coaching

### Le lead (dirigeant TPE/PME)

| Situation | Où la détecter | Douleur coaching signalée |
|-----------|---------------|--------------------------|
| Entreprise créée < 2 ans | Pappers / SIRENE | Construction d''équipe pour la première fois |
| Changement de dirigeant | Infogreffe (actes déposés) | Transition de leadership, succession, rachat |
| Effectif en croissance rapide | Indeed / France Travail | Challenge de management à l''échelle |
| 3+ postes manager simultanés | Indeed | Scaling du management |
| Premier cadre dirigeant (DAF, DG) | LinkedIn + Indeed | Fondateur qui délègue le contrôle pour la première fois |
| Article presse locale (croissance, award) | La Tribune, Les Echos Régions | Croissance publique = anxiété scaling privée |', 'Mars 2026', 3, true),

('positioning', 'Positionnement', '🧭', '## Positionnement

### Value Proposition (Geoffrey Moore — révisée post-débat)

**Pour** les coachs business indépendants en France régionale qui accompagnent des dirigeants de TPE et PME,

**qui ont besoin** de construire un pipeline proactif sans outreach de masse, sans sacrifier leur réputation dans une petite communauté professionnelle, et sans devenir commerciales,

**Koj²a est un** assistant de prospection pour coachs,

**qui** fait remonter une poignée de dirigeants locaux qui traversent visiblement un moment de coaching en ce moment — une vague soudaine de recrutements, un changement de leadership, un palier de croissance dans la presse locale — et rédige un message ancré dans leur situation spécifique, prêt pour votre relecture et approbation.

---

### Différenciation

**Contrairement aux** outils d''outreach générique construits pour les équipes commerciales tech à Paris et San Francisco, qui personnalisent les messages à partir de posts LinkedIn que les chefs d''entreprise traditionnels n''écrivent presque jamais,

**Koj²a est construit pour les coachs qui travaillent avec des entreprises traditionnelles qui opèrent** — la boulangerie, la plomberie, le fabricant régional — dont les vrais défis apparaissent dans l''activité de recrutement, les changements de registre d''entreprise et la presse locale.

---

### 3 angles de différenciation

| Angle | Contre | Idéal pour |
|-------|--------|-----------|
| **A — vs. prospection manuelle** | "45 min/lead → 3 min/lead" | Coachs qui ont essayé et s''y sont épuisées |
| **B — vs. automatisation LinkedIn** | "Construit pour TPE/PME, pas pour la vente tech parisienne" | Coachs qui ont essayé Waalaxy / Expandi et échoué |
| **C — vs. dépendance aux recommandations** | "Arrêtez d''attendre que le téléphone sonne" | Coachs qui n''ont jamais essayé l''outbound |

---

### Règle de langage

Ne jamais dire **"automatisation"** — toujours dire **"intelligence"** ou **"assistant"**.', 'Mars 2026', 4, true),

('northstar', 'North Star & Métriques', '⭐', '## North Star & Métriques

### North Star (révisé post-débat)

**Ancienne formulation :** Contacter 10 leads qualifiés par jour en moins d''1h.

**Nouvelle formulation :** Envoyer 3 messages par semaine dont vous êtes fière — et qu''au moins 1 génère une réponse.

---

### Métriques de support

| Métrique | Cible |
|----------|-------|
| Taux de réponse sur messages situationnels | >4% (baseline email froid générique ~1%) |
| RDV discovery bookés/mois via outbound | ≥2 dans les 30 jours après activation |
| Temps passé en BD par semaine | <30 minutes |
| Taux de revue hebdomadaire (coach ouvre son digest) | >80% des lundis |

---

### Modèle d''usage (révisé post-débat)

**Nouveau :** digest async hebdomadaire, push-based.

```
Lundi matin : Koj²a envoie "5 leads matchent vos situations cette semaine"
La coach ouvre le digest (email ou notif app)
Elle revoit 5 leads en 10 minutes
Approuve 3, passe 2
Les messages s''envoient depuis Lemlist
Terminé. 10–15 minutes. Aucune obligation quotidienne.
```

**Indicateur de rétention :** Taux de revue hebdomadaire — pas les DAU.', 'Mars 2026', 5, true),

('data-architecture', 'Architecture Data', '🗄️', '## Architecture Data

### Niveaux de priorité des sources (révisé post-débat)

| Source | Latence | Rôle dans le produit |
|--------|---------|---------------------|
| **Indeed / France Travail** | 24–48h | **Trigger primaire** |
| **Presse locale** (La Tribune, Les Echos Régions) | 24–72h | **Trigger primaire** |
| **Infogreffe / Pappers** | 4–8 semaines | **Enrichissement contexte** |
| **Bilans annuels** | 3–6 mois | **Scoring uniquement** |

### Implication clé

Un "changement de dirigeant" sur Infogreffe **ne déclenche PAS** un outreach par lui-même. Une vague de nouvelles offres France Travail + une mention récente dans la presse locale de croissance + Infogreffe montrant que l''entreprise a 3 ans et est structurellement stable = un moment de coaching.

### Archetypes de signaux (M1–M6)

| Code | Archétype | Exemples de signaux |
|------|-----------|---------------------|
| **M1** | Scaling management | 3+ postes manager/encadrement ouverts simultanément |
| **M2** | Premier cadre dirigeant | Recrutement premier DAF, DG adjoint, COO, DRH |
| **M3** | Succession / transition | Article presse sur cession, reprise, nouveau dirigeant |
| **M4** | Croissance publique | Article presse : expansion, ouverture site, award, label BPI |
| **M5** | Structuration RH | Recrutement RRH, responsable formation, QVCT dans une PME |
| **M6** | Création récente + croissance | Entreprise < 3 ans avec plusieurs recrutements simultanés |', 'Mars 2026', 6, true),

('strategy', 'Stratégie & GTM', '🚀', '## Stratégie & GTM

### Ambition marché

**Option A — Produit bootstrappé (chemin immédiat recommandé)**
- Cible : 200–350 coachs payantes en France dans 3 ans
- Plafond revenu : 300–500k€ ARR
- Équipe : 1–2 personnes, infra légère

**Option B — Plateforme beachhead**
- Les coachs = vertical wedge ; architecture extensible à tout professionnel de service B2B solo
- **Recommandation actuelle :** Démarrer en Option A, s''engager en Option B après 6 mois de données réelles.

---

### Séquence GTM

**Phase 1 — PoL (maintenant, 4–6 semaines)**
- 3–5 coachs beta (non payantes), exécution manuelle
- Objectif : valider le taux de réponse (>4%)
- Seuil de succès : 2 coachs bookent au moins 1 RDV discovery via Koj²a

**Phase 2 — Seeding communautaire**
- 1 success story → étude de cas → webinaire démo live
- Cible : 20–30 utilisateurs payants dans les 60 jours

**Phase 3 — Canal CCI/BNI**
- Conversion inbound chaud, pas cold outbound
- Cible : 50 utilisateurs payants fin du Mois 6

---

### Pricing

| Offre | Prix |
|-------|------|
| Coach solo | 99–149€/mois |
| Cabinet 2 coachs | 249–299€/mois |

### Moat réel

**Encastrement communautaire dans les réseaux de coachs français.** Chaque coach qui signe un client via Koj²a devient un vecteur de bouche-à-oreille. Le switch implique un risque social, pas juste une migration technique.', 'Mars 2026', 7, true),

('debate', 'Débat & Décisions', '⚔️', '## Débat Contradictoire — Synthèse des Décisions

### Ce que le débat a changé

| Sujet | Claim original | Concession |
|-------|---------------|------------|
| **North Star** | "10 leads/jour" | Mauvaise métrique. Remplacé par métrique résultat. |
| **Architecture data** | Toutes les sources traitées également | Infogreffe lag 4–8 semaines. Indeed + presse = primaires. |
| **Moat** | "Data française + archetypes coaching" | La couche data est reproductible. Le vrai moat est la distribution communautaire. |
| **Taille marché** | Implication venture | Plafond TAM strict ~500k€ ARR. Bootstrappé ou thèse beachhead explicite. |
| **Canal GTM** | CCI/BNI comme primaire | Trop lent. Raccourci digital nécessaire (LinkedIn + webinaire démo). |
| **Modèle d''usage** | Habitude quotidienne | Digest async hebdomadaire push-based. |

### Ce qui tient

| Sujet | Défense |
|-------|---------|
| **Diagnostic problème** | Taux de recommandation 70% = elle sait closer. Goulot = accès, pas compétence. |
| **Ancrage situationnel** | L''hypothèse messages contextuels = 3–5x le taux de l''email froid. Testable. |

---

### Les 3 défis qui peuvent encore tuer ce produit

1. Messages situationnels ne battent pas 3% de taux de réponse → le cas ROI s''effondre
2. Indeed + presse ne génèrent pas ≥5 triggers/ville/semaine → "0 leads cette semaine" → churn
3. La coach ne revient pas d''elle-même à sa deuxième session sans relance → adoption échoue', 'Mars 2026', 8, true),

('pol-probes', 'PoL Probes', '🔬', '## Probes Proof of Life

### Probe #1 — Volume de signaux (en cours)

**Hypothèse :** Indeed et la presse locale génèrent ≥5 signaux actionnables / ville / semaine.

**Type :** Feasibility Check

**Méthode :** Collecte manuelle — Indeed + presse locale, Lyon + Bordeaux, 5 jours (~5h)

| Résultat | Verdict |
|----------|---------|
| ≥5 signaux / ville / semaine | ✅ PASS |
| 3–4 signaux / ville / semaine | ⚠️ BORDERLINE |
| <3 signaux / ville / semaine | ❌ FAIL |

**Statut :** 🔲 Documenté, prêt à lancer

---

### Probe #2 — Taux de réponse (après PASS du probe #1)

**Hypothèse :** Messages ancrés dans un événement réel → >4% de taux de réponse vs ~1% générique.

**Statut :** 🔲 Non démarré

---

### Probe #3 — Rétention hebdomadaire

**Hypothèse :** La coach revient d''elle-même pour sa deuxième session sans relance.

**Statut :** 🔲 Non démarré', 'Mars 2026', 9, true),

('product-architecture', 'Architecture Produit', '🏗️', '## Architecture Produit

### Flow core

```
1. Ingestion data
   France Travail / Indeed     → offres d''emploi par ville
   Presse locale (RSS)         → articles de croissance / changement
   Pappers / Infogreffe        → enrichissement contexte entreprise

2. Moteur de détection des triggers
   → archetypes de situations coaching (M1–M6)

3. Bibliothèque de situations de la coach
   La coach définit 5–8 "situations que j''accompagne"
   Le système matche les leads entrants à ces situations

4. Génération de message
   L''IA rédige un message ancré dans le trigger spécifique
   La coach relit + approuve (humain dans la boucle)

5. Routing campagne
   Lead approuvé → campagne Lemlist
   La coach review et envoie depuis Lemlist

6. Boucle de feedback
   Situation → taux de réponse → conversion RDV discovery
```

### Stack MVP

- **Frontend :** Next.js 14 App Router (basePath: /koja2)
- **Database :** Supabase (PostgreSQL + Auth)
- **AI :** Claude Opus 4.6 (classification + génération message)
- **Jobs data :** France Travail API (OAuth2, gratuit)
- **Enrichissement :** Pappers API (100 req/mois free tier)
- **Presse :** RSS feeds La Tribune / Les Echos Régions / SudOuest Éco
- **Outreach :** Lemlist API
- **Cron :** GitHub Actions (lundi 8h → POST /api/pipeline/run)
- **Deploy :** Vercel (kojja.vercel.app/koja2)', 'Mars 2026', 10, true)

ON CONFLICT (id) DO UPDATE
  SET title = EXCLUDED.title,
      emoji = EXCLUDED.emoji,
      content = EXCLUDED.content,
      last_updated = EXCLUDED.last_updated,
      sort_order = EXCLUDED.sort_order,
      is_system = EXCLUDED.is_system;
