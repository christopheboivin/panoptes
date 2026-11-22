# Notes de reprise — Panoptes

Fichier de passation entre conversations avec Claude. À relire en premier pour reprendre le projet.
Dernière mise à jour : 22 novembre 2026.

## Objectif

Application web personnelle pour cataloguer une collection de vinyles et CD : scan, bibliothèque
(« Collection ») et liste de disques souhaités (« Envies »). Logiciel libre autant que possible.

## Décisions prises

- **Navigateur cible : Firefox** (ordinateur et Android). Chrome doit fonctionner ; Safari/iPhone non visé.
- **Code simple et maintenable** : JavaScript natif en modules ES, sans framework ni compilation,
  bonnes pratiques, pas de prototype jetable. Architecture extensible (voir README).
- **Stockage local** dans le navigateur (IndexedDB) + **export/import JSON** (format versionné, fusion par identifiant).
  Synchronisation entre appareils (serveur type PocketBase) envisagée plus tard, via un autre module de stockage.
- **Scan en temps réel** par la caméra, et bouton « Depuis une photo ».
- **Confirmation avant recherche** : le code lu s'affiche avec le contrôle de sa clé ; MusicBrainz n'est interrogé qu'après validation.
- **Hébergement prévu : GitHub Pages** (HTTPS nécessaire pour la caméra). Le dépôt ne contient que le code, jamais la bibliothèque.

## État actuel (v0.2.0)

- Fonctionnel et testé contre le vrai MusicBrainz : recherche par code-barres (formes UPC-A et EAN-13),
  par artiste/titre, ajout en Collection ou Envies, bouton « Je l'ai », export/import.
- Relance automatique sur les refus temporaires de MusicBrainz (erreur 503, limite de débit ~1 requête/s).
- Si un code-barres est inconnu, l'appli propose la recherche par artiste/titre/n° de catalogue
  et enregistre le code scanné avec le disque choisi.
- **v0.2.0** : Discogs en seconde source (interrogé seulement si MusicBrainz ne trouve rien, via `providers/catalog.js`),
  recherche par numéro de catalogue (MusicBrainz `catno:` et Discogs), fenêtre « Réglages » pour le jeton Discogs,
  source affichée sous chaque résultat.
- **Discogs testé et validé dans Firefox** par l'utilisateur (22 novembre 2026) : code-barres et n° de catalogue.
- barcode-detector 2.2.5 et son fichier zxing_reader.wasm (zxing-wasm 1.2.7) sont **hébergés dans `vendor/`** :
  plus aucun appel à jsDelivr. Chargement du .wasm vérifié sous Node ; reste à tester un scan dans Firefox.
- 30 tests unitaires (`npm test`, Node.js, aucune dépendance).
- **Non testé** : le scan caméra et « Depuis une photo » sous Firefox avec la copie hébergée.

## Jeton Discogs (décision du 22 novembre 2026)

- Saisi dans l'appli (Réglages), stocké dans le localStorage de chaque appareil, jamais exporté ni dans le dépôt,
  envoyé uniquement à Discogs en paramètre `token` (pas d'en-tête personnalisé, donc pas de requête CORS préalable).
- C'est aussi la solution retenue pour GitHub Pages (site statique : aucun endroit où cacher un secret ;
  un serveur relais a été écarté, contraire au principe KISS).
- Précautions : héberger barcode-detector dans le dépôt **avant** la mise en ligne (plus aucun script tiers
  ne pourra lire le jeton) ; tous les projets `<compte>.github.io` partagent le même localStorage.

## Constat important

MusicBrainz connaît mal les codes-barres des vinyles récents. Exemple : Peter Gabriel, *i/o*,
code 884108013632, absent de MusicBrainz ; les éditions vinyle (PGLP21, PGLPX21) n'y ont aucun code-barres.

## Suite prévue, dans l'ordre

1. **Tester un scan dans Firefox** avec barcode-detector hébergé, et vérifier (F12, onglet Réseau)
   qu'aucune requête ne part vers jsdelivr.net.
2. Mise en ligne sur GitHub Pages : licence **MIT** retenue (fichier LICENSE ajouté). L'utilisateur fait lui-même
   les commits dans Git Bash, avec Claude en co-auteur (ligne `Co-Authored-By`). Dépôt public `panoptes`.
   Tester ensuite sur Android (Firefox) : caméra via HTTPS.
3. **OCR de la pochette** avec Tesseract.js (Apache 2.0, dans le navigateur), visant surtout le verso, la tranche
   ou le rond central pour y lire le numéro de catalogue et le label. À brancher dans `js/identify/cover.js`.

Le point 3 nécessitera de récupérer Tesseract.js via npm (accessible depuis l'espace de travail de Claude).

## Environnement et conventions

- Projet : `C:\Users\chris\code\panoptes`. Terminal : Git Bash.
- Serveur local : `python -m http.server 8000` puis <http://localhost:8000> (vérifier la commande Python disponible).
- Les droits sur le PC (notamment la suppression) se demandent pour le dossier du projet seulement, jamais pour tout `code`.
  Pour cela, connecter `panoptes` lui-même à la conversation plutôt que `code`.
- Sans autorisation de suppression, Claude ne peut pas faire de commit Git (fichiers de verrou).
- Tenir l'utilisateur informé régulièrement de l'avancement.
- **Toujours présenter le plan et attendre la confirmation de l'utilisateur avant de modifier le code.**
