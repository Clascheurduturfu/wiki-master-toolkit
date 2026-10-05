# Politique de confidentialité — Wiki Master Toolkit

Version 1.0 · Dernière mise à jour : 5 octobre 2026

Wiki Master Toolkit est un fork indépendant de WikiMastersTools-kzfamily. Cette politique décrit le fork ; les auteurs du projet d’origine ne sont pas les responsables de sa publication.

## Données nécessaires aux outils

L’extension lit les cartes et informations de WikiMasters nécessaires aux fonctions activées : identifiants et noms de cartes, raretés, images, collection et protections, ventes, prix moyens, enchères suivies, succès et statistiques de tirage. Les préférences et sauvegardes sont conservées dans le navigateur. Les prix moyens réussis n’expirent pas automatiquement ; ils peuvent être actualisés manuellement. Aucune valeur future n’est garantie.

## Session existante

Les API de WikiMasters sont appelées avec la session déjà ouverte sur le site. L’extension ne demande pas de mot de passe. Pour certaines fonctions, les en-têtes d’authentification déjà utilisés par le site sont observés et gardés temporairement en mémoire, puis réutilisés uniquement auprès de WikiMasters et de son service Supabase. Ils ne sont pas inclus dans les sauvegardes, dans les fichiers de synchronisation ou dans la base partagée Atlas.

## Synchronisation facultative et sauvegardes

La synchronisation lit et écrit les prix et compteurs de tirage dans un dossier choisi et autorisé par l’utilisateur. Les fichiers ne contiennent ni cookies, ni jetons, ni paramètres de connexion. L’extension ne contacte aucun serveur de synchronisation du fork. Si un dossier Google Drive ou un autre dossier synchronisé est choisi, le logiciel de synchronisation transmet les fichiers selon sa propre politique. La référence du dossier est mémorisée dans le navigateur et l’accès peut être désactivé.

Dans Atlas uniquement, les prix de marché réussis sont également partagés entre ses panneaux dans une base SQLite locale contenant les identifiants de cartes, horodatages et moyennes par rareté. Les sessions, collections personnelles et statistiques de tirage restent distinctes.

## Services contactés

WikiMasters et son service Supabase reçoivent les requêtes nécessaires aux cartes, prix, enchères, paquets et succès. Wikipédia, Wikidata et Wikimedia peuvent recevoir des titres publics ou requêtes publiques pour les illustrations et familles ; ces requêtes sémantiques n’incluent pas les cookies WikiMasters. Pour certaines illustrations Pokémon, une recherche publique peut également contacter PokéAPI et charger l’image renvoyée par ce service, sans transmettre les jetons WikiMasters. Un widget de vérification demandé par WikiMasters peut contacter Cloudflare Turnstile ; son jeton reste temporaire et est envoyé seulement à l’API de vérification du site. Les liens externes explicites, notamment le crédit du projet d’origine, sont ouverts lorsqu’on clique dessus.

## Actions et presse-papiers

Copier une carte écrit l’image dans le presse-papiers après un clic ; l’extension ne lit pas son contenu. Une défausse exige un aperçu et une confirmation. Placer une vente ou réclamer des récompenses exige les boutons correspondants. L’ouverture automatique est facultative. Les vérifications humaines et restrictions du site ne sont pas contournées.

## Pas de télémétrie du fork

Aucun serveur du fork ne reçoit les données de collection, les jetons ou les statistiques. L’extension ne vend pas de données, n’utilise pas d’analyse publicitaire et ne collecte pas l’historique général de navigation, les informations de paiement, la localisation précise ou les données de santé. Le navigateur et les services visités appliquent leurs propres politiques.

## Conservation et suppression

Les données restent disponibles jusqu’à leur suppression dans les outils du navigateur ou les fonctions prévues de l’extension. Désactiver la synchronisation conserve les fichiers et données existants. Un export de sauvegarde permet de préserver les prix et statistiques avant de supprimer les données du site. Les fichiers choisis et la base locale Atlas sont gérés séparément des données du navigateur.

## Contact

Pour contacter le développeur de ce fork, utiliser les coordonnées de support indiquées sur sa fiche Chrome Web Store. Le dépôt d’origine est cité dans ATTRIBUTION.md et ne constitue pas le support de cette publication indépendante.
