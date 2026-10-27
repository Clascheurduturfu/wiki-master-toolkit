# Mise à jour Chrome Web Store — 1.0.1 RC1

Élément : Wiki Master Toolkit (`hngfekfnalckbmibfghffahkfhbhbpeh`).

## Motif du correctif

L’avertissement du 27 octobre 2026 cite le chargement de code distant dans `features/pack-verification.js` : ajout d’une balise script pour l’API Turnstile. Il s’agit d’une violation Blue Argon, pas d’un ancien numéro de Manifest. Le manifeste était déjà en version 3. L’e-mail exige une version corrigée approuvée pendant la période d’avertissement de 30 jours.

## Modifications pour l’examen

- Suppression du chargeur, de la clé de site intégrée, des appels au widget Turnstile et de la transmission de jetons à `/api/human-check`.
- L’extension ne charge et n’exécute aucun code de vérification distant. Elle ne demande pas de nouvelle permission et ne relâche pas la politique de sécurité.
- Lors d’un refus explicite `human_verification_required`, le lot reste en pause. Une notification non bloquante laisse l’interface native du site accessible.
- L’utilisateur effectue la vérification dans WikiMasters puis clique sur « Vérification terminée · reprendre ». Le serveur contrôle la requête suivante et peut demander une nouvelle vérification. L’extension ne déclare pas la vérification réussie à la place du serveur.
- L’utilisateur peut arrêter le lot et conserver les résultats partiels. Les requêtes d’ouverture dont le résultat est ambigu ne sont pas rejouées automatiquement.
- Le numéro de paquet augmente de 1.0 à 1.0.1 ; le libellé visible est 1.0.1 RC1. Les clés de cache, statistiques et synchronisation ne changent pas.

## Vérification du flux

Dans une session WikiMasters connectée, ouvrir plusieurs paquets. Si le serveur demande une vérification, vérifier que le lot attend et que les contrôles du site restent accessibles. Terminer le contrôle natif (le bouton du site peut ouvrir un paquet), puis reprendre le lot depuis la notification Toolkit. Annuler doit afficher les cartes déjà obtenues. Une vérification refusée doit laisser le serveur bloquer la nouvelle ouverture.

Les tests hors ligne couvrent pause/reprise, annulation, résultats partiels, absence de chargement de scripts et absence de requête de vérification émise par ce module. Ils ne prouvent pas l’acceptation du Store ni une vérification Cloudflare réelle.

## Déclaration de code distant

Pour cette mise à jour, l’extension n’utilise plus de code hébergé à distance pour ses fonctions. Les échanges d’API sont des données et les vérifications sont exécutées par le site dans sa propre interface. Remplacer l’ancienne explication demandant une exception Turnstile dans la fiche de confidentialité du tableau de bord.

Après téléversement du nouveau ZIP, soumettre la mise à jour pour examen. Un fichier local ou une modification GitHub ne met pas à jour la version distribuée par le Store ; seul le tableau de bord peut confirmer l’envoi et l’approbation.
