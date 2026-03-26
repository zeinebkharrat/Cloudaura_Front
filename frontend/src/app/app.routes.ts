import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { VirtualTourPageComponent } from './virtual-tour-page.component';
import { FeaturePageComponent } from './feature-page.component';
import { LoginComponent } from './login/login.component';
import { AdminLayoutComponent } from './admin/layout/admin-layout.component';
import { AdminDashboardComponent } from './admin/dashboard/admin-dashboard.component';
import { AdminGamesComponent } from './admin/games/admin-games.component';
import { UserGamesComponent } from './games/user-games.component';
import { QuizPlayerComponent } from './games/quiz-player.component';
import { CrosswordPlayerComponent } from './games/crossword-player.component';
import { PuzzlePlayerComponent } from './games/puzzle-player.component';
import { LudoPlayerComponent } from './games/ludo-player.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'virtual-tour', component: VirtualTourPageComponent },
  { path: 'jeux', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: UserGamesComponent },
  { path: 'games/quiz/:id', component: QuizPlayerComponent },
  { path: 'games/crossword/:id', component: CrosswordPlayerComponent },
  { path: 'games/puzzle/:id', component: PuzzlePlayerComponent },
  { path: 'games/ludo', component: LudoPlayerComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    data: { requiresAdmin: true },
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'games', component: AdminGamesComponent },
    ],
  },
  {
    path: 'destinations',
    component: FeaturePageComponent,
    data: {
      kicker: 'Villes & parcours',
      accent: 'blue',
      title: 'Destinations & villes',
      description:
        'Pilier central pour explorer la Tunisie au niveau des villes : contenus riches, idées de séjour et offres locales pour préparer chaque voyage.',
      blocks: [
        {
          icon: '🏙️',
          title: 'Gestion des villes tunisiennes',
          items: [
            'Base de données des villes avec descriptions, photos et conseils pratiques.',
            'Fiches structurées pour orienter les voyageurs (accès, climat, durée idéale).',
          ],
        },
        {
          icon: '🗺️',
          title: 'Activités touristiques par ville',
          items: [
            'Listes par destination : monuments, sites culturels, parcs naturels, activités sportives ou d’aventure.',
            'Liens vers réservations et recommandations croisées.',
          ],
        },
        {
          icon: '🍽️',
          title: 'Restaurants recommandés',
          items: [
            'Sélection de tables avec spécialités locales, fourchettes de prix et ambiance.',
            'Avis, notes et filtres (végétarien, familial, vue mer…).',
          ],
        },
        {
          icon: '🏷️',
          title: 'Offres & bons plans',
          items: [
            'Promotions et packages saisonniers par ville.',
            'Réductions partenaires et alertes pour les voyageurs inscrits.',
          ],
        },
      ],
    },
  },
  {
    path: 'transport',
    component: FeaturePageComponent,
    data: {
      kicker: 'Mobilité',
      accent: 'coral',
      title: 'Transport & mobilité',
      description:
        'Planifier, suivre et optimiser les déplacements : trajets clairs, informations à jour et suggestions adaptées au profil du voyageur.',
      blocks: [
        {
          icon: '🧭',
          title: 'Itinéraires & horaires',
          items: [
            'Planification de trajets avec routes et horaires fiables.',
            'Optimisation des correspondances et alternatives (durée, coût, confort).',
          ],
        },
        {
          icon: '📍',
          title: 'Suivi de trajet',
          items: [
            'Suivi en temps réel du déplacement pour une meilleure gestion du voyage.',
            'Notifications et rappels sur les étapes clés.',
          ],
        },
        {
          icon: '🎯',
          title: 'Recommandations transport',
          items: [
            'Suggestions personnalisées selon préférences, historique et contraintes (budget, accessibilité).',
            'Cohérence avec hébergements et activités réservées.',
          ],
        },
      ],
    },
  },
  {
    path: 'hebergement',
    component: FeaturePageComponent,
    data: {
      kicker: 'Séjour',
      accent: 'gold',
      title: 'Hébergement',
      description:
        'Un catalogue complet des lieux où se poser — de l’hôtel à la maison d’hôtes — avec disponibilité, avis et suggestions sur mesure.',
      blocks: [
        {
          icon: '🛏️',
          title: 'Hôtels & maisons d’hôtes',
          items: [
            'Liste des hébergements avec descriptions, photos, équipements et services.',
            'Typologies variées (hôtel, guesthouse, maison d’hôte, autre).',
          ],
        },
        {
          icon: '📅',
          title: 'Disponibilité en temps réel',
          items: [
            'Affichage des disponibilités transport & hébergement pour une réservation instantanée (évolution).',
            'Synchronisation des flux de réservation (front préparé).',
          ],
        },
        {
          icon: '⭐',
          title: 'Avis & réputation',
          items: [
            'Notes et commentaires détaillés pour guider les voyageurs.',
            'Modération et signalement pour garder des avis utiles.',
          ],
        },
        {
          icon: '✨',
          title: 'Recommandations hébergement',
          items: [
            'Suggestions de logement selon préférences, historique et séjour en cours.',
            'Alignement avec transports et activités choisies.',
          ],
        },
      ],
    },
  },
  {
    path: 'activites',
    component: FeaturePageComponent,
    data: {
      kicker: 'Expériences',
      accent: 'emerald',
      title: 'Activités',
      description:
        'Découvrir et réserver des expériences : culture, nature, sport et rencontres — au croisement des destinations et des recommandations.',
      blocks: [
        {
          icon: '🎭',
          title: 'Catalogue d’activités',
          items: [
            'Activités par région, thème et niveau de difficulté.',
            'Créneaux, disponibilité et options de groupe.',
          ],
        },
        {
          icon: '✅',
          title: 'Qualité & confiance',
          items: [
            'Avis voyageurs, favoris et listes personnalisées.',
            'Intégration avec destinations, artisanat et événements.',
          ],
        },
      ],
    },
  },

  {
    path: 'evenements',
    component: FeaturePageComponent,
    data: {
      kicker: 'Agenda',
      accent: 'rose',
      title: 'Événements',
      description:
        'Un calendrier vivant : festivals, célébrations, sport, tech et nature — pour participer et partager des moments forts.',
      blocks: [
        {
          icon: '🎉',
          title: 'Festivals & célébrations',
          items: [
            'Listes et calendriers des événements culturels, historiques et religieux.',
            'Informations pratiques et lieux.',
          ],
        },
        {
          icon: '🏃',
          title: 'Sport & innovation',
          items: [
            'Hackathons, marathons, randonnées et événements outdoor.',
            'Encourager la participation et la visibilité des organisateurs.',
          ],
        },
        {
          icon: '📆',
          title: 'Calendrier interactif',
          items: [
            'Vue calendrier avec filtres et recherche.',
            'Filtres par thème, région et date.',
          ],
        },
        {
          icon: '🎫',
          title: 'Participation & suivi',
          items: [
            'Inscriptions, présence et partage d’expériences post-événement.',
            'Rappels et ajout au carnet de voyage.',
          ],
        },
      ],
    },
  },
  {
    path: 'artisanat',
    component: FeaturePageComponent,
    data: {
      kicker: 'Patrimoine vivant',
      accent: 'sand',
      title: 'Artisanat & souvenirs',
      description:
        'Mettre en avant les artisans et leurs créations : vitrine numérique, parcours d’achat et impact positif sur l’économie locale.',
      blocks: [
        {
          icon: '👤',
          title: 'Artisans tunisiens',
          items: [
            'Profils avec spécialités, localisation et moyens de contact.',
            'Histoire de l’atelier et savoir-faire.',
          ],
        },
        {
          icon: '🛒',
          title: 'Catalogue & souvenirs',
          items: [
            'Vitrine de produits faits main, crafts et souvenirs.',
            'Parcours d’achat et tunnel e-commerce (front préparé, paiement sécurisé à venir).',
          ],
        },
        {
          icon: '🌿',
          title: 'Promotion & impact',
          items: [
            'Mise en avant des produits uniques et circuits courts.',
            'Soutien à l’entrepreneuriat local et au tourisme durable.',
          ],
        },
      ],
    },
  },
  {
    path: 'recommandations',
    component: FeaturePageComponent,
    data: {
      kicker: 'Intelligence',
      accent: 'blue',
      title: 'Recommandations',
      description:
        'Un moteur de suggestions cohérent : transports, hébergements, activités et achats — transparent, respectueux de la vie privée et personnalisable.',
      blocks: [
        {
          icon: '🤖',
          title: 'Moteur de suggestion',
          items: [
            'Règles métier puis enrichissement progressif (ML possible).',
            'Croisement quiz, favoris, historique et tendances.',
          ],
        },
        {
          icon: '🔐',
          title: 'Confiance & transparence',
          items: [
            'Explication des critères de recommandation (opt-in).',
            'Respect du RGPD et préférences utilisateur.',
          ],
        },
      ],
    },
  },
  {
    path: 'communaute',
    component: FeaturePageComponent,
    data: {
      kicker: 'Voyageurs',
      accent: 'violet',
      title: 'Communauté',
      description:
        'Relier voyageurs, artisans et équipes : échanges, avis et récits — avec des espaces modérés pour une discussion de qualité.',
      blocks: [
        {
          icon: '💬',
          title: 'Chat temps réel',
          items: [
            'Messagerie privée et groupes thématiques.',
            'Canaux pour questions rapides et entraide.',
          ],
        },
        {
          icon: '📣',
          title: 'Forums & avis',
          items: [
            'Forums thématiques : conseils, itinéraires, bons plans.',
            'Commentaires et notes sur activités, événements, restaurants et produits.',
          ],
        },
        {
          icon: '📔',
          title: 'Partage d’expériences',
          items: [
            'Carnets de voyage, photos et récits inspirants.',
            'Modération pour garder un ton respectueux et utile.',
          ],
        },
      ],
    },
  },
];
