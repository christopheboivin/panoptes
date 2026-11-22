# Panoptes

Bibliothèque personnelle de vinyles et CD : scan du code-barres, collection et liste d'envies.
Application web statique en JavaScript natif (modules ES) : pas de framework, pas d'étape de compilation.

Navigateur cible : **Firefox** (ordinateur et Android). Chrome fonctionne aussi ; Safari/iPhone n'est pas visé.

## Fonctionnalités

- Scan en temps réel du code-barres avec la caméra, ou à partir d'une photo. Le code lu est affiché avec le résultat de sa clé de contrôle ; MusicBrainz n'est interrogé qu'après confirmation.
- Recherche manuelle par code-barres, artiste, titre ou numéro de catalogue (ex. PGLP21, utile pour les vinyles anciens sans code-barres).
- Deux sources interrogées dans l'ordre : [MusicBrainz](https://musicbrainz.org), puis [Discogs](https://www.discogs.com) si MusicBrainz ne trouve rien (Discogs est bien plus complet pour les vinyles). La source de chaque résultat est indiquée.
- Si aucune source ne connaît le code-barres, recherche par artiste, titre ou numéro de catalogue : le code scanné est alors enregistré avec le disque choisi.
- Deux listes : **Collection** et **Envies**, avec bouton « Je l'ai » pour passer un disque de l'une à l'autre.
- Données issues de MusicBrainz et Discogs ; pochettes de [Cover Art Archive](https://coverartarchive.org) et de Discogs.
- Stockage local dans le navigateur (IndexedDB), avec **export/import JSON** pour les sauvegardes et le transfert entre appareils.

## Activer Discogs

La recherche Discogs exige un jeton personnel gratuit :

1. Se connecter à Discogs, ouvrir <https://www.discogs.com/settings/developers> et cliquer sur « Generate new token ».
2. Dans Panoptes, bouton **Réglages**, coller le jeton et enregistrer.

Le jeton est conservé dans le navigateur (localStorage) de chaque appareil. Il n'est **jamais** inclus dans l'export JSON ni dans le dépôt, et n'est envoyé qu'à Discogs (en HTTPS). Il donne accès au compte Discogs : en cas de doute, le régénérer sur la même page. Sans jeton, seul MusicBrainz est interrogé.

Sur GitHub Pages, tous les projets d'un même compte partagent l'origine `<compte>.github.io`, donc le même localStorage : n'y publier que du code de confiance, ou utiliser un domaine personnalisé.

## Lancer en local

```sh
py -m http.server 8000      # Windows (lanceur Python officiel)
python3 -m http.server 8000 # Linux / macOS
```

Sous Windows, `python` peut ouvrir le Microsoft Store au lieu de Python : c'est un raccourci du système. Utiliser `py`, ou désactiver ce raccourci dans *Paramètres > Applications > Paramètres d'applications avancés > Alias d'exécution d'application*.

Puis ouvrir <http://localhost:8000>. La caméra fonctionne sur `localhost` ; ailleurs, une adresse **HTTPS** est obligatoire (GitHub Pages convient).

Tests unitaires (Node.js 20 ou plus récent, aucune dépendance) :

```sh
npm test
```

## Publier sur GitHub Pages

1. Pousser le dépôt sur GitHub.
2. *Settings → Pages* : source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Le site est publié à l'adresse `https://<compte>.github.io/panoptes/` (le fichier `.nojekyll` évite tout traitement par Jekyll).

Le dépôt ne contient que le code. La bibliothèque reste dans le navigateur de chaque appareil : **pense à exporter régulièrement**.

## Architecture

```
index.html, css/style.css
js/
  main.js                  État de l'écran et événements (aucune logique métier)
  config.js                Réglages centralisés
  models/record.js         Forme d'un disque, validation
  models/barcode.js        Nettoyage et clé de contrôle des codes-barres
  storage/db.js            Accès IndexedDB (seul module qui le connaît)
  storage/library.js       Règles métier : ajout, statut, export/import
  storage/settings.js      Réglages de l'appareil (jeton Discogs), hors export
  providers/catalog.js     Interroge les sources dans l'ordre, s'arrête au premier résultat
  providers/musicbrainz.js Source MusicBrainz : recherche et normalisation
  providers/discogs.js     Source Discogs (jeton personnel requis)
  identify/index.js        Registre des identificateurs visuels (photo sans code-barres)
  scanner/barcode-engine.js Lecture de codes-barres (natif ou bibliothèque de secours)
  scanner/camera.js        Scan en temps réel
  ui/render.js             Génération du HTML (avec échappement)
vendor/                    Bibliothèques tierces hébergées (voir vendor/README.md)
tests/                     Tests unitaires (node --test)
```

### Points d'extension

- **Scan visuel de pochette** : créer `js/identify/cover.js` respectant le contrat décrit dans `js/identify/index.js`, puis l'ajouter à la liste `IDENTIFIERS`. Le bouton « Depuis une photo » l'utilisera automatiquement quand aucun code-barres n'est lisible.
- **Autre source de données** : créer un module dans `js/providers/` exposant `{ id, name, isConfigured, searchByBarcode, searchByText }` et renvoyant des candidats au même format, puis l'ajouter à la liste passée à `createCatalog()` dans `main.js` (l'ordre de la liste est l'ordre d'interrogation).
- **Synchronisation entre appareils** : fournir un module de stockage exposant `getAll`, `put`, `putMany` et `remove`, et le passer à `createLibrary()` dans `main.js`.

## Dépendance externe

Une seule : [barcode-detector](https://github.com/Sec-ant/barcode-detector) (MIT, basée sur ZXing), chargée uniquement si le navigateur n'a pas de lecteur de codes-barres intégré. **Firefox (navigateur cible) n'en a pas** : cette bibliothèque y est donc indispensable.

Elle est **hébergée dans le dépôt** (`vendor/`), avec le fichier WebAssembly du moteur ZXing qu'elle utilise : la page ne charge aucun script ni fichier depuis un serveur tiers, ce qui protège notamment le jeton Discogs. Versions, licences, empreintes et procédure de mise à jour : voir [`vendor/README.md`](vendor/README.md).

## Licence

Panoptes est distribué sous licence [MIT](LICENSE). Les bibliothèques de `vendor/` gardent leur propre licence (voir [`vendor/README.md`](vendor/README.md)).

## Format d'export

```json
{ "app": "panoptes", "schemaVersion": 1, "exportedAt": "…", "records": [ … ] }
```

L'import fusionne : un disque déjà présent (même identifiant) est remplacé, les autres sont ajoutés.
