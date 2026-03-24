# 🇹🇳 YallaTN+

Plateforme touristique **front-end** pour découvrir la Tunisie : carte interactive des gouvernorats, pages thématiques (destinations, transport, hébergement, artisanat, etc.) et **visite virtuelle 360°** (Pannellum). Interface sombre, composants **Angular** standalone et routage avec ancres pour la navigation fluide.

---

## ✨ Aperçu

| | |
| :--- | :--- |
| 🎯 **Objectif** | Offrir une vitrine immersive et modulaire pour le tourisme tunisien, prête à être branchée sur des API (réservations, données temps réel, comptes utilisateurs). |
| 🧩 **Périmètre** | Application **SPA** côté client : pas de backend dans ce dépôt. |
| 🗺️ **Carte** | Carte **ECharts** des 24 gouvernorats, labels et interactions (sélection de région). |
| 🌐 **360°** | Panoramas (ex. Tabarka, Tozeur) via **Pannellum**, avec paramètres de vue et crédits médias. |

---

## 🛠️ Stack technique

| Technologie | Rôle |
| :--- | :--- |
| ![Angular](https://img.shields.io/badge/Angular-18-DD0031?style=flat&logo=angular&logoColor=white) | Framework UI, composants standalone, router |
| ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat&logo=typescript&logoColor=white) | Langage typé |
| ![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=flat&logo=reactivex&logoColor=white) | Flux asynchrones |
| **ECharts** `^5.6` | Visualisation de la carte de la Tunisie |
| **Pannellum** `^2.5` | Lecteur de panoramas 360° |
| **CSS** (variables, glassmorphism) | Thème sombre, animations légères |

> Les badges ci-dessus reflètent les versions indiquées dans `package.json` au moment de la rédaction.

---

## 📂 Fonctionnalités principales

### 🏠 Page d’accueil (`/`)
- Hero avec visuels (ex. Sidi Bou Said), bandeau manifeste.
- **Hub** : accès rapide aux modules non présents dans la barre de navigation (quiz, événements, recommandations, communauté).
- Section **destinations** immersive (cartes 3D / isométriques).
- **Carte interactive** : modes de vue, panneau d’info par gouvernorat.
- Section **Notre histoire** (`#story`).

### 🧭 Navigation
- Liens persistants : Accueil, Destinations, Transports, Hébergement, Activités, Artisanat, **360° Tour**, Notre histoire, Connexion (UI).
- Pages **feature** dynamiques selon la route (`FeaturePageComponent` + `data` : titres, blocs, accent couleur).

### 📄 Pages thématiques (exemples de routes)
| Route | Thème |
| :--- | :--- |
| `/destinations` | Villes, parcours, offres |
| `/transport` | Mobilité, itinéraires |
| `/hebergement` | Séjours, hébergements |
| `/activites` | Expériences |
| `/quiz` | Jeux / culture |
| `/evenements` | Agenda |
| `/artisanat` | Savoir-faire local |
| `/recommandations` | Suggestions personnalisées |
| `/communaute` | Échanges voyageurs |
| `/virtual-tour` | Visite 360° Pannellum |

### 🗺️ Données carte
- GeoJSON / logique dans `tunisia-map.ts`, libellés dans `tunisia-governorate-labels.ts` (cohérence des régions et des noms affichés).

---

## 🚀 Démarrage rapide

### Prérequis
- **Node.js** (LTS recommandé)
- **npm** (fourni avec Node)

### Installation des dépendances
```bash
npm install
```

### Serveur de développement
```bash
npm start
# ou
ng serve
```
Puis ouvrir **http://localhost:4200/** — rechargement automatique à la sauvegarde des fichiers.

### Build de production
```bash
npm run build
# sortie : dist/yallatn/
```

### Tests unitaires
```bash
npm test
# ou : ng test
```
*(Karma + Jasmine — navigateur requis pour l’exécution interactive.)*

---

## 📁 Arborescence utile (extrait)

```
src/app/
├── app.component.*          # Shell : nav, outlet, footer
├── app.routes.ts            # Routes + metadata des pages feature
├── home.component.*         # Accueil (hero, hub, carte, story)
├── feature-page.component.* # Template des pages thématiques
├── virtual-tour*.ts/html/css # Intégration Pannellum
├── tunisia-map.ts           # Carte ECharts
└── tunisia-governorate-labels.ts
```

---

## 🎨 Design & UX
- Thème **dark** avec panneaux type verre (`glass-panel`), dégradés et touches de rouge **tunisien**.
- **Router** avec `withInMemoryScrolling` pour un défilement correct vers les fragments (`#story`, `#hub`, etc.).
- Pages feature : héros, grille de blocs, accents de couleur par section (`data.accent`).

---

## 📜 Licence & crédits
- Projet **privé** (`"private": true` dans `package.json`).
- Panoramas 360° : sources externes (ex. Wikimedia) — crédits indiqués dans l’interface où applicable.
- Généré initialement avec **Angular CLI** 18.x.

---

## 🔗 Ressources
- [Documentation Angular](https://angular.dev)
- [ECharts](https://echarts.apache.org/)
- [Pannellum](https://pannellum.org/)

---

*YallaTN+ — La Tunisie en une plateforme.*
