# Auctions, achievements and interface · v4.29.0

**Mes enchères** and **Succès** are available directly in the collection toolbar, and also on the pack, market, achievement, trade and family screens when those pages expose a toolbar/header. **Outils** groups compact view, synchronisation, settings and price help. Pack opening stays prominent; recap visibility moves into Outils. Existing settings, prices, pull counters and file-sync handles remain compatible.

## Auctions

Opening **Mes enchères** loads your selling, bidding and recent wins from the same endpoint used by WikiMasters QoL: `GET /api/marketplace?page=1&limit=50&sort=recent&mine=1`. Rows have images, full card names, exact rarity, current/final amounts, remaining time and the exact-rarity average. **Actualiser** reloads the activity and requests fresh summaries for the displayed card definitions through the existing three-request price queue. Native/in-flight or just-fetched summaries are reused to avoid duplicating work. Loading/errors remain visible; a failed price refresh keeps the previous successful average. Successful summaries enter the permanent collection/file-sync cache.

Paste a WikiMasters auction link into **Suivre une enchère sans miser**. The detail GET validates it, then saves a small snapshot in `wm_auction_watchlist_v1` in this browser session. No bid is placed. Watched links survive page/browser reloads and can be removed individually. A **Suivre sans miser** button also appears on native auction detail pages. Watches are local to the browser/profile and are not included in price/drop-stat file sync. Failed watch refreshes preserve the link and show the error. The watchlist allows 50 links and refreshes details at three requests concurrently.

Watching/pricing somebody else's card does not make it part of your owned collection ranking. Ownership metadata or the saved full collection is required for new ranking candidates.

## Achievements

Opening **Succès**, or clicking **Vérifier les nouveaux succès**, first awaits `POST /api/achievements/check` with the native `{event:"achievements_sync"}` body. Only after that completes does it read the achievements catalogue and your `user_achievements` rows. This avoids presenting the initial pre-check list as the final result. The server still determines when an achievement is unlocked; the UI shows progress while it checks, and API failures never become an empty success list. A live check took approximately nine seconds during research.

**Tout réclamer** is an explicit click. It checks for newly unlocked rewards again, then claims the current unclaimed IDs sequentially via `POST /api/achievements/claim` with `{achievement_id}`. Confirmed responses update the site's native balance event. Already-claimed responses are excluded from gained rewards. Failure/ambiguous responses stop the sequence without automatic mutation retries. The authoritative claim state is read again afterward. A Web Lock prevents concurrent claim-all operations in other tabs of the same browser profile.

The Supabase read credentials come from the site's own intercepted authenticated request template, held in memory. This feature does not persist/export tokens, cookies or achievement state. If no template is available, it asks you to open the native achievement page once. No new extension permissions are required.

## Interface behavior

Shared dark surfaces, consistent buttons/fields, full wrapping names, contained images, responsive layouts and visible primary/destructive actions cover ranking, discard, bulk prices, settings, sync and the new panels. The price loader defaults to missing prices; unchecking that option explicitly refreshes the chosen rarities without a redundant second confirmation. The sync panel hides irrelevant connection controls and groups manual backups separately.

Extension dialogs, including family creation, sharing, card pickers and progress, do not dismiss from backdrop clicks or input drags ending outside the panel. Use their close/cancel controls or Escape. Escape only affects the topmost dialog; Tab stays inside it, background scrolling is locked, and focus returns to the launch control. Hidden or disabled progress/claim/discard close controls cannot be activated with Escape. The existing discard confirmation and favorite/shiny/trade/sale protections remain in force.

## Verification

Focused activity tests cover saved watch links without bids, foreign-link rejection, discovery-before-read and concurrent check deduplication, rate-limit errors, confirmed/already-claimed rewards and stopping on ambiguous claims. Existing price and file-sync behavior checks remain green. The Chromium fixture exercises all twelve isolated Atlas sessions plus real panel clicks, fresh summaries, watch storage, discovery and claim-all against synthetic APIs, nested/backdrop/keyboard behavior and desktop/narrow screenshots. No real bids, sales, packs, discard or reward claims were performed.
