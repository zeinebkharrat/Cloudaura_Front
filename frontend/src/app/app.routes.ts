import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { DestinationMapComponent } from './destination-map.component';
import { VirtualTourPageComponent } from './virtual-tour-page.component';
import { FeaturePageComponent } from './feature-page.component';
import { CommunityComponent } from './Community/community.component';
import { MyPostsComponent } from './Community/my-posts.component';
import { DigitalPassportComponent } from './Community/digital-passport.component';
import { UserProfileComponent } from './Community/user-profile.component';
import { FollowListComponent } from './Community/follow-list.component';
import { SignInComponent } from './sign-in.component';
import { SignUpComponent } from './sign-up.component';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ResetPasswordComponent } from './reset-password.component';
import { VerifyEmailComponent } from './verify-email.component';
import { EventPaymentSuccessComponent } from './event-payment-success.component';
import { EventTicketBookingComponent } from './event-ticket-booking.component';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';
import { AdminUsersComponent } from './admin-users.component';
import { AdminLayoutComponent } from './admin/layout/admin-layout.component';
import { AdminDashboardComponent } from './admin/dashboard/admin-dashboard.component';
import { EventManagementComponent } from './admin/event-management/event-management.component';
import { EventCalendarComponent } from './admin/event-calendar/event-calendar.component';
import { ProfileComponent } from './profile.component';
import { MesReservationsComponent } from './mes-reservations.component';
import { AuditLogsComponent } from './audit-logs.component';
import { AdminCitiesComponent } from './admin/cities/admin-cities.component';
import { AdminRestaurantsComponent } from './admin/restaurants/admin-restaurants.component';
import { AdminActivitiesComponent } from './admin/activities/admin-activities.component';
import { AdminActivityReservationsComponent } from './admin/activity-reservations/admin-activity-reservations.component';
import { AdminPostsComponent } from './admin/posts/admin-posts.component';
import { CityExploreComponent } from './explore/city-explore.component';
import { RestaurantDetailComponent } from './explore/restaurant-detail.component';
import { ActivityDetailComponent } from './explore/activity-detail.component';
import { ActivityPaymentSuccessComponent } from './explore/activity-payment-success.component';
import { ProductsAdminComponent } from './admin/entities/products/products-admin.component';
import { OrdersAdminComponent } from './admin/entities/orders/orders-admin.component';
import { CartPageComponent } from './shop/cart-page.component';
import { MyOrdersComponent } from './shop/my-orders.component';
import { ChatComponent } from './chat/chat.component';
import { CommunityShellComponent } from './Community/community-shell.component';
import { AdminGamesComponent } from './admin/games/admin-games.component';
import { AdminGamificationComponent } from './admin/gamification/admin-gamification.component';
import { AdminTicketsComponent } from './admin/tickets/admin-tickets.component';
import { AdminProfileComponent } from './admin/profile/admin-profile.component';
import { UserGamesComponent } from './games/user-games.component';
import { QuizPlayerComponent } from './games/quiz-player.component';
import { CrosswordPlayerComponent } from './games/crossword-player.component';
import { PuzzlePlayerComponent } from './games/puzzle-player.component';
import { LudoPlayerComponent } from './games/ludo-player.component';
import { GovernorateGuessPlayerComponent } from './games/governorate-guess-player.component';
import { ElJemQuestPlayerComponent } from './games/el-jem-quest-player.component';
import { ChefQuestPlayerComponent } from './games/chef-quest-player.component';
import { ChkobbaPlayerComponent } from './games/chkobba-player.component';
import { TunisianMusicPlayerComponent } from './games/tunisian-music-player.component';
import { ServicesRestaurantsComponent } from './explore/services-restaurants.component';
import { ServicesActivitiesComponent } from './explore/services-activities.component';
import { ArtisanOrdersComponent } from './artisan/artisan-orders.component';
import { FavoritesComponent } from './shop/favorites.component';
import { SettingsComponent } from './settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'destination-map', component: DestinationMapComponent },
  {
    path: 'planifier-voyage',
    loadComponent: () =>
      import('./trip-planning-wizard/trip-planning-wizard.component').then((m) => m.TripPlanningWizardComponent),
  },
  { path: 'login', component: SignInComponent },
  { path: 'signin', component: SignInComponent },
  { path: 'signup', component: SignUpComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'success', component: EventPaymentSuccessComponent },
  { path: 'evenements/reservation/:eventId', component: EventTicketBookingComponent, canActivate: [authGuard] },
  { path: 'city/:cityId', component: CityExploreComponent },
  { path: 'services/restaurants', component: ServicesRestaurantsComponent },
  { path: 'services/activities', component: ServicesActivitiesComponent },
  { path: 'restaurants/:restaurantId', component: RestaurantDetailComponent },
  { path: 'activities/payment-success', component: ActivityPaymentSuccessComponent },
  { path: 'activities/:activityId', component: ActivityDetailComponent },
  { path: 'panier', component: CartPageComponent, canActivate: [authGuard] },
  { path: 'mes-commandes', component: MyOrdersComponent, canActivate: [authGuard] },
  { path: 'mes-ordres', component: ArtisanOrdersComponent, canActivate: [authGuard], data: { roles: ['ROLE_ARTISAN', 'ROLE_ADMIN'], title: 'My orders (sales)' } },
  { path: 'favoris', component: FavoritesComponent, canActivate: [authGuard] },

  { path: 'virtual-tour', component: VirtualTourPageComponent },
  { path: 'jeux', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: UserGamesComponent },
  { path: 'games/quiz/:id', component: QuizPlayerComponent, canActivate: [authGuard] },
  { path: 'games/crossword/:id', component: CrosswordPlayerComponent, canActivate: [authGuard] },
  { path: 'games/puzzle/:id', component: PuzzlePlayerComponent, canActivate: [authGuard] },
  { path: 'games/ludo', component: LudoPlayerComponent, canActivate: [authGuard] },
  { path: 'games/governorate-guess', component: GovernorateGuessPlayerComponent, canActivate: [authGuard] },
  { path: 'games/el-jem-quest', component: ElJemQuestPlayerComponent, canActivate: [authGuard] },
  { path: 'games/chef-quest', component: ChefQuestPlayerComponent, canActivate: [authGuard] },
  { path: 'games/chkobba', component: ChkobbaPlayerComponent, canActivate: [authGuard] },
  { path: 'games/music', component: TunisianMusicPlayerComponent, canActivate: [authGuard] },
  {
    path: 'hebergement',
    loadChildren: () =>
      import('./features/hebergement/hebergement.routes').then((m) => m.HEBERGEMENT_ROUTES),
  },
  {
    path: 'transport',
    loadChildren: () => import('./features/transport/transport.module').then(m => m.TransportModule),
  },
  {
    path: 'flights/international',
    loadComponent: () =>
      import('./flights/international/international-flights.component').then(
        (m) => m.InternationalFlightsComponent,
      ),
  },
  {
    path: 'confirmation',
    loadComponent: () =>
      import('./shared/components/booking-confirmation/booking-confirmation.component').then(
        (m) => m.BookingConfirmationComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMIN'] },
    component: AdminLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'games', component: AdminGamesComponent },
      { path: 'gamification', component: AdminGamificationComponent },
      { path: 'events', component: EventManagementComponent },
      { path: 'events/dashboard', component: EventManagementComponent },
      { path: 'events/calendar', component: EventCalendarComponent },
      { path: 'tickets', component: AdminTicketsComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'cities', component: AdminCitiesComponent },
      { path: 'restaurants', component: AdminRestaurantsComponent },
      { path: 'activities', component: AdminActivitiesComponent },
      { path: 'posts', component: AdminPostsComponent },
      { path: 'orders', component: OrdersAdminComponent },
      { path: 'products', component: ProductsAdminComponent },
      { path: 'profile', component: AdminProfileComponent },
      { path: 'activity-reservations', component: AdminActivityReservationsComponent },
      {
        path: 'accommodations',
        loadComponent: () =>
          import('./admin/entities/accommodations/accommodations-admin.component').then(
            (m) => m.AccommodationsAdminComponent,
          ),
      },
      { path: 'hebergements', redirectTo: 'accommodations', pathMatch: 'full' },
      {
        path: 'transports',
        loadComponent: () =>
          import('./admin/entities/transports/transports-admin.component').then(
            (m) => m.TransportsAdminComponent,
          ),
      },
      { path: 'crafts', redirectTo: 'products', pathMatch: 'full' },
      { path: 'settings', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'digital-passport', component: DigitalPassportComponent, canActivate: [authGuard] },
  {
    path: 'mes-reservations',
    component: MesReservationsComponent,
    canActivate: [authGuard],
  },
  { path: 'my-bookings', redirectTo: 'mes-reservations', pathMatch: 'full' },
  {
    path: 'destinations',
    component: FeaturePageComponent,
    data: {
      i18n: 'DESTINATIONS',
      accent: 'blue',
      blocks: [
        {
          icon: '🏙️',
          title: 'Tunisian city guides',
          items: [
            'City database with descriptions, photos, and practical tips.',
            'Structured pages to help travellers (access, climate, ideal length of stay).',
          ],
        },
        {
          icon: '🗺️',
          title: 'Things to do by city',
          items: [
            'Lists by destination: monuments, cultural sites, nature, sports, and adventure.',
            'Links to bookings and cross-cutting recommendations.',
          ],
        },
        {
          icon: '🍽️',
          title: 'Recommended restaurants',
          items: [
            'Curated tables with local specialties, price ranges, and atmosphere.',
            'Reviews, ratings, and filters (vegetarian, family-friendly, sea view…).',
          ],
        },
        {
          icon: '🏷️',
          title: 'Deals & perks',
          items: [
            'Seasonal promotions and packages by city.',
            'Partner discounts and alerts for signed-in travellers.',
          ],
        },
      ],
    },
  },
  /** Pages marketing (évite le conflit avec les routes lazy `/transport` et `/hebergement`) */
  {
    path: 'presentation-transport',
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
    path: 'presentation-hebergement',
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
      i18n: 'ACTIVITES',
      accent: 'emerald',
      blocks: [
        {
          icon: '🎭',
          title: 'Activity catalogue',
          items: [
            'Activities by region, theme, and difficulty.',
            'Time slots, availability, and group options.',
          ],
        },
        {
          icon: '✅',
          title: 'Quality & trust',
          items: [
            'Traveller reviews, favourites, and personal lists.',
            'Integration with destinations, crafts, and events.',
          ],
        },
      ],
    },
  },

  {
    path: 'evenements',
    component: FeaturePageComponent,
    data: {
      i18n: 'EVENEMENTS',
      accent: 'rose',
      title: 'Events',
      eventFeed: true,
      description: "Experience Tunisia's heartbeat with YallaTN+.\nDiscover authentic festivals, sports, and tech events.",
     },
  },
  {
    path: 'artisanat',
    component: FeaturePageComponent,
    data: {
      i18n: 'ARTISANAT',
      accent: 'sand',
      catalog: 'products',
      description:
        'Spotlight artisans and their work: digital storefront, checkout with secure Stripe payment, and positive impact on the local economy.',
    },
  },
  {
    path: 'recommandations',
    component: FeaturePageComponent,
    data: {
      i18n: 'RECOMMANDATIONS',
      accent: 'blue',
      blocks: [
        {
          icon: '🤖',
          title: 'Suggestion engine',
          items: [
            'Business rules first, then gradual enrichment (ML possible).',
            'Combines quizzes, favourites, history, and trends.',
          ],
        },
        {
          icon: '🔐',
          title: 'Trust & transparency',
          items: [
            'Explanation of recommendation criteria (opt-in).',
            'GDPR alignment and user preferences.',
          ],
        },
      ],
    },
  },
  {
    path: 'chat',
    redirectTo: 'communaute/chat',
    pathMatch: 'full',
  },
  {
    path: 'communaute/digital-passport',
    redirectTo: 'digital-passport',
    pathMatch: 'full',
  },
  {
    path: 'communaute',
    component: CommunityShellComponent,
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
    children: [
      {
        path: '',
        component: CommunityComponent,
      },
      {
        path: 'saved',
        component: CommunityComponent,
        canActivate: [authGuard],
        data: { savedOnly: true },
      },
      {
        path: 'my-posts',
        component: MyPostsComponent,
        canActivate: [authGuard],
      },
      {
        path: 'chat',
        component: ChatComponent,
        canActivate: [authGuard],
      },
      {
        path: 'user/:userId',
        component: UserProfileComponent,
      },
      {
        path: 'user/:userId/follows',
        component: FollowListComponent,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
