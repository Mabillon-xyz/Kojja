---
id: email-system
title: Email System
emoji: 📧
lastUpdated: Mars 2026
tag: tech
---

## Email System

### Overview

Automated reminder emails sent to leads before their scheduled discovery call. Two reminders fire automatically: 24 hours before and 1 hour before the call start time.

---

### Architecture

```
Lead books a call (booking page)
        ↓
POST /api/calendly/invite
  → Inserts lead in `leads` table
  → Deletes all existing scheduled_emails for this email
  → Inserts 2 rows in `scheduled_emails` (24h + 1h reminders)
        ↓
cron-job.org pings GET /api/cron every 5 minutes
  → Fetches all rows from `scheduled_emails`
  → Filters in JS: send_at ≤ now AND sent !== true AND sent_at === null
  → Sends due emails via Gmail (nodemailer)
  → Updates row: sent = true, sent_at = now()
```

---

### `scheduled_emails` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `send_at` | TIMESTAMPTZ | When to send (Paris time, stored as UTC) |
| `to_email` | TEXT | Recipient |
| `subject` | TEXT | Email subject |
| `body_html` | TEXT | Full HTML body |
| `sent` | BOOLEAN | `true` after successful send |
| `sent_at` | TIMESTAMPTZ | Timestamp of actual send |
| `error` | TEXT | Error message if send failed |

---

### Reminder Templates

**24h reminder** — subject: `Rappel : votre call avec Clément demain à {time}`

**1h reminder** — subject: `C'est dans 1h — votre call avec Clément à {time}`

Both emails include:
- Date and time of the call (Europe/Paris)
- Google Meet link
- Lead's first name for personalization

---

### Cron Route — `/api/cron`

Key implementation details:

```ts
export const dynamic = "force-dynamic"; // prevent Next.js route caching

function getSupabase() {
  return createClient(url, key, {
    global: {
      // prevent Next.js data cache from serving stale Supabase responses
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  });
}

// SELECT * — no PostgREST filters (see gotcha below)
// Filter 100% in JS:
const pending = allRows.filter(row => {
  const isDue = new Date(row.send_at).getTime() <= Date.now();
  const isUnsent = row.sent_at === null && row.sent !== true;
  return isDue && isUnsent;
});
```

---

### Invite Route — `/api/calendly/invite`

On each new booking:

```ts
// 1. Delete all pending rows for this lead (handles re-bookings)
await supabase.from("scheduled_emails").delete().eq("to_email", email);

// 2. Insert 24h and 1h reminders
for (const step of [{ offsetMs: 24 * 3600 * 1000 }, { offsetMs: 3600 * 1000 }]) {
  const sendAt = new Date(callStartTime.getTime() - step.offsetMs);
  if (sendAt <= new Date()) continue; // skip if already past
  await supabase.from("scheduled_emails").insert({
    send_at: sendAt.toISOString(),
    to_email: email,
    subject: step.subject,
    body_html: buildEmailHtml(...),
    sent: false, // always explicit
  });
}
```

---

### Environment Variables

| Variable | Value |
|----------|-------|
| `GMAIL_USER` | `clement.guiraudpro@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not the account password) |

Emails are sent from `Clément Guiraud <clement.guiraudpro@gmail.com>` via Gmail SMTP port 465.

---

### Critical Gotchas

#### 1. PostgREST null/boolean filters are broken on `scheduled_emails`

These all return 0 rows on this table even when matching rows exist:

```ts
.is("sent_at", null)        // ❌ returns nothing
.eq("sent", false)          // ❌ returns nothing
.not("sent", "is", true)    // ❌ returns nothing
```

**Fix:** `SELECT *` with no filters, then filter in JavaScript.

#### 2. Next.js data cache serves stale Supabase responses

Without `cache: "no-store"`, Next.js caches Supabase `fetch` calls. The cron SELECT returns the same rows across multiple runs — including rows already marked as `sent: true`. This causes the same email to be sent every 5 minutes indefinitely.

**Symptom:** `verifyAfter.sent_at` shows a timestamp from a previous run (e.g., `21:05:06`) instead of the current run.

**Fix:** Pass `cache: "no-store"` in the Supabase client's `global.fetch` override.

#### 3. Next.js route caching

Without `export const dynamic = "force-dynamic"`, Next.js caches the GET route handler response and returns the same JSON on every cron ping.

**Fix:** `export const dynamic = "force-dynamic"` at the top of the cron route file.

#### 4. Accumulated rows from re-bookings

If a lead re-books, a second set of reminders is inserted without removing the first. Both sets eventually become due and fire, causing a flood of duplicate emails spread across multiple cron intervals.

**Fix:** DELETE all rows for the lead's email before inserting new reminders in the invite route.

#### 5. Gmail SMTP does not deliver to yopmail.com

Test only with real Gmail addresses.

---

### Timezone Handling

The call start time arrives from the booking form as `date` (YYYY-MM-DD) + `time` (HH:MM) in Europe/Paris timezone.

```ts
// Convert Paris local time to UTC for storage
const [h, m] = time.split(":").map(Number);
const parisOffset = /* CET = +60 min, CEST = +120 min */;
const startUTC = new Date(Date.UTC(year, month, day, h, m) - parisOffset * 60000);
```

DST switch: last Sunday of March (CET → CEST, +1h → +2h).
