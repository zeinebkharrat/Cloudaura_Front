# Commerce module (Product, Cart, Order) and User / auth integration

## Stack overview

| Layer | Stack |
|--------|--------|
| Backend | Spring Boot, JPA, Spring Security (JWT + OAuth2 session for social login) |
| Frontend | Angular (standalone components), `HttpClient` + functional `authInterceptor` |

The **travel** domain (cities, restaurants, activities, public explore) lives beside a **commerce** domain (products, carts, orders). They share the same `User` entity and JWT-based API authentication.

## Domain model (JPA)

- **`User`** (`users`) — accounts from `AuthService` (local signup, OAuth). Primary key `userId` (Integer).
- **`Product`** (`products`) — `name`, `imageUrl`, `price`, `stock`, optional `user` (seller / creator).
- **`Cart`** (`carts`) — one row per user (`user_id`), `createdAt`.
- **`CartItem`** (`cart_items`) — `cart`, `product`, `quantity`.
- **`OrderEntity`** (`orders`) — `user`, `totalAmount`, `status` (`OrderStatus`).
- **`OrderItem`** (`order_items`) — `order`, `product`, `quantity`.

Checkout **decrements product stock** and **removes cart lines**; the empty `Cart` row can remain (harmless).

## Identity and security (critical integration point)

1. **JWT subject** is the **`username`** (see `JwtService.generateToken` and `CustomUserDetailsService`, which builds `UserDetails` with `user.getUsername()`). Sign-in with **email or username** still yields a token whose subject is **username**.
2. **Shop and product creation** must **not** rely on client headers (`X-Username`) for identity — that bypasses the token and broke when the frontend only sent `Authorization: Bearer …`.
3. **Controllers** `ShopController` and `ProductController` (POST create) resolve the current user via **`Authentication.getName()`**, aligned with the JWT.

### API surface

| Area | Base path | Purpose |
|------|------------|--------|
| **Shop (customer)** | `/api/shop` | `GET /cart`, `POST /cart/items`, `PUT/DELETE …/cart/items/{id}`, `POST /checkout`. Requires authenticated user; uses DTOs (`ShopCartDto`, `CheckoutOrderDto`). |
| **Product catalog** | `/api/products` | `GET` list/detail **permitted without auth** (public catalog). **Mutations** (POST/PUT/DELETE, upload image) require **`ROLE_ADMIN`** (aligned with admin UI). |
| **Legacy CRUD** | `/api/carts`, `/api/cart-items`, `/api/orders`, `/api/order-items`, `/api/crud/…` | Raw entity APIs restricted to **`ROLE_ADMIN`**. Prefer **`/api/shop`** for customer flows. |

### Frontend session

- **Canonical auth**: `src/app/auth.service.ts` — stores JWT + `UserProfile`, `restoreSession()`, `signin`, `hasRole`, etc.
- **Shop**: `src/app/core/shop.service.ts` — calls `/api/shop/*` with **no** `X-Username`; the interceptor adds **Bearer** only.
- **Guards**: `authGuard` (`auth.guard.ts`) for routes like `/panier` and `/admin`.

## End-to-end workflow

1. **Browse** — `GET /api/products` (public) on pages such as `/artisanat` (`FeaturePageComponent`).
2. **Add to cart** — User must be signed in; `ShopService.addToCart` → `POST /api/shop/cart/items`. Server loads user by JWT username, gets or creates `Cart`, merges quantities, validates stock.
3. **Cart page** — `/panier` (`CartPageComponent`), protected by `authGuard` → `GET /api/shop/cart`.
4. **Checkout** — `POST /api/shop/checkout` creates `OrderEntity` + `OrderItem` lines, updates stock, deletes `CartItem` rows.
5. **Admin** — Orders list uses `GET /api/orders` and `GET /api/order-items` (admin-only). Product management uses `/api/products` (admin-only mutations).

## Files touched for user ↔ commerce alignment

- Backend: `ShopController.java`, `ProductController.java`, `SecurityConfig.java`.
- Frontend: `app.component.ts`, `core/shop.service.ts`, `cart-page.component.ts`, `feature-page.component.ts/html`, `products-admin.component.ts`, `login/login.component.ts`, `app.routes.ts`; removed obsolete `core/auth.service.ts` and `core/auth.guard.ts`.

## Operational notes

- Backend default in `auth.service` for local dev is often `http://localhost:9091/api`; Angular proxy (`proxy.conf.json`) maps `/api` to that origin when using `ng serve`.
- After pulling changes, run backend with valid JWT secret and ensure **users** in DB match accounts used for sign-in (products and carts reference `User` by username resolution).
