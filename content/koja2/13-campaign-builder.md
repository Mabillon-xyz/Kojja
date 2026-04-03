---
id: campaign-builder
title: Campaign Builder — Guide complet
emoji: 🎯
lastUpdated: Avril 2026
---

## Qu'est-ce que le Campaign Builder ?

Le Campaign Builder est un outil qui génère un **kit de campagne Lemlist complet** pour un coach, en quelques secondes. À partir du profil du coach (spécialité, audience, résultats), il produit :

- Un **ICP** (Ideal Client Profile) rédigé
- Des **OKRs** — résultats clés attendus pour les prospects
- Des **accroches de personnalisation** (hooks)
- Des **messages LinkedIn** (≤300 caractères)
- Une **séquence de 3 emails** prête à coller dans Lemlist

Chaque kit est sauvegardé en base, modifiable à la main, et exportable en HTML ou PDF.

---

## Formule copywriting appliquée

Tous les emails et messages LinkedIn suivent une structure en 4 étapes :

| Étape | Contenu |
|-------|---------|
| **1. Personnalisation** | Référence un élément concret du profil du prospect (trigger, actualité, signal) |
| **2. Qui je suis** | Présentation courte du coach : spécialité + positionnement |
| **3. Offre précise** | Ce que le coach apporte, avec un KPI concret (ex. "turnover -60% en 12 mois") |
| **4. Call to action** | Proposition d'échange court (20 min, call découverte) |

### Format des proof points (KPI)

Les résultats concrets doivent être structurés ainsi :

```
[action coaching] → [résultat chiffré] en [X mois]
```

Exemples :
- Restructuration d'équipe dirigeante → turnover réduit de 60% en 12 mois
- DG en transition → nouveau poste trouvé en 3 mois
- Dirigeant en surcharge → délégation opérationnelle en place en 6 semaines

Ces KPIs décrivent ce que **le coach apporte à ses clients**, pas les caractéristiques du coach lui-même.

---

## Champs du formulaire

### Profil du coach

| Champ | Description |
|-------|-------------|
| **Coach / Company name** | Nom affiché dans les messages. Ex. : "Roland André — Issho Partners" |
| **Coaching specialty** | Domaine : executive coaching, leadership, transition, scaling... |
| **Target audience** | Qui le coach accompagne : "DGs de PME de 50-200 personnes", "managers en transition"... |

### Value proposition

| Champ | Description |
|-------|-------------|
| **Pain points addressed** | Les problèmes que le coach résout **pour ses clients** : surcharge décisionnelle, difficulté à déléguer, perte de sens... |
| **Concrete results / proof points** | KPIs précis, format `[action] → [résultat chiffré] en [X mois]` |
| **Additional context** | Optionnel : certifications, méthode, ton souhaité, géographie cible |

---

## Le Lead Picker — pré-remplissage IA

Quand tu sélectionnes un lead dans le menu déroulant, le système :

1. Appelle `GET /api/leads/{id}/research/suggestions`
2. Claude Haiku analyse la dernière fiche research du lead
3. Il infère automatiquement : spécialité, audience, pain points, KPIs, contexte
4. Les champs du formulaire sont pré-remplis

Le badge **"Pré-rempli via IA"** (violet) confirme que le remplissage vient de l'analyse.

> Le pré-remplissage est une suggestion — tu peux modifier chaque champ avant de générer.

---

## Génération d'un kit

Clique sur **"✨ Generate campaign kit"** (champs obligatoires remplis).

La génération prend 15–30 secondes. Un overlay de progression s'affiche.

L'API utilisée : `POST /api/campaign-builder` avec Claude Sonnet 4.6.

Le kit est **sauvegardé automatiquement** en base dès la fin de la génération.

---

## Édition manuelle

Tous les champs du kit sont éditables directement dans l'interface :

- **ICP** → zone de texte auto-resize
- **OKRs** → une zone par OKR
- **Accroches** → une zone par accroche
- **Messages LinkedIn** → avec compteur de caractères (rouge si >280)
- **Emails** → objet et corps séparément

Quand un champ est modifié, le bouton **"Mettre à jour"** apparaît dans la barre d'action.

---

## Sauvegarde et historique

### Sauvegarde

- **Auto-save** après chaque génération
- **Bouton "Sauvegarder" / "Mettre à jour"** pour sauvegarder les modifications manuelles
- Le badge **"✓ Sauvegardé"** confirme l'état synchronisé

### Historique par lead

Quand un lead est sélectionné, l'historique de ses kits précédents s'affiche dans un accordéon. Un clic sur un kit l'ouvre directement dans l'éditeur.

---

## Export

### HTML

Clic sur **"HTML"** → télécharge un fichier `.html` autonome (CSS inline, prêt à ouvrir dans un navigateur ou envoyer par email).

Contenu du HTML exporté :
- En-tête KOJ²A + nom du coach + date
- ICP
- OKRs numérotés
- Accroches de personnalisation
- Messages LinkedIn avec compteur de caractères
- Séquence email (objet + corps)
- Footer

### PDF

Clic sur **"PDF"** → ouvre la page HTML dans un nouvel onglet. Utilise **Ctrl+P / Cmd+P** pour imprimer en PDF.

> Note : les boutons Save/HTML/PDF nécessitent que la table `campaign_kits` existe dans Supabase. SQL de migration ci-dessous.

---

## Architecture technique

### Table Supabase — `campaign_kits`

```sql
CREATE TABLE IF NOT EXISTS campaign_kits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
  coach_name  TEXT NOT NULL,
  form_inputs JSONB NOT NULL DEFAULT '{}',  -- champs du formulaire
  icp         TEXT NOT NULL DEFAULT '',
  okrs        JSONB NOT NULL DEFAULT '[]',
  hooks       JSONB NOT NULL DEFAULT '[]',
  linkedin    JSONB NOT NULL DEFAULT '[]',
  emails      JSONB NOT NULL DEFAULT '[]',  -- [{subject, body}]
  label       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campaign_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON campaign_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON campaign_kits FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/campaign-builder` | Génère un kit complet (Claude Sonnet 4.6) |
| `GET` | `/api/campaign-kits?lead_id=X` | Liste les kits (méta seulement) pour un lead |
| `POST` | `/api/campaign-kits` | Sauvegarde un nouveau kit |
| `GET` | `/api/campaign-kits/:id` | Récupère un kit complet |
| `PATCH` | `/api/campaign-kits/:id` | Met à jour un kit (édition manuelle) |
| `DELETE` | `/api/campaign-kits/:id` | Supprime un kit |
| `GET` | `/api/campaign-kits/:id/export?format=html\|pdf` | Export HTML ou PDF |
| `GET` | `/api/leads/:id/research/suggestions` | Suggestions IA pour pré-remplissage |

### Suggestions IA (`/research/suggestions`)

Utilise **Claude Haiku 4.5** (rapide, peu coûteux) pour inférer depuis la dernière fiche research :

```typescript
type Suggestions = {
  coachSpecialty: string      // ex. "Executive coaching, leadership"
  targetAudience: string      // ex. "DGs de PME régionales"
  clientPainPoints: string    // problèmes que le coach résout pour ses clients
  results: string             // KPIs format "[action] → [chiffré] en [X]"
  context: string             // certifications, méthode, géographie
}
```

---

## Connexion avec la Lead Research

Le Campaign Builder est pensé pour être utilisé **après** une Lead Research :

1. **Research** : Claude Sonnet explore le profil du coach, génère icebreaker + email + LinkedIn DM
2. **Suggestions** : Claude Haiku relit la research et infère les champs du Campaign Builder
3. **Campaign Builder** : génère un kit complet de campagne Lemlist

Les messages de la research (icebreaker, email, LinkedIn DM) sont des **suggestions individuelles** pour un lead spécifique. Le Campaign Builder génère un **kit de campagne scalable** pour tous les prospects similaires.

---

## Workflow recommandé

```
1. CRM → ouvrir une fiche coach → onglet Research
2. Lancer la research IA
3. Vérifier les résultats (ICP match, profile summary, icebreaker)
4. Aller dans Campaign Builder → sélectionner le lead
5. Vérifier le pré-remplissage IA → ajuster si nécessaire
6. Générer le kit
7. Éditer les messages à la main si besoin
8. Exporter en HTML/PDF pour montrer au coach lors du call
```
