# PhotoMap App - Replit.md

## Overview

PhotoMap is a mobile-first web application that lets users upload geotagged photos and see them placed on an interactive world map. Users log in via Replit Auth, upload photos (with GPS metadata auto-extracted from EXIF data or manually entered), and can organize photos into named collections (e.g., trips). The map shows photo thumbnails as custom markers with clustering for dense areas. Anyone can browse the public map, but uploading requires authentication.

**Core user flows:**
1. Land on welcome page → log in via Replit Auth
2. View the global photo map with clustered thumbnail markers
3. Upload a photo → EXIF GPS extracted client-side → pinned on map with a fly-to animation
4. Browse your profile to see your photos grouped by country
5. Click on a country card to see all photos taken in that country
6. Upload a custom profile picture by tapping the avatar circle
7. Long-press (2 seconds) on any photo in the grid to enter reorder mode, drag to rearrange, tap Done to save
8. Search for other users by name via the Search tab
9. View another user's profile and their photos/countries

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Full-Stack Structure

The repo is a monorepo with three top-level zones:
- `client/` – React SPA (Vite)
- `server/` – Express API (Node.js + TypeScript)
- `shared/` – Types, DB schema, Zod validation, and route contracts shared between client and server

This shared layer is the key architectural decision: the API contract (`shared/routes.ts`) defines route paths, HTTP methods, and Zod input/output schemas in one place, consumed by both the Express handlers and React hooks. This eliminates drift between frontend and backend types.

### Frontend

- **Framework:** React 18 with TypeScript, bundled by Vite
- **Routing:** `wouter` (lightweight client-side routing) with pages: `/` (map), `/feed` (Instagram-style photo feed), `/profile`, `/search` (user search), and `/user/:id` (other user's profile)
- **State/Data fetching:** TanStack Query (React Query) v5 — all server state is fetched and cached via custom hooks (`use-photos`, `use-collections`, `use-auth`)
- **UI components:** shadcn/ui (Radix UI primitives + Tailwind CSS). The "new-york" style variant is used. All UI components live in `client/src/components/ui/`
- **Map:** Leaflet via `react-leaflet` with `react-leaflet-cluster` for marker clustering. Custom photo-thumbnail markers are rendered as Leaflet `divIcon` elements with Apple Photos–style frames and tail pointers.
- **EXIF extraction:** `exifr` runs entirely client-side to pull GPS coordinates and date from uploaded images before sending to the server
- **Image handling:** Images are resized client-side (canvas, max 1200px, JPEG 0.82 quality) and sent as Base64 strings in the JSON body. The Express body limit is set to 15MB to accommodate this.
- **Geocoding fallback:** If an image has no EXIF GPS, the user can type a location name, which is resolved via the Nominatim (OpenStreetMap) geocoding API client-side.

### Backend

- **Framework:** Express.js with TypeScript, run via `tsx` in development
- **API structure:** RESTful routes defined in `server/routes.ts`, all paths and schemas imported from `shared/routes.ts`
- **Storage layer:** `server/storage.ts` exports a `DatabaseStorage` class implementing the `IStorage` interface. All DB access goes through this abstraction — easy to swap implementations.
- **Build:** In production, Vite builds the client to `dist/public/`, and esbuild bundles the server to `dist/index.cjs`. The build script (`script/build.ts`) allowlists specific server dependencies for bundling to reduce cold start syscalls.

### Data Storage

- **Database:** PostgreSQL via `drizzle-orm` with `node-postgres` (`pg`) driver
- **ORM:** Drizzle ORM with schema defined in `shared/schema.ts`. Drizzle-zod auto-generates Zod schemas from the table definitions.
- **Tables:**
  - `users` – Replit Auth user profiles (id, email, firstName, lastName, profileImageUrl)
  - `sessions` – PostgreSQL-backed session store for express-session (required by Replit Auth)
  - `collections` – User-created trip/album groupings (userId, name, description)
  - `photos` – Core data: userId, imageUrl (Base64 or URL), latitude, longitude, locationName, country, takenAt, collectionId
- **Migrations:** `drizzle-kit push` is used for schema pushes (no migration files needed in dev)

### Authentication

- **Provider:** Replit Auth using OpenID Connect (OIDC)
- **Library:** `openid-client` + `passport` with a custom `openid-client/passport` Strategy
- **Sessions:** `express-session` backed by PostgreSQL using `connect-pg-simple`, storing sessions in the `sessions` table
- **Flow:** `/api/login` → Replit OIDC → callback → upsert user → session cookie. The `isAuthenticated` middleware guards write endpoints.
- **Client-side:** `useAuth` hook fetches `/api/auth/user` and exposes `user`, `isAuthenticated`, `isLoading`, and `logout`. Unauthenticated users see a welcome/login page instead of restricted content.

### Route Contract Pattern

`shared/routes.ts` defines the entire API surface as a typed object:
```ts
api.photos.list = { method, path, input (Zod), responses (Zod) }
```
Both the server handlers and client hooks import from this object, so changing a path or schema is a single edit. This is the most important architectural pattern in the codebase.

---

## External Dependencies

### Infrastructure
- **PostgreSQL** – Primary database (provisioned via `DATABASE_URL` env var)
- **Replit Auth / OIDC** – Authentication provider. Requires `REPL_ID`, `ISSUER_URL` (defaults to `https://replit.com/oidc`), and `SESSION_SECRET` environment variables.

### Key npm Packages
| Package | Purpose |
|---|---|
| `drizzle-orm` + `drizzle-kit` | ORM and schema management |
| `drizzle-zod` | Auto-generate Zod schemas from Drizzle tables |
| `openid-client` + `passport` | Replit OIDC authentication |
| `connect-pg-simple` | PostgreSQL session store |
| `express-session` | Session middleware |
| `react-leaflet` + `leaflet` | Interactive map |
| `react-leaflet-cluster` | Marker clustering on the map |
| `exifr` | Client-side EXIF/GPS extraction from images |
| `@tanstack/react-query` | Server state management and caching |
| `wouter` | Lightweight client-side router |
| `shadcn/ui` + Radix UI | Accessible UI component primitives |
| `tailwindcss` | Utility-first CSS |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop reordering for photo grid |
| `vaul` | Drawer component (used for upload UI) |
| `date-fns` | Date formatting |
| `zod` | Runtime validation (shared between client and server) |
| `memoizee` | Memoize OIDC config discovery (1-hour cache) |

### External Services / APIs
- **Nominatim (OpenStreetMap)** – Free geocoding API, called client-side when user types a location name instead of relying on EXIF GPS. No API key required; uses `User-Agent` header.
- **Google Fonts** – Loaded via `<link>` in `index.html` for `DM Sans`, `Architects Daughter`, `Fira Code`, and `Geist Mono`.

### Environment Variables Required
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for signing express sessions |
| `REPL_ID` | Used by Replit OIDC as the client ID |
| `ISSUER_URL` | OIDC issuer (defaults to `https://replit.com/oidc`) |