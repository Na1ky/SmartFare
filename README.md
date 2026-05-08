---
title: "SmartFare - Analisi completa progetto web per tesina di maturita (ITIS Informatica)"
author: "Analisi tecnica del repository"
date: "8 maggio 2026"
output: html_document
---

# 1. Panoramica del progetto

## Nome progetto
SmartFare

## Scopo del sito
SmartFare e una web application full stack per la pianificazione intelligente di viaggi e itinerari, con supporto IA per suggerimenti e generazione automatica delle tappe.

## Problema che risolve
Quando si organizza un viaggio reale, l'utente deve:
- scegliere destinazione e date;
- cercare manualmente attivita, hotel e punti di interesse;
- ordinare le tappe in modo logico;
- stimare tempi e costi;
- mantenere tutto aggiornato e condivisibile.

SmartFare centralizza questi passaggi in un unico strumento con salvataggio automatico, mappa interattiva, supporto AI e gestione account.

## Target utenti
- Viaggiatori individuali.
- Coppie o piccoli gruppi.
- Studenti e giovani utenti che vogliono un planner rapido.
- Utenti che desiderano supporto conversazionale IA per decidere cosa fare durante il viaggio.

## Funzionalita principali
- Ricerca destinazioni dal database.
- Creazione itinerario manuale con date e tappe.
- Builder visuale con mappa (POI, ordine tappe, percorsi giornalieri).
- Chat IA contestuale per suggerire e modificare l'itinerario.
- Generazione IA iniziale da prompt testuale.
- Gestione autenticazione (email/password + Google OAuth).
- Verifica email e reset password via link email.
- Salvataggio bozza lato client (guest) e lato server (utenti autenticati).
- Pubblicazione itinerari e sezione itinerari pubblici.
- Upload immagine itinerario su Cloudinary.
- Export itinerario in JSON, HTML e PDF (stampa browser).

# 2. Stack tecnologico

## Frontend
### Angular 21 (standalone components + signals)
- A cosa serve: costruzione SPA, routing client-side, componentizzazione UI.
- Perche scelto: framework strutturato e robusto per app complesse con molte schermate e stato condiviso.
- Vantaggi: modularita, lazy loading, performance discrete, ecosistema maturo.

### TypeScript
- A cosa serve: tipizzazione statica del frontend.
- Perche scelto: riduce errori a runtime e rende il codice piu manutenibile.
- Vantaggi: migliore qualita del codice, refactoring piu sicuro.

### RxJS
- A cosa serve: gestione stream asincroni HTTP e debounce ricerca.
- Perche scelto: standard in Angular per flussi reattivi.
- Vantaggi: controllo fine su eventi asincroni e pipeline dati.

### Angular Signals
- A cosa serve: stato locale e globale leggero (UI state, bozza itinerario, loader).
- Perche scelto: approccio moderno e semplice rispetto a store piu pesanti.
- Vantaggi: reattivita chiara, meno boilerplate.

### Leaflet + MarkerCluster
- A cosa serve: mappa interattiva con marker, cluster e rotte.
- Perche scelto: libreria open source molto diffusa per mappe web.
- Vantaggi: controllo grafico elevato, plugin ecosistema ampio.

### Bootstrap + Bootstrap Icons + CSS custom
- A cosa serve: base layout e componenti UI.
- Perche scelto: velocita di sviluppo e supporto responsive.
- Vantaggi: produttivita, coerenza visuale, buona resa cross-device.

### AOS (Animate On Scroll)
- A cosa serve: animazioni di reveal in home e sezioni marketing.
- Perche scelto: effetto moderno con configurazione semplice.
- Vantaggi: migliora percezione qualitativa UX.

## Backend
### Node.js + Express 5
- A cosa serve: REST API, middleware, integrazione servizi esterni.
- Perche scelto: stack JavaScript/TypeScript coerente col frontend.
- Vantaggi: velocita di sviluppo, ampia community, middleware ecosystem.

### Prisma ORM
- A cosa serve: accesso tipizzato a PostgreSQL, query e relazioni.
- Perche scelto: produttivita e type safety lato server.
- Vantaggi: query leggibili, migrazione schema, riduzione errori SQL manuali.

### Zod
- A cosa serve: validazione input API.
- Perche scelto: schema validation semplice, integrabile con TS.
- Vantaggi: prevenzione input malformati, errori chiari lato API.

### JSON Web Token (jsonwebtoken)
- A cosa serve: autenticazione stateless.
- Perche scelto: standard de facto per API REST.
- Vantaggi: semplice integrazione frontend-backend.

### bcryptjs
- A cosa serve: hashing password lato backend.
- Perche scelto: libreria nota e affidabile.
- Vantaggi: protezione password anche in caso di data breach.

### Nodemailer
- A cosa serve: invio email per verifica account e reset password.
- Perche scelto: standard Node per SMTP.
- Vantaggi: flessibile, supporta provider reali e account test (Ethereal).

### multer + cloudinary storage
- A cosa serve: upload immagini itinerari e gestione media cloud.
- Perche scelto: separa storage file dal server applicativo.
- Vantaggi: scalabilita storage, ottimizzazione immagini, CDN.

## Database
### PostgreSQL (erogato tramite Supabase)
- A cosa serve: persistenza dati strutturati (utenti, itinerari, location, attivita, hotel).
- Perche scelto: affidabile, relazionale, adatto a modello con molte FK.
- Vantaggi: integrita referenziale, query potenti, buona scalabilita.

## Hosting/Deploy
### Render (backend)
- Evidenza: URL produzione API nel frontend environment prod.
- Ruolo: ospita API Express.
- Vantaggi: deploy rapido da repository e SSL gestito dalla piattaforma.

### Frontend statico (hosting non esplicitato nel codice)
- Evidenza: API produzione punta a Render, ma nel repo non compaiono file di deploy frontend specifici (es. vercel.json, netlify.toml).
- Ipotesi realistica: build Angular pubblicata su hosting statico/CDN o dominio personalizzato.

## Librerie/framework
- Angular, Express, Prisma, Zod, Leaflet, RxJS, Bootstrap, AOS, Cloudinary SDK, Nodemailer, jsonwebtoken, bcryptjs, express-rate-limit.

## API esterne
### Google Gemini API
- A cosa serve: chat AI contestuale e generazione itinerari iniziali.
- Perche scelta: modello generativo versatile con output testuale/JSON.
- Vantaggi: UX smart e personalizzazione rapida dell'itinerario.

### Google OAuth (google-auth-library + angularx-social-login)
- A cosa serve: login federato con account Google.
- Perche scelto: onboarding rapido utenti.
- Vantaggi: minore frizione in registrazione/accesso.

### OSRM / routing.openstreetmap.de
- A cosa serve: calcolo percorso stradale tra tappe in mappa.
- Perche scelto: servizio routing pubblico senza costi diretti immediati.
- Vantaggi: visualizzazione reale del tragitto e stima tempi/distanza.

## Strumenti di sviluppo
- TypeScript compiler, ts-node, nodemon, Angular CLI.
- Jest e Supertest (presenti come dipendenze di test backend).
- Vitest (presente nel frontend).

# 3. Architettura del sistema

## Struttura client/server
Architettura classica 3-layer:
- Presentation: Angular SPA.
- Application/API: Express + servizi.
- Data: PostgreSQL via Prisma.

## Comunicazione frontend-backend
- Protocollo HTTP/HTTPS.
- API REST JSON.
- Endpoint sotto prefissi:
  - /auth
  - /api/locations
  - /api/itineraries
  - /api/ai
  - /api/activity
  - /api/accommodation
  - /api/upload

## Gestione richieste API
- Frontend usa HttpClient Angular.
- Interceptor auth aggiunge Authorization Bearer automaticamente verso API base URL.
- Interceptor loader mostra stato operazioni bloccanti.
- Backend applica CORS con whitelist origin da FRONTEND_URL.
- Validazione payload via Zod prima della logica business.

## Autenticazione
- JWT rilasciato dopo login/register verify/google login.
- Middleware authenticateJWT per endpoint protetti.
- Middleware optionalAuthenticateJWT per endpoint fruibili anche da guest.
- Inclusione sessionId nel token per gestione sessione logica lato applicazione.

## Flusso dei dati
- Utente crea/modifica itinerario nel builder.
- Se guest: bozza in localStorage.
- Se autenticato: autosave con debounce verso backend.
- Backend salva itinerario + items su PostgreSQL con transazioni Prisma.
- IA usa contesto workspace (location, attivita, hotel, categorie, bozza) per risposte coerenti.

## Middleware rilevanti
- CORS middleware custom.
- JSON parser Express.
- Logging richieste con redazione password/idToken.
- Auth middleware JWT.
- Rate limiter su auth e AI.
- Error middleware centralizzato con handling ZodError/AppError.

## Struttura cartelle principali
- Smartfare-Frontend/src/app
  - core: servizi, modelli, interceptor, auth
  - features: pagine e componenti UI
- Smartfare-Backend/src
  - routes: endpoint API
  - services: business logic
  - schemas: validazione Zod
  - middleware: auth/error
  - config: Prisma/Cloudinary
- Smartfare-Backend/prisma
  - schema dati e migrazioni

## Schema testuale architettura
Frontend Angular -> Interceptor -> Express API -> Service Layer -> Prisma ORM -> PostgreSQL (Supabase)

Frontend Angular -> API upload -> Cloudinary

Frontend Angular -> API AI -> Gemini Service -> Google Gemini

Backend -> Email Service -> SMTP provider (Gmail/Ethereal)

## Diagramma ASCII semplificato

+--------------------------+
|      Browser Client      |
|      Angular SPA         |
+------------+-------------+
             |
             | HTTPS REST + JWT
             v
+--------------------------+
|      Express Backend     |
| Routes + Middleware      |
| Auth, AI, Itinerary      |
+------+---------+---------+
       |         |
       |         +----------------------+
       |                                |
       v                                v
+---------------+                +---------------+
| PostgreSQL    |                | External APIs |
| (Supabase)    |                | Gemini, SMTP, |
| via Prisma    |                | Cloudinary,   |
+---------------+                | OSRM          |
                                 +---------------+

# 4. Analisi frontend

## Componenti principali
- HomeSection: landing con hero video, animazioni, itinerari pubblici.
- ManualPlanner: onboarding destinazione/date e scelta ripresa bozza.
- ItineraryBuilder: nucleo applicativo con sidebar, mappa, summary, chat IA.
- Componenti auth: login, register, forgot/reset/verify email.

## Routing
Routing lazy via loadComponent per quasi tutte le pagine.
Percorsi chiave:
- /home
- /login, /register
- /forgot-password, /reset-password, /verify-email
- /itineraries/new
- /itineraries/builder
- /itineraries/public, /itineraries/me

## Gestione stato
- Signals per stato locale UI e globale applicativo leggero.
- ItineraryService mantiene bozza corrente, undo/redo, autosave status.
- UIStateService gestisce sidebar, chat, categorie filtro, colori route day-by-day.

## Responsive design
- Uso combinato di Bootstrap + CSS custom.
- Layout fluidi e componenti ottimizzati mobile.
- In varie schermate auth/home il canvas di background e adattato a window resize.

## UX/UI
- Approccio visual moderno: video hero, animazioni, mappa interattiva, popup ricchi.
- Loader contestuale con messaggi operazione-specifici.
- Notifiche centralizzate tramite AlertService.
- Supporto riduzione movimento (prefers-reduced-motion) in alcune animazioni.

## Gestione form
- Form template-driven nelle schermate auth/planner.
- Validazioni immediate lato client (campi obbligatori, lunghezza password, match password).
- Ulteriore validazione server con Zod (difesa multilivello).

## Chiamate API
Servizi dedicati:
- AuthService -> /auth
- ItineraryService -> /api/itineraries
- AiChatService -> /api/ai/itinerary/chat
- LocationService -> /api/locations
- ActivityService -> /api/activity/categories
- HotelService -> /api/accommodation

## SEO
- Essendo SPA Angular, non emergono strategie SEO avanzate (SSR/prerender) nel repository.
- Presente una homepage marketing, ma senza indizi di rendering server-side.

# 5. Analisi backend

## Server
- Entrypoint server.ts avvia createApp() e listen su PORT.
- app.ts configura CORS, parser JSON, static, routing API e error handling.

## Endpoint API
### Auth
- POST /auth/login
- POST /auth/register
- POST /auth/google
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/verify-email

### Itinerari
- GET /api/itineraries/workspace
- GET /api/itineraries/latest
- GET /api/itineraries/public
- GET /api/itineraries/public/:id
- POST /api/itineraries
- GET /api/itineraries/me

### AI
- POST /api/ai/itinerary/chat
- POST /api/ai/itinerary/generate

### Altri
- GET /api/locations
- GET /api/activity/categories
- GET /api/accommodation
- POST /api/upload/image

## Logica applicativa
- ItineraryService gestisce create/update, fetch workspace, bozza recente, pubblici e utente.
- Uso transazioni Prisma per update itinerario + rewrite items.
- Meccanismo anti-duplicazione bozza con lock advisory PostgreSQL e hash identita bozza.

## Autenticazione/autorizzazione
- Login locale con password hashata lato client (SHA-256) e ricontrollata lato server via bcrypt compare su hash DB.
- Login Google con verifyIdToken.
- JWT con campi userId/email/sessionId.
- Protezione endpoint con middleware JWT.

## Validazione dati
- Zod per schema request in auth, itinerari, AI e accommodation.
- Error middleware traduce ZodError in risposte 400 con dettagli.

## Gestione errori
- Classe AppError per errori applicativi previsti.
- Error handler globale per errori runtime e validazione.

## Sicurezza
- Rate limiting su auth e AI.
- Hashing password e token reset/verifica email.
- CORS con whitelist origin.
- Redazione parziale log body (password/idToken).

## Middleware
- authenticateJWT
- optionalAuthenticateJWT
- errorHandler
- rateLimit route-level

## Sessioni/token
- Stateless JWT lato API.
- sessionId in DB aggiornato a ogni login e inserito nel token (controllo sessione logica, non pienamente revocatorio senza ulteriore check middleware).

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
- Endpoint produzione configurato su Render: https://smartfare-56lb.onrender.com.

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
