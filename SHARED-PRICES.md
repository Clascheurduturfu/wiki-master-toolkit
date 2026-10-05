# Atlas v0.1.7 / extension v4.30.0

Atlas keeps successful market averages in `%LOCALAPPDATA%\AtlasBrowser\market-prices.sqlite`, shared by all twelve panels. The database stores card IDs, fetch timestamps and averages by rarity. It contains no images, collection ownership, cookies, login credentials or drop statistics, and uses no cloud service.

Restart Atlas to activate this update. When each panel next opens WikiMasters, its existing successful `wm_avg_v3_*` prices merge into the database automatically. Existing browser caches remain intact. The latest successful timestamp wins; a successful response with no sales is retained too. Prices have no expiry or entry limit. Failed responses never replace a successful price.

Panels read saved prices in batches before requesting missing ones. Newly fetched prices are saved and distributed to the other panels in the background. If several panels need the same missing price simultaneously, one panel requests it while the others wait for its result. Server cooldowns and login state remain separate. Manual price refresh remains available.

The shared database requires Atlas. In standalone Chrome, the same extension continues to use its existing browser cache and optional folder sync. Folder sync remains available for prices and drop statistics across computers.

## Verification during Tout ouvrir

When WikiMasters explicitly requests human verification, the batch pauses and displays the site's Turnstile verification. Complete it yourself; after WikiMasters accepts it, opening continues with the remaining packs. Cards and statistics from earlier packs are preserved. **Arrêter** ends the batch and keeps its partial results. An ambiguous failed pack-opening request is not retried automatically.

The verification token is transient and is sent only to the site's normal `/api/human-check` endpoint. This feature does not bypass verification.

Loading-time legacy controls are hidden on toolbar pages, and the pack toolbar is centered. Atlas and the extension display their new version numbers so the loaded update is easy to identify.
