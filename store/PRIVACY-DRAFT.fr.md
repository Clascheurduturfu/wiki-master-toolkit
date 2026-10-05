# Champs de confidentialité — brouillon

## Finalité unique

Améliorer la gestion des cartes et de la collection sur WikiMasters : affichage des moyennes de vente, outils de collection, paquets, enchères, succès et sauvegardes locales.

## Justification des autorisations

clipboardWrite : permet de copier une carte ou un aperçu de tirage sous forme d’image, uniquement après un clic sur le bouton de copie.

https://www.wiki-masters.com/* : permet d’ajouter les outils sur les pages WikiMasters, de lire les cartes affichées et d’appeler les API du site avec la session existante.

https://www.wikidata.org/* et https://query.wikidata.org/* : permettent de récupérer des données publiques pour les familles de cartes et l’enrichissement sémantique, sans cookies de connexion.

https://fr.wikipedia.org/* : permet de rechercher les informations et illustrations publiques manquantes des cartes, sans cookies de connexion.

## Données utilisées

Contenu de sites Web : cartes, images, métadonnées, collection, ventes, moyennes de prix, récompenses et compteurs nécessaires aux outils WikiMasters. Les sauvegardes restent dans le navigateur ou dans le dossier choisi.

Informations d’authentification : la session du site est réutilisée pour ses API. Certains jetons déjà fournis par WikiMasters sont observés et conservés temporairement en mémoire pour les requêtes du même site et de son service Supabase. Aucun mot de passe n’est demandé ou enregistré par l’extension ; ces jetons ne sont pas inclus dans les sauvegardes et ne sont pas envoyés à un serveur du fork.

Pas de collecte générale de l’historique de navigation, d’adresses e-mail, d’informations de paiement, de localisation précise ou de données de santé par l’extension. Pas d’analyse publicitaire, de vente de données ou de serveur de télémétrie du fork. Aucun identifiant d’un compte réel n’est fourni dans ce dossier de publication.

## Code distant : état actuel à déclarer

Oui : chargement facultatif du script officiel https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit, uniquement lorsque WikiMasters refuse une ouverture avec human_verification_required. Le module features/pack-verification.js est fourni dans le paquet et exécuté dans le contexte MAIN de la page WikiMasters, sans accès direct aux API privilégiées de l’extension. Il affiche la vérification à effectuer par l’utilisateur et transmet seulement le jeton temporaire à l’API native /api/human-check de WikiMasters. Aucun contournement de CAPTCHA ni code fonctionnel du toolkit téléchargé à distance. Le pont vers le contexte extension se limite aux requêtes publiques sur une liste d’hôtes et à l’écriture du presse-papiers. Nous déclarons ce chargement et demandons son évaluation au titre de l’exception pour les contextes isolés des API d’extension ; l’applicabilité de cette exception n’est pas présumée acquise. Règle : https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements

## Politique de confidentialité

Politique publique du fork : https://github.com/Clascheurduturfu/wiki-master-toolkit/blob/codex/wiki-master-toolkit-1.0/PRIVACY.md . La même politique est fournie dans privacy-policy.html. Ne pas utiliser la politique de l’auteur d’origine comme si elle était celle du nouveau développeur.

## Instructions de test proposées

Installer l’extension seule, sans l’ancienne version, puis ouvrir WikiMasters et se connecter avec son propre compte de test. Dans Collection, vérifier le chargement des moyennes, ouvrir Plus chères, puis Discard sans confirmer de défausse. Ouvrir Mes enchères et Succès ; les lectures n’engagent pas de mise et ne réclament pas de récompense sans clic. Le son de notification attend une interaction réelle dans la page. Les opérations qui modifient les cartes, enchères ou récompenses nécessitent les contrôles prévus. Aucun compte privé de l’utilisateur n’est fourni aux examinateurs.
