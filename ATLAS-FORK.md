# WikiMastersTools - Atlas v4.30.0

Local adaptation of the installed WikiMastersTools-kzfamily v4.27.7 by kzfamily. The original README and PRIVACY documents remain with the source. This is an unpacked local fork; it has its own extension identity and no Chrome Web Store updater.

Atlas loads this folder automatically in all twelve isolated panel sessions. Restart Atlas to load updated files. For Chrome, reload the unpacked extension in `chrome://extensions`, then refresh WikiMasters. The collection toolbar shows **Atlas v4.30.0**. The original extension written for this project, including its tests and documentation, is preserved at `../backups/extension-ours-v1.2.1/`.

## Auctions, achievements and interface

The Atlas adaptation adds Mes enchères with images, fresh cached averages and saved watch links; Succès discovers new rewards before reading/claiming them. Shared toolbar, grouped secondary tools, responsive surfaces and stable keyboard-aware dialogs. See [ACTIVITY.md](ACTIVITY.md) for behavior and validation.

## Shared prices and pack verification in v4.30.0

Atlas v0.1.7 imports existing successful prices into a local SQLite database and shares them across all twelve panels. Unknown prices are deduplicated across panels; prices never expire. Tout ouvrir pauses for the site's verification and resumes the remaining batch after a successful check. Existing caches and standalone Chrome folder sync are preserved. Restart Atlas to activate. See [SHARED-PRICES.md](SHARED-PRICES.md).

## Price behavior

- Successful sales-summary responses are stored indefinitely in same-origin localStorage. There is no 24-hour expiry, 30-day cleanup or card-count cap. Empty successful summaries remain distinguishable from failed requests. Clearing site data still clears the cache; unavailable/full storage falls back to memory.
- Existing prices from the old Atlas extension migrate to the shared `wm_avg_v3_{cardId}` format. Newer cached reference prices take precedence. The old cache is preserved as well.
- Collection cards near the viewport load missing prices automatically, with the reference's three concurrent requests. Cached cards are reused without another request, including after reloads and restarts.
- **Tout ouvrir** already prices cards and stores them in the collection cache. Single-pack openings now also price cards with the recap feature disabled. Opening automation itself remains controlled by the reference's existing toggle.
- Successful site-originated sales-summary responses, including auction dialog requests through fetch or XMLHttpRequest, update the same permanent cache. Malformed or failed responses do not replace good prices.
- Pending price work is saved before a request starts and resumed on the next WikiMasters page after navigation or restart. Successful requests remove their pending entry. Transient network/5xx/429 failures retry automatically with increasing delays, respecting Retry-After. Permanent HTTP/data errors stay visible and pending for a later visit; error results are temporary rather than permanent successes.
- Deliberately reloading selected rarities remains possible through **Charger les prix**. Failed refreshes preserve previous prices, with a visible loading/error status beneath the price. 401/403/429 responses pause price work; Retry-After is respected, and cooldown is isolated per panel. There is no server-limit bypass.
- Prices correspond strictly to the displayed card rarity. Null averages remain missing; zero is a real price.

To initialize the collection, select **Toutes** in **Charger les prix**, then **Charger ces raretés**. Afterwards the extension requests prices for uncached cards and automatically caches newly pulled cards. Saved prices are historical averages until a manual refresh or a new site response updates them; retaining a price does not track future market movement automatically.

## Discard by price across all collection pages

**Discard**, immediately after **Plus chères**, automatically previews cached owned copies sorted by increasing price, without another collection scan. A successful **Moy. —** counts as zero for selection; API errors, pending requests and never-analysed prices are excluded. **Recalculer la sélection** uses only local data; **Charger la collection complète** appears only for an incomplete ownership cache and does not load prices. Favorites, shiny cards, trades and sales are protected. You explicitly confirm before a fresh ownership/protection check and permanent discard in fixed 50-copy batches. Errors, partial results or changed prices stop work; mutation requests are never automatically retried or resumed after reload. Existing data, permanent price history and pull stats are retained. See [DISCARD.md](DISCARD.md) for usage, research evidence and validation.

## Local folder sync on Windows and Mac

This feature belongs to the extension and uses Chrome's [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). It needs no Atlas storage, Windows helper, cloud API credentials or server. Google Drive for desktop, or another folder sync service, transports the files between computers.

1. Reload the updated extension and refresh WikiMasters in your existing browser session first. Do not clear site data or uninstall the extension to update it.
2. Create a dedicated folder such as `Google Drive/WikiMasters/account-name` on the computer with your existing data.
3. Click **Outils → Synchronisation → Choisir un dossier** in the collection toolbar and select that folder. Allow Chrome to read and write it. Current cached prices and pull totals are added automatically; no initial price reload is needed.
4. Wait for Google Drive to upload the JSON file. On the other computer, install the same extension, open the same WikiMasters account, then choose that same synced folder via **Outils → Synchronisation**. Its cached prices and drop statistics will merge into the current session.

Use a different folder for each WikiMasters account. Each browser session writes its own `wm-sync-{UUID}.json` file, so simultaneous computers do not overwrite each other's updates. Files contain successful prices with their fetch timestamps and pull counts by rarity; cookies, authentication data, settings, VPN information and pending requests stay local.

The extension exports local changes after about 1.5 seconds and checks the folder every 30 seconds while WikiMasters is visible, as well as when returning to the tab. Google Drive adds its own transfer delay. A closed page does not run sync; **Synchroniser maintenant** runs a check immediately. The chosen folder handle is remembered in IndexedDB. If Chrome asks for access again, click **Réautoriser**. Folder permission is required once from your own click; the extension cannot choose your folder silently.

The existing `wm_avg_v3_{cardId}` price cache and `wm_pull_stats_v1` statistics format continue to work. On first start, current totals become the initial history and a copy is preserved at `wm_file_sync_original_stats_v1`. Sync metadata is stored separately at `wm_file_sync_state_v1`. Repeated imports or syncs do not double-count pulls. Newest successful prices win, and saved prices have no expiry. Resetting pull statistics also resets their synced history when other configured sessions next sync. Price errors do not replace valid cached prices.

**Désactiver** stops this page's file sync and preserves its files and browser data. **Exporter une sauvegarde / Importer une sauvegarde** work without continuous folder access. Imports merge validated data rather than replacing the current cache. An invalid foreign file is ignored with a visible status; an invalid file belonging to this session is preserved and reported without being overwritten. Deleting or rolling back a valid session file is repaired from the browser's retained data on the next sync. Keep an exported backup before deliberately clearing browser site data.

## Integration and verification

The manifest loads the original page modules directly in MAIN world, in dependency order at document_start. The isolated bootstrap still handles extension-context semantic requests and clipboard features. This avoids page script URL injection and works with Atlas's existing proxy and request restrictions. No extension API credentials or account data are shared between panel partitions.

Run `npm run test:prices` for deterministic cache, migration, passive-fetch/XHR capture, disabled-recap pulls, durable queues, deduplication, concurrency, errors and cooldown checks, plus file sync migration, idempotent merges, concurrent pulls, permission loss, file recovery and invalid imports. Run `npm run test:extension` for actual Chromium loading in all twelve Atlas sessions, proxy/cookie/cache isolation, automatic card prices, reconnect persistence, the real Tout ouvrir UI on local pack fixtures, summary reuse in the collection, native summary capture and server cooldown. The sync integration uses real Chromium directory/file handles through the origin-private file system and restores the directory handle from IndexedDB after reload; the native operating-system folder picker still requires the user's click. All pack and API integration responses are local fixtures; no real packs are consumed.
