# Wiki Master Toolkit · v1.0

Fork indépendant de WikiMastersTools-kzfamily, avec les adaptations Atlas et le correctif des notifications audio. Les prix et statistiques existants sont conservés. Voir [ATTRIBUTION.md](ATTRIBUTION.md), [PRIVACY.md](PRIVACY.md) et le dossier `../releases/wiki-master-toolkit-1.0/` pour le brouillon de publication.

La documentation d’origine ci-dessous est conservée pour attribution. Les anciens noms et numéros décrivent les versions précédentes.

PATCH NOTE EN BAS

> This folder is the local **Atlas v4.30.0** adaptation of the installed v4.27.7 extension. See [ATLAS-FORK.md](ATLAS-FORK.md) for permanent caching, automatic new-card pricing, local folder sync on Windows/Mac, migration and verification, and [DISCARD.md](DISCARD.md) for discard by price across all collection pages. See [ACTIVITY.md](ACTIVITY.md) for auctions, saved watch links, achievement discovery/claim-all and the interface rebuild. See [SHARED-PRICES.md](SHARED-PRICES.md) for the local twelve-panel database and mid-batch verification pause/resume in v4.30.0. The upstream documentation below is preserved for attribution and describes the original release.

[Chrome Web Store](https://chromewebstore.google.com/detail/wikimasters-prix-moyen-co/pkcnhclbagpfmlmolfcgedcmbccffgci)

[firefox addons](https://addons.mozilla.org/en-US/firefox/addon/wikimasters-tools-prix-moyen/)
merci à rodrigorod pour le port firefox

# WikiMastersTools-kzfamily

Add-on créé par la kzfamily.

**100% vibecodé**

## Installation (Chrome / Chromium / Opera / Brave)

1. Télécharger ou cloner le dépôt :

```bash
git clone https://github.com/qkerman/WikiMastersTools-kzfamily.git
```

Ou télécharger en haut à droite "code" > telecharger le zip

2. Ouvrir `chrome://extensions/` dans Chrome / Chromium.
3. Activer **Mode développeur**.
4. Cliquer sur **Charger l’extension non empaquetée**.
5. Sélectionner le dossier `WikiMastersTools-kzfamily` (dézippé) qui contient `manifest.json`.
6. Refresh WikiMasters.

## Installation (Firefox)

1. Ouvrir Firefox et aller sur `about:debugging#/runtime/this-firefox`.
2. Cliquer sur **Charger un module temporaire...** (Load Temporary Add-on...).
3. Sélectionner le fichier [manifest.json](manifest.json) situé dans le dossier de l'extension.
4. Rafraîchir WikiMasters (F5).

> Pour empaqueter l'extension pour Firefox (AMO ou distribution) :  
> `npx web-ext build` (le fichier zip sera généré dans `web-ext-artifacts/`).

## Mise à jour

```bash
cd ~/Downloads/WikiMastersTools-kzfamily
git pull
```

Ou retélécharger manuellement et remplacer le dossier.

Puis cliquer sur **Recharger** dans `chrome://extensions/` et faire un F5 sur WikiMasters.

## Patch note

*Heure de Paris*

- **30/09/2026** — Ajout de la page « Familles ».
- **28/09/2026** — Nouveaux outils pour les cartes, les échanges et les notifications, avec davantage de réglages pour les paquets.
- **27/09/2026** — Mise à jour du style et des performances des cartes.
- **25/09/2026** — Ajout des paramètres et amélioration des cartes sans image.
- **24/09/2026** — Ajout de l’ouverture automatique et du récapitulatif des paquets.
- **23/09/2026** — Extension disponible sur Firefox, Brave et Opera.
- **21/09/2026** — Ajout des outils de vente, de classement et d’estimation des échanges.
- **18/09/2026** — Ajout des prix moyens dans la collection, les paquets et le Marketplace.
