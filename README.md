<!-- BANNER HERO -->

<div align="center">

# 🌍 SmartFare

### 🚀 Pianificazione Intelligente di Viaggi con IA Generativa

**Full-Stack Web Application** | **Angular 21** | **Express.js** | **PostgreSQL** | **Google Gemini API**

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-Private-lightgrey?style=flat-square)

**[🌐 Visita il Sito](https://smartfare.nicolas-dominici.it)** | **[📊 Demo](#demo-features)** | **[🏗️ Architettura](#architettura)**

</div>

---

## 📋 Indice

- [🎯 Panoramica](#1-panoramica-del-progetto)
- [🛠️ Stack Tecnologico](#2-stack-tecnologico)
- [🏗️ Architettura](#3-architettura-del-sistema)
- [💻 Frontend](#4-analisi-frontend)
- [⚙️ Backend](#5-analisi-backend)
- [💾 Database](#6-database)
- [🚀 Deploy](#7-deploy-e-infrastruttura)
- [🔒 Sicurezza](#8-sicurezza)
- [⚠️ Problematiche](#9-problematiche-affrontate)
- [📚 Competenze](#10-competenze-informatiche-dimostrate)
- [🎓 Collegamenti](#11-collegamenti-scolastici)
- [📖 Struttura Tesina](#12-possibile-struttura-della-tesina)
- [❓ Domande Commissione](#13-domande-possibili-della-commissione)
- [⭐ Valutazione](#14-valutazione-tecnica-del-progetto)

---

# 1. 🎯 Panoramica del Progetto

## 📱 Nome Progetto

**SmartFare** — *Smart Fare Planner*

## 💡 Scopo del Sito

<blockquote>

**SmartFare** è una **web application full-stack** per la **pianificazione intelligente di viaggi e itinerari**, con supporto **IA generativa** per suggerimenti e generazione automatica delle tappe.

</blockquote>

## 🎭 Problema che Risolve

Quando si organizza un viaggio reale, l'utente affronta diversi ostacoli:

| ❌ Problema | ✅ Soluzione SmartFare |
|---|---|
| Scelta destinazione e date frammentata | Database integrato di location con ricerca |
| Ricerca manuale attività, hotel, POI | Visualizzazione mappa interattiva + associazione automatica |
| Ordinamento tappe disorganizzato | Drag-and-drop builder + calcolo percorsi OSRM |
| Stima tempi e costi incerta | Integrazione routing + suggerimenti IA |
| Condivisione itinerario complessa | Sharing pubblico/privato con link e PDF export |

## 👥 Target Utenti

- 🧑‍🦰 **Viaggiatori individuali** che desiderano organizzazione indipendente
- 👫 **Coppie o piccoli gruppi** che pianificano insieme  
- 🎓 **Studenti e giovani** che cercano strumenti rapidi e user-friendly
- 🤖 **Power users** che sfruttano suggerimenti IA per ricchezza itinerario

## ⭐ Funzionalità Principali

- ✅ **Ricerca destinazioni** dal database con autocomplete
- ✅ **Builder visuale** con mappa interattiva e marker clustering
- ✅ **Chat IA conversazionale** per modifiche e suggerimenti real-time  
- ✅ **Generazione automatica** itinerario da prompt testuale
- ✅ **Autenticazione dual** (email/password + Google OAuth)
- ✅ **Workflow email** (verifica account, reset password con token sicuri)
- ✅ **Autosave intelligente** (localStorage per guest, backend per utenti)
- ✅ **Sharing e visibilità** (privato, pubblico, con link pubblica)
- ✅ **Upload immagini** con Cloudinary CDN
- ✅ **Export multi-formato** (JSON, HTML, PDF via browser print)

# 2. 🛠️ Stack Tecnologico

## 🎨 Frontend Stack

### Angular 21 (Standalone Components + Signals)

```
Funzione:     Costruzione SPA, routing client-side, componentizzazione UI
Motivazione:  Framework strutturato e robusto per app complesse
Vantaggi:     Modularità, lazy loading, performance discrete, ecosistema maturo
Versione:     21.1.4
```

### TypeScript

- **Funzione:** Tipizzazione statica del frontend
- **Perché:** Riduce errori a runtime, codice più manutenibile
- **Vantaggio:** Refactoring più sicuro, autocompletion IDE

### RxJS

- **Funzione:** Gestione stream asincroni HTTP, debounce ricerca
- **Perché:** Standard Angular per flussi reattivi
- **Vantaggio:** Controllo fine su eventi asincroni

### 🎯 Angular Signals

- **Funzione:** Stato locale/globale leggero (UI state, bozza itinerario, loader)
- **Innovazione:** Approccio moderno e reattivo
- **Benefit:** Meno boilerplate, reattività chiara

### 🗺️ Leaflet + MarkerCluster  

- **Funzione:** Mappa interattiva, marker, cluster, rotte
- **Scelta:** Libreria open-source estensibile
- **Uso:** Visualizzazione POI, calcolo distanze, cluster per performance

### 🎨 Bootstrap 5 + CSS Custom

- **Funzione:** Layout responsive, componenti UI, design system
- **Tema:** Dark-first con variabili CSS (`--bg-color: #0f172a`, `--accent-color: #3b82f6`)
- **Responsivo:** Breakpoints xs, sm, md, lg, xl

### ✨ AOS (Animate On Scroll)

- **Funzione:** Animazioni reveal in home e sezioni marketing
- **Effetto:** Fade, slide, zoom con trigger scroll
- **Performance:** Osservazione elementi visibili

---

## ⚙️ Backend Stack

| Tecnologia | Versione | Ruolo |
|---|---|---|
| **Node.js + Express** | 5.2.1 | REST API, middleware |
| **TypeScript** | Latest | Type safety server-side |
| **Prisma ORM** | 7.7.0 | PostgreSQL adapter, query type-safe |
| **Zod** | 4.3.6 | Validazione schema payload |
| **bcryptjs** | 3.0.3 | Hashing password (10 rounds) |
| **jsonwebtoken** | 9.0.3 | JWT stateless authentication |
| **Nodemailer** | 8.0.5 | SMTP email (Gmail/Ethereal) |
| **express-rate-limit** | 8.3.2 | Rate limiting auth/AI |
| **multer** | 2.1.1 | Multipart upload handling |

---

## 💾 Database & Storage

| Componente | Provider | Uso |
|---|---|---|
| **PostgreSQL** | Supabase (AWS EU) | Persistenza dati relazionale |
| **Prisma Client** | - | ORM type-safe, transazioni |
| **PgBouncer** | Supabase | Pooling connessioni |
| **Cloudinary** | - | Image upload, CDN, optimization |

---

## 🌐 API Esterne & Servizi Cloud

```
┌─────────────────────────────────────┐
│         SmartFare API               │
├─────────────────────────────────────┤
│ ⬇ Google Gemini 2.5 Flash          │ ← Chat IA, itinerary generation
│ ⬇ Google OAuth 2.0                 │ ← Federated login
│ ⬇ OSRM (OpenStreetMap Routing)     │ ← Route calculation
│ ⬇ Nodemailer + Gmail SMTP          │ ← Email delivery
│ ⬇ Cloudinary SDK                   │ ← Image hosting
│ ⬇ Supabase PostgreSQL              │ ← Data persistence
└─────────────────────────────────────┘
```

---

## 🔧 Strumenti Sviluppo

- **TypeScript Compiler** - tsc per build production
- **ts-node + nodemon** - dev server hot-reload  
- **Angular CLI** - build, serve, scaffolding
- **Jest / Supertest** - test framework backend
- **Vitest** - test frontend (vite native)
- **ESLint + Prettier** - code quality

# 3. 🏗️ Architettura del Sistema

## 🔄 Architettura Client-Server (3-Tier)

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              Angular 21 SPA (Frontend)                       │
│   [Components] → [Services] → [Signals/RxJS Streams]       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                  HTTPS + JWT Bearer
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│              Express.js REST API (Backend)                   │
│  [Routes] → [Middleware] → [Services] → [Business Logic]   │
└────────────────────────┬─────────────────────────────────────┘
                         │
              Prisma ORM (type-safe)
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│           PostgreSQL + Supabase                             │
│     [Relational Schema] [Indexes] [Constraints]             │
└──────────────────────────────────────────────────────────────┘
```

## 📡 Flusso Comunicazione

| Componente | Protocollo | Autenticazione | Note |
|---|---|---|---|
| Frontend → Backend | HTTPS REST JSON | JWT Bearer | Interceptor automatico |
| Backend → PostgreSQL | TCP (Supabase) | PgBouncer pooling | SSL enforced |
| Frontend → Gemini API | HTTPS gRPC | API Key | Rate limiting 20 req/min |
| Backend → OSRM | HTTPS REST | None | Routing calculation |
| Backend → Email | SMTP TLS | Gmail credentials | Fallback Ethereal |
| Frontend → Cloudinary | HTTPS REST | Upload token | CDN delivery |

---

## 🔐 Autenticazione & Autorizzazione

### Flusso di Login

```
1. User inserisce credenziali
           ↓
2. Frontend applica SHA-256(password)
           ↓
3. POST /auth/login con { email, hashedPassword }
           ↓
4. Backend: bcrypt.compare(storedHash, incomingHash)
           ↓
5. JWT generato con { userId, email, sessionId, exp: 24h }
           ↓
6. Frontend salva token in localStorage
           ↓
7. Interceptor aggiunge Authorization Bearer per ogni richiesta
```

### JWT Structure

```json
{
  "userId": "uuid-user-123",
  "email": "user@example.com",
  "sessionId": "session-abc456",
  "exp": 1715000000,
  "iat": 1714910000
}
```

---

## 💾 Flusso dei Dati (Caso Use: Builder Itinerario)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User modifica itinerario nel builder visual             │
│    → Signal: currentItinerary.update(newData)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Autosave debounced (700ms)                              │
│    Guest: localStorage.setItem('draft')                    │
│    Authenticated: POST /api/itineraries                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend riceve → Zod validation → Advisory lock          │
│    Previene race condition su simultaneous saves            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Prisma transaction:                                      │
│    - Find or create Itinerary                              │
│    - Delete old ItineraryItems                             │
│    - Insert new ItineraryItems                             │
│    ACID guarantee ✅                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Response: { id, name, items[], status: 'saved' }       │
│    Frontend: Signal aggiornato, loader nascosto             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Middleware Stack Backend

```typescript
Express App
├── CORS middleware (whitelist origin)
├── JSON parser (100kb limit)
├── Static files serving (/public)
├── Request logging (redacted password/idToken)
│
├── Routes:
│  ├── /auth (rate limited: 30 req/min)
│  ├── /api/itineraries
│  ├── /api/ai/itinerary (rate limited: 20 req/min)
│  ├── /api/locations
│  ├── /api/activity/categories
│  ├── /api/accommodation
│  └── /api/upload
│
├── Auth middleware (JWT verification)
├── Zod validation (per route)
└── Error handler (centralized with ZodError formatting)
```

---

## 📂 Struttura Cartelle

```
Smartfare-Backend/
├── src/
│  ├── app.ts              ← Express bootstrap
│  ├── server.ts           ← Port listener
│  ├── config/
│  │  ├── prisma.ts        ← PrismaClient singleton
│  │  └── cloudinary.ts    ← Cloudinary upload config
│  ├── routes/
│  │  ├── auth.route.ts
│  │  ├── itinerary.route.ts
│  │  ├── ai.route.ts
│  │  ├── location.route.ts
│  │  ├── activity.route.ts
│  │  ├── accommodation.route.ts
│  │  └── upload.route.ts
│  ├── services/
│  │  ├── auth/auth.service.ts
│  │  ├── itinerary/itinerary.service.ts
│  │  ├── ai/gemini.service.ts
│  │  └── email/email.service.ts
│  ├── schemas/
│  │  ├── auth.schema.ts
│  │  ├── ai.schema.ts
│  │  ├── itinerary.schema.ts
│  │  └── accommodation.schema.ts
│  └── middleware/
│     ├── auth.middleware.ts
│     └── error.middleware.ts
├── prisma/
│  ├── schema.prisma       ← DB schema definitions
│  └── migrations/         ← Migration history
└── package.json

Smartfare-Frontend/
├── src/
│  ├── main.ts             ← Bootstrap
│  ├── app.component.ts    ← Root component
│  ├── app.routes.ts       ← Route definitions
│  ├── core/
│  │  ├── auth/auth.service.ts
│  │  ├── services/ (http, loader, ui-state)
│  │  └── interceptors/ (auth, loader)
│  └── features/
│     ├── home/
│     ├── auth/ (login, register, reset, verify)
│     ├── planner/ (manual + builder)
│     └── itineraries/ (public, my itineraries)
├── environments/ (dev & prod config)
└── assets/
```

# 4. 💻 Analisi Frontend

## 🎨 Componenti Principali

| Componente | Ruolo | State | Funzioni Chiave |
|---|---|---|---|
| **HomeSection** | Landing page | Segnali UI | Video hero, carousel itinerari, CTA |
| **ManualPlanner** | Onboarding | Form + Segnali | Destinazione/date picker, recovery bozza |
| **ItineraryBuilder** | Core app | Signals (draft) | Workspace completo con 6 sub-componenti |
| **BuilderMap** | Visualizzazione | RxJS + Leaflet | Mappa interattiva, OSRM routing |
| **BuilderChat** | IA conversazionale | RxJS stream | Chat Gemini, context-aware prompts |
| **BuilderSidebar** | Ricerca POI | RxJS debounce | Fuzzy search, pagination, add-to-itinerary |
| **Auth Components** | Onboarding user | Form reactive | Login, Register, Forgot/Reset/Verify |

---

## 🛣️ Sistema di Routing

```typescript
// app.routes.ts
[
  { path: 'home', loadComponent: () => Home },
  { path: 'login', loadComponent: () => Login },
  { path: 'register', loadComponent: () => Register },
  { path: 'verify-email/:token', loadComponent: () => VerifyEmail },
  { path: 'forgot-password', loadComponent: () => ForgotPassword },
  { path: 'reset-password/:token', loadComponent: () => ResetPassword },
  { path: 'itineraries/new', loadComponent: () => ManualPlanner },
  { path: 'itineraries/builder', loadComponent: () => ItineraryBuilder },
  { path: 'itineraries/public', loadComponent: () => PublicItineraries },
  { path: 'itineraries/me', loadComponent: () => MyItineraries }
]
```

**Lazy Loading:** Ogni route carica il componente on-demand → bundle size ottimizzato

---

## 🎯 Gestione Stato (Signals)

```typescript
// Core Services con Signals

✅ ItineraryService
   signal: currentItinerary
   signal: autosaveStatus
   computed: totalDays
   methods: saveDraft, undo, redo, loadFromStorage

✅ UIStateService  
   signal: sidebarOpen
   signal: chatVisible
   signal: selectedCategory
   methods: toggleSidebar, setChatVisible

✅ AuthService
   signal: isAuthenticated
   signal: currentUser
   methods: login, logout, refreshToken
```

**Vantaggi:** Type-safe, granular updates, no action/reducer boilerplate

---

## 📱 Responsive Design

- **Breakpoints Bootstrap:** xs, sm (576px), md (768px), lg (992px), xl (1200px)
- **Mobile-first approach:** Mobile layout di default, media queries per desktop
- **Componenti adattivi:**
  - Header navbar collapse su mobile
  - Sidebar sidebar-off-canvas su md+
  - Map aspect-ratio responsivo

---

## ✨ UX/UI Highlights

| Feature | Implementazione | Benefit |
|---|---|---|
| **Video Hero** | Cloudinary carousel (9s rotation) | Percepzione qualitativa ↑ |
| **Typing Animation** | Canvas-based, runOutsideAngular | Performance 60fps |
| **Mappa Interattiva** | Leaflet + MarkerCluster + OSRM | UX moderna e informativa |
| **AI Chat Sidebar** | RxJS streaming, auto-scroll | Immediacy feedback |
| **Loader Contestuale** | Messaggi operazione-specifici | User guidance |
| **Canvas Background** | Animated auth pages | Premium feel |
| **Dark Theme** | CSS variables | Accessibility friendly |

---

## 📋 Gestione Form

```typescript
// Template-driven con validazioni immediate

Validazioni client:
✓ Campi obbligatori
✓ Email format (@angular/common.EmailValidator)
✓ Password length ≥ 8 char
✓ Password match (confirm)
✓ No special chars in username

Backend validation (Zod):
✓ Ridondante, difesa multilivello
✓ Formato email, lunghezza password
✓ Unique email check vs DB
```

---

## 🌐 Integrazione API

```typescript
// Services dedicate per ogni dominio

AuthService
├── login(email, password)
├── register(email, password, name)
├── loginWithGoogle(idToken)
├── forgotPassword(email)
├── resetPassword(token, newPassword)
└── verifyEmail(token)

ItineraryService
├── getCurrentDraft()
├── saveDraft(itinerary)
├── getPublicItineraries()
└── getMyItineraries()

AiChatService
└── chat(conversationContext)

LocationService
├── search(query)
└── getWorkspaceData(locationId)

HotelService & ActivityService
└── getByLocation(locationId)
```

---

## ♿ Accessibilità & Performance

| Aspetto | Implementazione |
|---|---|
| **Motion Preferences** | prefers-reduced-motion CSS media query |
| **Keyboard Navigation** | Tab order, focus visible su buttons |
| **ARIA Labels** | aria-label su button iconici |
| **Meta Tags** | Meta charset, viewport, og:image |
| **Lighthouse Score** | Target ≥ 85 Performance |
| **Bundle Size** | Lazy loading routes + tree-shaking |

---

## 🔍 SEO Status

> ⚠️ **SPA Limitation:** Angular SPA senza SSR significa limitato indexing dinamico

**Mitigation:**

- ✅ Static home page con meta tags
- ⚠️ Itinerari pubblici non SEO-friendly senza pre-rendering
- 💡 Opportunità futura: implementare Angular Universal per SSR

# 5. ⚙️ Analisi Backend

## 🚀 Server Bootstrap

```typescript
// server.ts → app.ts → routes setup

const PORT = process.env.PORT || 5555;
createApp().listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

## 🔌 Endpoint API Map

### 🔐 Authentication (`/auth`)

| Metodo | Endpoint | Rate Limit | Autenticazione |
|---|---|---|---|
| POST | `/auth/login` | 30/min | None (verifica DB) |
| POST | `/auth/register` | 30/min | None (crea account) |
| POST | `/auth/google` | 30/min | Google idToken |
| POST | `/auth/forgot-password` | 10/min | None (query DB email) |
| POST | `/auth/reset-password` | 10/min | Token URL param |
| POST | `/auth/verify-email` | None | Token URL param |

### 📅 Itinerari (`/api/itineraries`)

| Metodo | Endpoint | Protetto | Descrizione |
|---|---|---|---|
| GET | `/workspace` | ✅ | Locations + hotels + activities + user draft |
| GET | `/latest` | ✅ | Ultima bozza utente autenticato |
| GET | `/public` | ❌ | Itinerari published, filtro location |
| GET | `/public/:slug` | ❌ | Dettagli itinerario pubblico |
| POST | `/` | ✅ | Salva o aggiorna itinerario (ACID transaction) |
| GET | `/me` | ✅ | I miei itinerari |

### 🤖 IA (`/api/ai/itinerary`)

| Metodo | Endpoint | Rate Limit | Payload |
|---|---|---|---|
| POST | `/chat` | 20/min | { conversationContext, locations, activities } |
| POST | `/generate` | 20/min | { destinationName, budget, travelStyle, startDate } |

### 🌍 Dati (`/api/locations`, `/api/activity`, `/api/accommodation`)

| Metodo | Endpoint | Cache | Descrizione |
|---|---|---|---|
| GET | `/locations` | 1h | Fuzzy search by name/province/CAP |
| GET | `/activity/categories` | 1h | Elenco categorie POI |
| GET | `/accommodation` | 30m | Filtered by locationId + distance |

### 📤 Upload (`/api/upload/image`)

| Metodo | Endpoint | Protetto | Storage |
|---|---|---|---|
| POST | `/image` | ✅ | Cloudinary + optional DB reference |

---

## 🏢 Service Layer Architecture

```typescript
┌─────────────────────────────────────┐
│      Auth Service (500+ lines)      │
├─────────────────────────────────────┤
│ ✓ Local login/register              │
│ ✓ Google OAuth integration          │
│ ✓ Email verification workflow       │
│ ✓ Password reset secure tokens      │
│ ✓ Double-hashing: SHA256 + bcrypt   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    Itinerary Service (300+ lines)   │
├─────────────────────────────────────┤
│ ✓ Create/update itinerary           │
│ ✓ PostgreSQL advisory locks         │
│ ✓ Transactional item management     │
│ ✓ Workspace aggregation query       │
│ ✓ Latest draft retrieval            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Gemini IA Service (250+ lines)  │
├─────────────────────────────────────┤
│ ✓ Chat multi-turn conversations     │
│ ✓ Location identification from text │
│ ✓ Initial itinerary generation      │
│ ✓ Model fallback chain              │
│ ✓ Retry logic with backoff          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Email Service (150+ lines)     │
├─────────────────────────────────────┤
│ ✓ Nodemailer transporter setup      │
│ ✓ Gmail SMTP + Ethereal fallback    │
│ ✓ Verification email template       │
│ ✓ Password reset email template     │
│ ✓ HTML formatting + CSS inlining    │
└─────────────────────────────────────┘
```

---

## 🔒 Autenticazione Dettagli

### Local Login Flow

```
1. User → { email, password }
           ↓
2. Frontend: password_hashed = SHA256(password)
           ↓
3. POST /auth/login { email, password_hashed }
           ↓
4. Backend queries User table by email
           ↓
5. bcrypt.compare(storedHash, incomingHash)
           ↓
6. SUCCESS:
   - Create JWT: { userId, email, sessionId, exp: now + 24h }
   - Return token + user profile
   
7. FAILURE:
   - Return 401 "Invalid credentials"
```

### Google OAuth Flow

```
1. Frontend: user clicks "Login with Google"
           ↓
2. Google popup: user accepts permissions
           ↓
3. Frontend receives idToken
           ↓
4. POST /auth/google { idToken }
           ↓
5. Backend: verifyIdToken(idToken)
   - Validates JWT signature
   - Checks audience, expiry
   - Extracts email, name
           ↓
6. If user exists: return existing account JWT
   If new user: create account + return JWT
```

---

## ✅ Validazione Input (Zod Schemas)

```typescript
// Example: Register Schema
const RegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Min 8 chars").regex(/[A-Z]/, "Need uppercase"),
  confirmPassword: z.string(),
  name: z.string().min(2, "Min 2 chars"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// All routes validate on entry:
router.post("/register", (req, res) => {
  const validation = RegisterSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ errors: validation.error.flatten() });
  }
  // Proceed with business logic...
});
```

---

## 🐛 Error Handling Centralizzato

```typescript
// Error Middleware (ultimo middleware)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // 1. ZodError → 400 con dettagli path/message
  // 2. AppError → status + message personalizzato
  // 3. Generic Error → 500 con redazione log
  
  if (err instanceof ZodError) {
    return res.status(400).json({ 
      error: "Validation error",
      details: err.flatten()
    });
  }
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  
  // Log per debugging, ma non esporre dettagli a client
  console.error("Unexpected error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});
```

---

## 🧠 Prisma ORM Highlights

```typescript
// Type-safe queries con autocomplete

// Fetch itinerary con relazioni
const itinerary = await prisma.itinerary.findUnique({
  where: { id: itineraryId },
  include: {
    items: {
      orderBy: { dayNumber: 'asc', orderInt: 'asc' }
    },
    location: true,
    user: { select: { email: true, userProfile: true } }
  }
});

// Transactional multi-step operation
const result = await prisma.$transaction(async (tx) => {
  await tx.itineraryItem.deleteMany({
    where: { itineraryId }
  });
  
  const items = await tx.itineraryItem.createMany({
    data: newItems,
    skipDuplicates: true
  });
  
  return items;
});

// Advisory lock per prevenire race conditions
const LOCK_KEY = generateHash(`${userId}-${identity}`);
await prisma.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
// ... save operation protetto ...
```

# 6. Database

## Tipo di database

PostgreSQL relazionale, gestito tramite Prisma ORM e connettivita Supabase.

## Struttura dati

Il modello e centrato su:

- utenti e profilo/preferenze;
- catalogo location, attivita e accommodation;
- itinerari con items ordinati e metadati di visibilita.

## Relazioni principali

- User 1:1 UserProfile
- User 1:1 UserPreference
- User 1:N Itinerary
- Location 1:N Activity
- Location 1:N Accommodation
- Itinerary 1:N ItineraryItem
- ItineraryItem N:1 Activity o Accommodation (opzionali)
- Itinerary N:N User tramite ItineraryFavorite

## Modelli principali

- User
- UserProfile
- UserPreference, UserPreferenceInterest
- Location
- ActivityCategory, Activity
- Accommodation
- ItineraryVisibility
- Itinerary
- ItineraryItemType
- ItineraryItem
- ItineraryFavorite

## Query importanti

- workspace aggregato per location + bozza utente.
- latest draft utente autenticato.
- itinerari pubblici con filtro location e conteggio items.
- save itinerary in transazione con delete/create batch items.

## Vantaggi soluzione scelta

- Schema relazionale adatto a vincoli forti (FK, unique, index).
- Prisma accelera sviluppo e riduce errori SQL.
- Possibilita di analytics e query articolate nel tempo.

## Ricostruzione tabelle (schema testuale)

- User(id, email unique, passwordHash, authProvider, sessionId, token reset/verifica, flags verifica, timestamps)
- UserProfile(id, userId unique, anagrafica base, avatar)
- UserPreference(id, userId unique, budget/stile/interessi)
- UserPreferenceInterest(id, preferenceId, activityCategoryId)
- Location(id, name, province, cap, lat, lng)
- ActivityCategory(id, name unique, description, icon)
- Activity(id, name, description, street, lat, lng, locationId, categoryId, imageUrl, createdAt)
- Accommodation(id, name, street, stars, lat, lng, locationId, imageUrl)
- ItineraryVisibility(code, name, description)
- Itinerary(id, name, description, isPublished, visibilityCode, publicSlug, date range, userId, locationId, imageUrl, timestamps)
- ItineraryItemType(code, label, description)
- ItineraryItem(id, itineraryId, itemTypeCode, dayNumber, orderInt, note, planning fields, activityId/accommodationId)
- ItineraryFavorite(userId, itineraryId, createdAt)

# 7. Deploy e infrastruttura

## Pubblicazione frontend

- Build Angular tramite ng build.
- Output statico in cartella dist.
- Nel repo non sono presenti config esplicite di piattaforma frontend (es. Vercel/Netlify file dedicati).
- E plausibile deploy statico su hosting CDN o dominio custom separato.

## Pubblicazione backend

- Backend Node/Express compilato in dist (script start node dist/server.js).
- Endpoint produzione configurato su Render: <https://smartfare-56lb.onrender.com>.

## Ruolo di Vercel/Render o altre piattaforme

- Render: confermato per backend API.
- Vercel: non emergono evidenze dirette nel codice attuale.
- Altre piattaforme: possibile uso hosting statico per frontend (non deducibile con certezza dal repository).

## Variabili ambiente

Backend richiede almeno:

- DATABASE_URL, DIRECT_URL
- FRONTEND_URL
- JWT_SECRET, JWT_EXPIRES_IN
- GEMINI_API_KEY, GEMINI_MODEL
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- ID_CLIENT (Google OAuth)

Frontend usa:

- environment.ts (dev)
- environment.prod.ts (prod)
- apiUrl punta al backend.

## Dominio e HTTPS

- Backend Render usa HTTPS nativo.
- Frontend in produzione dovrebbe puntare via HTTPS all'API per evitare mixed content.
- FRONTEND_URL lato backend governa CORS: deve contenere dominio reale del frontend.

## CI/CD automatico

- Nel repository non risultano workflow GitHub Actions o pipeline CI/CD esplicite.
- Deploy probabilmente manuale o con pipeline esterna della piattaforma.

## Cloud computing

- Database su cloud (Supabase).
- API su cloud runtime (Render).
- Media su cloud object/CDN (Cloudinary).
- AI su cloud (Gemini API).

## Differenza ambiente locale vs produzione

### Locale

- Frontend su localhost:4200.
- Backend su localhost:5555.
- Possibile debug con nodemon e ts-node.

### Produzione

- Frontend su dominio pubblico.
- Backend su Render.
- DB remoto Supabase.
- CORS restrittivo per domini autorizzati.

## Collegamenti Sistemi e Reti / TPSIT

- Architettura distribuita client-server reale.
- HTTPS, CORS, token-based auth, API gateway logic.
- Separazione livelli applicativi e integrazione servizi cloud terzi.
- Gestione ambienti e variabili sensibili (tema forte di sicurezza infrastrutturale).

# 8. Sicurezza

## Autenticazione

- JWT per API protected.
- Login locale e federato Google.
- Verifica email prima di consentire login locale.

## Hashing password

- Frontend applica SHA-256 prima invio.
- Backend applica bcrypt su password ricevuta e salva solo hash bcrypt.
- In fase login: bcrypt.compare.

## Protezione API

- Middleware JWT su route sensibili.
- Rate limit su auth e AI contro abuso/bruteforce.

## CORS

- Whitelist origin da env.
- Blocca origin non autorizzate.

## Gestione token

- JWT con scadenza.
- Token reset/verifica email random + hash SHA-256 in DB.
- Token raw usato solo nel link inviato via email.

## Validazione input

- Zod schema validation su endpoint principali.
- Errori validazione ritornati con dettagli path/message.

## Vulnerabilita prevenute

- Enumerazione utente mitigata in forgot password (risposta neutra).
- Brute force mitigato con rate limiting.
- Input malformati bloccati da Zod.
- Password non salvate in chiaro.

## Vulnerabilita residue da evidenziare

- Segreti sensibili presenti in file .env nel repository: rischio critico di compromissione account/API/DB.
- Assenza apparente di Helmet e header hardening.
- Assenza apparente di refresh token/rotazione token avanzata.
- Logging debug molto verboso in alcuni punti auth.

# 9. Problematiche affrontate

## Problema 1: Duplicazione bozze itinerario

- Problema: salvataggi ripetuti/autosave possono generare duplicati.
- Soluzione adottata: lock advisory PostgreSQL + hash identita bozza e riuso bozza esistente se equivalente.

## Problema 2: Affidabilita chiamate IA

- Problema: timeout/reti instabili/quota API.
- Soluzione adottata: retry con backoff su errori di rete + fallback messaggio utente in caso 429.

## Problema 3: Routing mappe non sempre disponibile

- Problema: servizi OSRM pubblici possono fallire o rispondere lentamente.
- Soluzione adottata: doppio endpoint routing (primary/fallback) + fallback visuale linea tratteggiata.

## Problema 4: Coerenza bozza guest vs utente loggato

- Problema: utenti non autenticati rischiano perdita bozza al cambio pagina.
- Soluzione adottata: persistenza localStorage per guest e autosave backend per utenti autenticati.

## Problema 5: Rallentamenti UI da animazioni

- Problema: animazioni continue possono causare jank.
- Soluzione adottata: uso runOutsideAngular, riduzione trigger change detection, gestione prefers-reduced-motion.

## Problema 6: Compatibilita MarkerCluster in build production

- Problema: plugin Leaflet marker cluster non sempre inizializzato allo stesso modo.
- Soluzione adottata: check difensivo e fallback a LayerGroup.

## Problema 7: Recovery account sicuro

- Problema: reset password e verifica email devono evitare esposizione token DB.
- Soluzione adottata: token random inviato via email, hash token memorizzato in DB, expiry temporale.

## Problema 8: Migrazioni schema legacy

- Problema: rimozione entita trasporti e rinomina colonna typo in tabella interessi.
- Soluzione adottata: script SQL manuale e script migration custom per cleanup strutturale.

# 10. Competenze informatiche dimostrate

## Frontend

- Progettazione SPA Angular moderna.
- Gestione stato reattivo con Signals.
- UX ricca con mappe, animazioni e componenti modulari.
- Intercettazione e orchestrazione chiamate HTTP.

## Backend

- Progettazione API REST.
- Middleware pattern e error handling centralizzato.
- Integrazione OAuth, JWT e sicurezza endpoint.
- Integrazione servizi esterni (AI, email, cloud media).

## Database

- Modellazione relazionale con relazioni complesse.
- Uso ORM tipizzato e transazioni.
- Indicizzazione e vincoli di integrita.

## Sistemi e reti

- Architettura distribuita cloud.
- CORS, HTTPS, gestione ambienti.
- Connettivita tra servizi esterni eterogenei.

## Progettazione software

- Separazione layers (routes/services/schemas).
- Riuso componenti e servizi nel frontend.
- Approccio modulare e manutenibile.

## Debugging

- Log di supporto su route e servizi.
- Fallback tecnici per dipendenze esterne instabili.

## Deploy

- Configurazione env dev/prod.
- Integrazione backend cloud e API production endpoint.

## Lavoro full stack

- Coerenza tra modelli frontend, payload API, schema DB.
- Pipeline completa da UX a persistenza fino a servizi cloud.

# 11. Collegamenti scolastici

## Informatica

- Analisi e progettazione di basi di dati relazionali.
- Sviluppo software modulare e orientato ai servizi.
- Algoritmi pratici: ordinamento tappe, gestione stati, filtri.

Argomenti consigliati orale:

- ORM vs SQL puro.
- Architettura a livelli.
- Modello relazionale del progetto.

## TPSIT

- Progettazione e sviluppo applicazioni web reali.
- API REST e protocolli client-server.
- Integrazione servizi cloud e terze parti.

Argomenti consigliati orale:

- Ciclo di vita applicazione web.
- Gestione ambienti dev/prod.
- Validazione e sicurezza API.

## Sistemi e Reti

- HTTPS, DNS, dominio, CORS.
- Distribuzione servizi su cloud provider diversi.
- Disponibilita e affidabilita di API esterne.

Argomenti consigliati orale:

- Flusso pacchetti client -> API -> DB.
- Reverse proxy e certificati SSL.
- Problematiche latenza/rete nei servizi distribuiti.

## Inglese

- Terminologia tecnica internazionale (API, middleware, token, deploy, cloud).
- Documentazione e naming tecnico in inglese nel codice.

Argomenti consigliati orale:

- Presentazione in inglese dell'architettura.
- Security vocabulary.

## Matematica

- Aspetti quantitativi: stime tempi percorrenza, costi itinerario, ottimizzazione ordine tappe.
- Logica e funzioni nei controlli dati (vincoli, validazione, intervalli temporali).

Argomenti consigliati orale:

- Modelli di ottimizzazione percorso (introduzione).
- Analisi dati e metriche costo-tempo.

## Educazione civica

- Privacy e protezione dati personali (email, credenziali, token).
- Responsabilita nell'uso dell'AI e trasparenza verso utenti.
- Sicurezza digitale come cittadinanza attiva.

Argomenti consigliati orale:

- GDPR e minimizzazione dati.
- Buone pratiche gestione segreti e credenziali.

# 12. Possibile struttura della tesina

## Indice suggerito

1. Introduzione e obiettivi
2. Analisi del problema
3. Requisiti funzionali e non funzionali
4. Scelta tecnologie
5. Architettura sistema
6. Frontend
7. Backend
8. Database
9. Sicurezza
10. Deploy e infrastruttura cloud
11. Criticita e miglioramenti futuri
12. Conclusioni

## Ordine dell'esposizione orale

- Partire dal bisogno reale utente.
- Mostrare soluzione completa SmartFare.
- Entrare in tecnica gradualmente: UI -> API -> DB -> sicurezza -> cloud.
- Chiudere con riflessione professionale e miglioramenti.

## Possibili slide PowerPoint

- Slide 1: problema e obiettivo.
- Slide 2: demo funzionale rapida (flusso utente).
- Slide 3: stack tecnologico.
- Slide 4: architettura client-server.
- Slide 5: schema DB semplificato.
- Slide 6: autenticazione e sicurezza.
- Slide 7: AI integration e flusso prompt-risposta.
- Slide 8: deploy cloud e differenza dev/prod.
- Slide 9: criticita reali e soluzioni.
- Slide 10: competenze acquisite e conclusione.

## Introduzione proposta

SmartFare nasce dall'esigenza concreta di rendere semplice e intelligente la pianificazione di viaggi complessi, integrando in un'unica piattaforma strumenti di organizzazione, mappe e intelligenza artificiale.

## Conclusione proposta

Il progetto dimostra una maturita tecnica full stack significativa, con attenzione a UX, modularita software, integrazione cloud e sicurezza applicativa. Le criticita emerse rappresentano opportunita di evoluzione verso standard ancora piu professionali.

# 13. Domande possibili della commissione

## Domande tecniche

- Perche hai scelto Angular invece di React o Vue?
- Come funziona l'autosave senza creare conflitti?
- Come gestisci stato globale senza NgRx?
- Come hai separato logica UI e logica business?

## Domande teoriche

- Differenza tra autenticazione e autorizzazione.
- Differenza tra hashing e cifratura.
- Differenza tra REST e GraphQL.

## Domande sicurezza

- Perche JWT e non sessioni server classiche?
- Come previeni brute force e input malevoli?
- Quali sono i rischi di avere segreti nel repository?

## Domande sistemi

- Spiega il ruolo di CORS in questa applicazione.
- Cosa cambia tra HTTP e HTTPS nel tuo progetto?
- Come gestiresti scalabilita backend se utenti aumentano molto?

## Domande database

- Perche un database relazionale e non NoSQL?
- Come garantisci integrita dati tra itinerario e tappe?
- A cosa servono indici e vincoli unique nel tuo schema?

## Domande deploy

- Come passi da ambiente locale a produzione?
- Quali variabili ambiente sono critiche?
- Come implementeresti una CI/CD completa in questo progetto?

# 14. Valutazione tecnica del progetto

## Punti forti

- Architettura full stack ben articolata.
- UX moderna e distintiva (mappa avanzata, builder, AI chat).
- Modello dati ricco e coerente con use case reali.
- Integrazione multipiattaforma cloud (Render, Supabase, Cloudinary, Gemini).
- Buona gestione validazione e handling errori.

## Limiti

- Mancanza pipeline CI/CD esplicita nel repository.
- Gestione segreti in .env committato: criticita molto seria.
- Alcune componenti UI complesse possono diventare difficili da mantenere senza ulteriore modularizzazione.
- Assenza evidente di test automatici integrati nel flusso di deploy.

## Aspetti professionali

- Struttura cartelle e separazione responsabilita convincenti.
- Uso pragmatico di fallback su servizi esterni instabili.
- Attenzione concreta a scenari reali (guest mode, upload media, email workflow).

## Livello di complessita

Medio-alto: include sviluppo frontend avanzato, backend REST, database relazionale, autenticazione, IA, cloud services e logiche business non banali.

## Cosa impressionerebbe una commissione ITIS

- Dimostrazione live del flusso completo: prompt IA -> itinerario -> mappa -> salvataggio -> export.
- Spiegazione tecnica chiara di autenticazione JWT + reset password sicuro.
- Ragionamento critico su limiti reali e miglioramenti futuri.
- Capacita di collegare il progetto alle discipline scolastiche in modo concreto.

# Considerazioni finali utili per la tesina

Per una discussione orale efficace:

- evidenzia che non e un esercizio scolastico isolato, ma un prodotto quasi reale;
- mostra trade-off progettuali (velocita sviluppo vs robustezza enterprise);
- sottolinea il valore del pensiero ingegneristico: non solo codice, ma scelta tecnologie, sicurezza, affidabilita e deployment.
