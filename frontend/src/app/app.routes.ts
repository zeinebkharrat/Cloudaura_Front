import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { DestinationMapComponent } from './destination-map.component';
import { VirtualTourPageComponent } from './virtual-tour-page.component';
import { FeaturePageComponent } from './feature-page.component';
import { CommunityComponent } from './Community/community.component';
import { MyPostsComponent } from './Community/my-posts.component';
import { UserProfileComponent } from './Community/user-profile.component';
import { FollowListComponent } from './Community/follow-list.component';
import { SignInComponent } from './sign-in.component';
import { SignUpComponent } from './sign-up.component';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ResetPasswordComponent } from './reset-password.component';
import { VerifyEmailComponent } from './verify-email.component';
import { EventPaymentSuccessComponent } from './event-payment-success.component';
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
import { AdminGamesComponent } from './admin/games/admin-games.component';
import { AdminTicketsComponent } from './admin/tickets/admin-tickets.component';
import { UserGamesComponent } from './games/user-games.component';
import { QuizPlayerComponent } from './games/quiz-player.component';
import { CrosswordPlayerComponent } from './games/crossword-player.component';
import { PuzzlePlayerComponent } from './games/puzzle-player.component';
import { LudoPlayerComponent } from './games/ludo-player.component';
import { ServicesRestaurantsComponent } from './explore/services-restaurants.component';
import { ServicesActivitiesComponent } from './explore/services-activities.component';
import { MockPaymentComponent } from './shop/mock-payment/mock-payment.component';
import { ArtisanOrdersComponent } from './artisan/artisan-orders.component';
import { FavoritesComponent } from './shop/favorites.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'destination-map', component: DestinationMapComponent },
  { path: 'login', component: SignInComponent },
  { path: 'signin', component: SignInComponent },
  { path: 'signup', component: SignUpComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'success', component: EventPaymentSuccessComponent },
  { path: 'city/:cityId', component: CityExploreComponent },
  { path: 'services/restaurants', component: ServicesRestaurantsComponent },
  { path: 'services/activities', component: ServicesActivitiesComponent },
  { path: 'restaurants/:restaurantId', component: RestaurantDetailComponent },
  { path: 'activities/payment-success', component: ActivityPaymentSuccessComponent },
  { path: 'activities/:activityId', component: ActivityDetailComponent },
  { path: 'panier', component: CartPageComponent, canActivate: [authGuard] },
  { path: 'mes-commandes', component: MyOrdersComponent, canActivate: [authGuard] },
  { path: 'mes-ordres', component: ArtisanOrdersComponent, canActivate: [authGuard], data: { roles: ['ROLE_ARTISAN', 'ROLE_ADMIN'], title: 'My orders (sales)' } },
  { path: 'mock-payment', component: MockPaymentComponent, canActivate: [authGuard] },
  { path: 'favoris', component: FavoritesComponent, canActivate: [authGuard] },

  { path: 'virtual-tour', component: VirtualTourPageComponent },
  { path: 'jeux', redirectTo: 'games', pathMatch: 'full' },
  { path: 'games', component: UserGamesComponent },
  { path: 'games/quiz/:id', component: QuizPlayerComponent },
  { path: 'games/crossword/:id', component: CrosswordPlayerComponent },
  { path: 'games/puzzle/:id', component: PuzzlePlayerComponent },
  { path: 'games/ludo', component: LudoPlayerComponent },
  {
    path: 'hebergement',
    loadChildren: () => import('./features/hebergement/hebergement.routes')
      .then(m => m.HEBERGEMENT_ROUTES)
  },
  {
    path: 'transport',
    loadChildren: () => import('./features/transport/transport.routes')
      .then(m => m.TRANSPORT_ROUTES)
  },
  {
    path: 'confirmation',
    loadComponent: () => import('./shared/components/booking-confirmation/booking-confirmation.component')
      .then(m => m.BookingConfirmationComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMIN'] },
    component: AdminLayoutComponent,
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'events', component: EventManagementComponent },
      { path: 'events/dashboard', component: EventManagementComponent },
      { path: 'events/calendar', component: EventCalendarComponent },
      { path: 'tickets', component: AdminTicketsComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'games', component: AdminGamesComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'cities', component: AdminCitiesComponent },
      { path: 'restaurants', component: AdminRestaurantsComponent },
      { path: 'activities', component: AdminActivitiesComponent },
      { path: 'posts', component: AdminPostsComponent },
      { path: 'orders', component: OrdersAdminComponent },
      { path: 'products', component: ProductsAdminComponent },
      { path: 'activity-reservations', component: AdminActivityReservationsComponent },
      { path: 'accommodations', loadComponent: () => import('./admin/entities/accommodations/accommodations-admin.component').then(m => m.AccommodationsAdminComponent) },
      { path: 'hebergements', redirectTo: 'accommodations', pathMatch: 'full' },
      { path: 'transports', loadComponent: () => import('./admin/entities/transports/transports-admin.component').then(m => m.TransportsAdminComponent) },
    ],
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
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
      kicker: 'Cities & journeys',
      accent: 'blue',
      title: 'Destinations & cities',
      description:
        'Your hub for exploring Tunisia by city: rich content, trip ideas, and local offers to plan every journey.',
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
  {
    path: 'activites',
    component: FeaturePageComponent,
    data: {
      kicker: 'Experiences',
      accent: 'emerald',
      title: 'Activities',
      description:
        'Discover and book experiences: culture, nature, sport, and meet-ups — tied to destinations and recommendations.',
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
      kicker: 'Agenda',
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
      kicker: 'Living heritage',
      accent: 'sand',
      title: 'Crafts & souvenirs',
      catalog: 'products',
      description:
        'Spotlight artisans and their work: digital storefront, checkout with secure payment (Stripe or mock), and positive impact on the local economy.',
      blocks: [
        {
          icon: '👤',
          title: 'Tunisian artisans',
          items: [
            'Profiles with specialties, location, and contact options.',
            'Workshop story and craft know-how.',
          ],
        },
        {
          icon: '🛒',
          title: 'Catalog & souvenirs',
          items: [
            'Handmade products, crafts, and souvenirs.',
            'Checkout flow with Stripe checkout and mock payment for local testing.',
          ],
        },
        {
          icon: '🌿',
          title: 'Promotion & impact',
          items: [
            'Highlighting unique products and short supply chains.',
            'Support for local entrepreneurship and sustainable tourism.',
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
      title: 'Recommendations',
      description:
        'A consistent suggestion engine for transport, stays, activities, and shopping — transparent, privacy-aware, and customizable.',
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
    component: ChatComponent,
    canActivate: [authGuard],
  },
  {
    path: 'communaute',
    component: CommunityComponent,
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
  {
    path: 'communaute/my-posts',
    component: MyPostsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'communaute/user/:userId',
    component: UserProfileComponent,
  },
  {
    path: 'communaute/user/:userId/follows',
    component: FollowListComponent,
  },
  { path: '**', redirectTo: '' },
];
