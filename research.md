Yes — a TypeScript web app that uses the YouTube Data API to **auto-build and maintain playlists in *your* YouTube account** is one of the cleanest ways to get exactly the experience you described.

It also has a huge advantage for your Apple TV: **once the playlists exist in your account, the YouTube app on Apple TV can show and play them** (no custom Apple TV app required).

Below is what I’d build, why it works well, and the main gotchas.

---

## What the web app would feel like

### 1) Setup (one-time)

* **“Sign in with Google”** (OAuth) so the app can create/manage playlists on your behalf.
* Add creators you care about:

  * either pick from **your subscriptions** (optional), or
  * paste a channel URL / channel ID for “Day9”.
* Define your “topics” (games/series) as rules:

  * **Include keywords**: `["StarCraft", "SC2", "Brood War"]`
  * **Exclude keywords**: `["Hearthstone", "Slay the Spire"]`
  * optional: regex mode, case sensitivity, “must include all vs any”
* Choose playlist behavior:

  * One playlist per topic (recommended): “Day9 — StarCraft”, “Day9 — XCOM”, etc.
  * Privacy: **Private** or **Unlisted**
  * Ordering: newest-first vs oldest-first (more on that below)

### 2) Dashboard (daily use)

For each topic you’ll see:

* “New videos found since last sync”
* A preview list (title + date + channel)
* A **Sync Now** button
* A link to open the created playlist on YouTube

### 3) Result

Your YouTube account ends up with playlists that YouTube itself can play everywhere:

* web
* Windows
* Linux
* phone/tablet
* Apple TV YouTube app

No more scrolling through games you don’t care about.

---

## Why this works (and why it’s better than Electron first)

### You want: Windows + Linux + Browser

A **web app** already hits all three.

If you also want a “desktop app feel”, do a **PWA** (Progressive Web App):

* installable on Windows and Linux
* runs offline-ish (UI + cached settings)
* still the same codebase as the web version

Electron is fine, but it’s usually overkill for this:

* heavier packaging and updates
* you still need OAuth flows and web-ish UI anyway

A very practical path is:

1. Build it as a web app + PWA
2. If you still want a desktop wrapper later, wrap the same web app in Electron or Tauri

---

## The core trick: avoid expensive API calls

YouTube API quota is real, but your use case is very doable if you structure it right.

Key quota facts (official docs):

* Projects have a **default quota allocation of 10,000 units/day** and quotas reset at midnight Pacific Time. ([Google for Developers][1])
* `search.list` costs **100 units per call** (easy to burn quota). ([Google for Developers][2])
* `videos.list` costs **1 unit**. ([Google for Developers][3])
* Creating a playlist (`playlists.insert`) costs **50 units**. ([Google for Developers][4])
* Adding a video to a playlist (`playlistItems.insert`) costs **50 units**. ([Google for Developers][5])

### Efficient approach (recommended)

Instead of searching YouTube for “Day9 StarCraft”, do this:

* get the channel’s **Uploads playlist**
* list newest items from that playlist
* classify locally by title/description

This avoids `search.list` almost entirely.

---

## Minimal technical architecture (TypeScript)

### Option A: “Manual sync” (simplest)

* **Frontend-only web app**
* User opens it, clicks “Sync”, playlists update
* Pros: simplest, can host anywhere
* Cons: no background updates unless the app is opened

OAuth-wise, this uses the “client-side web app” approach. Google’s YouTube docs explicitly cover OAuth for JavaScript web apps. ([Google for Developers][6])

### Option B: “Auto sync” (best experience)

A tiny backend that runs on a schedule:

* frontend web app for UI
* backend worker/server that:

  * stores an OAuth refresh token securely
  * runs every N minutes/hours via cron
  * syncs playlists automatically

This is the only way to get “it just stays updated” without you opening the site.

YouTube also provides OAuth guidance for **server-side web apps** if you go this route. ([Google for Developers][7])

---

## Data model you’ll want

**Creator**

* channelId
* displayName

**TopicRule**

* name (e.g. “StarCraft”)
* includeKeywords[]
* excludeKeywords[]
* matchFields: title | description | both
* (optional) regex patterns
* (optional) limit to specific creator(s)

**PlaylistMapping**

* topicRuleId
* playlistId (created in your account)
* privacyStatus (private/unlisted)

**SyncState**

* lastCheckedAt per channel
* seenVideoIds set (or store newest publishedAt processed)

---

## How syncing works (API flow)

1. **Auth**

* OAuth scopes needed for playlist creation + insertion (YouTube documents the scopes for these methods). ([Google for Developers][4])

2. For each creator channel:

* Fetch channel details (to find uploads playlist id)
* List recent videos from uploads playlist (cheap)
* Fetch details for the video IDs (`videos.list`) (cheap) ([Google for Developers][3])

3. Classify each video using your rules:

* If title contains `StarCraft` and not `Hearthstone` → match StarCraft playlist
* Support multi-match if you want (a video can be in multiple playlists)

4. Ensure the target playlist exists:

* If not, create it with `playlists.insert` (50 units) ([Google for Developers][4])

5. Add any new videos:

* `playlistItems.insert` for each missing video (50 units each) ([Google for Developers][5])

**Important:** Each extra page you fetch costs more quota too (even for the same method), so you want to keep results tight and incremental. ([Google for Developers][1])

---

## Handling ordering (episode / series feel)

You mentioned “his thumbnail identifies the order but there are no playlists”.

Two good strategies:

### Strategy 1: “Newest first”

* You always insert new videos at the top (or just let YouTube’s playlist ordering handle it)
* Best for “keep up with new uploads”

### Strategy 2: “Series order”

* Sort by `publishedAt` ascending (oldest first)
* Great if you want a “watch from episode 1 onward” experience

Note: If you try to set explicit positions, YouTube may require the playlist ordering be set to “Manual” (their docs mention a `manualSortRequired` error if you attempt positioning while the playlist doesn’t use manual sort). ([Google for Developers][5])

---

## OAuth / verification gotchas (so you aren’t surprised)

If this is just for **you**:

* You can often keep your Google Cloud OAuth consent screen in **Testing**
* Testing is limited to **up to 100 test users**. ([Google Help][8])

If you want to publish it for others:

* Many Google scopes are considered **sensitive**
* Sensitive scopes typically require Google review/verification before “anyone” can authorize in production without warnings. ([Google for Developers][9])

So: personal project = easy; public SaaS = more process.

---

## About Infuse + “make a server for Apple TV”

Infuse is awesome, but it’s designed to connect to **media servers / files** (SMB, DLNA/UPnP, WebDAV, etc.) and play local/network video files.

To make Infuse show YouTube content “as files”, you’d effectively have to:

* download or re-host the videos, or
* proxy/redistribute streams

That runs straight into YouTube’s Terms restrictions on “access, reproduce, download, distribute…” content except as expressly authorized by the Service. ([YouTube][10])

So the **safest and most practical Apple TV route** is:

* create/manage playlists in your YouTube account
* watch those playlists in the **YouTube Apple TV app**

That gives you the curated “Infuse-like library experience” *inside YouTube*.

---

## Is this “a thing that exists” already?

Pieces exist (subscription managers, filters, “smart playlist” style tooling), but your specific combo—**keyword/topic rules + auto-playlist creation per creator**—is not something YouTube offers natively in a clean way, which is why building it is reasonable.

---

## What I’d build first (MVP plan)

1. Web app (Next.js / Remix / SvelteKit — any TS stack)
2. OAuth login
3. “Add creator by channel URL”
4. “Add topic rules (include/exclude keywords)”
5. “Sync now” button
6. Creates playlists + adds matching videos

Then iterate:

* subscription picker UI (`subscriptions.list` is cheap: 1 unit) ([Google for Developers][11])
* scheduled auto-sync (serverless cron)
* notification: “X new StarCraft videos were added”

---

If you tell me:

* whether you want **manual sync only** vs **auto sync**
* how you want topics defined (keywords only, regex, per-creator rules)
* and roughly how many creators/topics you expect

…I can sketch a concrete “v1” API call plan + folder structure (frontend + optional backend) that won’t blow quota and won’t be painful to maintain.

[1]: https://developers.google.com/youtube/v3/determine_quota_cost "Quota Calculator  |  YouTube Data API  |  Google for Developers"
[2]: https://developers.google.com/youtube/v3/docs/search/list?utm_source=chatgpt.com "Search: list | YouTube Data API"
[3]: https://developers.google.com/youtube/v3/docs/videos/list?utm_source=chatgpt.com "Videos: list | YouTube Data API"
[4]: https://developers.google.com/youtube/v3/docs/playlists/insert "Playlists: insert  |  YouTube Data API  |  Google for Developers"
[5]: https://developers.google.com/youtube/v3/docs/playlistItems/insert "PlaylistItems: insert  |  YouTube Data API  |  Google for Developers"
[6]: https://developers.google.com/youtube/v3/live/guides/auth/client-side-web-apps?utm_source=chatgpt.com "Using OAuth 2.0 for client-side web applications"
[7]: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps?utm_source=chatgpt.com "Using OAuth 2.0 for Web Server Applications | YouTube ..."
[8]: https://support.google.com/cloud/answer/15549945?hl=en&utm_source=chatgpt.com "Manage App Audience - Google Cloud Platform Console ..."
[9]: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification?utm_source=chatgpt.com "Sensitive scope verification | App verification to use ..."
[10]: https://www.youtube.com/static?template=terms "Terms of Service"
[11]: https://developers.google.com/youtube/v3/docs/subscriptions/list?utm_source=chatgpt.com "Subscriptions: list | YouTube Data API"
