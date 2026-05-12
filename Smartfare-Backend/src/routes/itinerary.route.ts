import { Router, Response, NextFunction } from "express";
import { ItineraryService } from "../services/itinerary/itinerary.service";
import { authenticateJWT, optionalAuthenticateJWT, AuthRequest } from "../middleware/auth.middleware";
import { itinerarySchema } from "../schemas/itinerary.schema";
const router = Router();
const itineraryService = new ItineraryService();

// GET /api/itineraries/workspace?locationId=1 - Aggregated workspace payload for the builder
router.get("/workspace", optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const locationId = Number(req.query.locationId);

        if (!locationId || Number.isNaN(locationId)) {
            return res.status(400).json({ error: "locationId mancante o non valido" });
        }

        const workspace = await itineraryService.getWorkspaceData(locationId, req.user?.userId ? Number(req.user.userId) : undefined);
        res.status(200).json(workspace);
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/latest - Get the latest draft for the logged user
router.get("/latest", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        if (!userId || Number.isNaN(userId)) return res.status(401).json({ error: "Unauthorized" });

        const draft = await itineraryService.getLatestDraft(userId);
        res.status(200).json(draft);
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/public - Get all public itineraries (optional filter by locationId)
router.get("/public", optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
        const currentUserId = req.user?.userId ? Number(req.user.userId) : undefined;
        const itineraries = await itineraryService.getPublicItineraries(locationId, currentUserId);
        res.status(200).json(itineraries);
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/public/:id - Get a single public itinerary by ID
router.get("/public/:id", optionalAuthenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id);
        const itinerary = await itineraryService.getPublicItineraryById(id);
        if (!itinerary) return res.status(404).json({ error: "Itinerario non trovato" });
        res.status(200).json(itinerary);
    } catch (error) {
        next(error);
    }
});

// POST /api/itineraries/copy/:id - Clone an itinerary (public or owned) to current user
router.post("/copy/:id", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        if (!userId || Number.isNaN(userId)) return res.status(401).json({ error: "Unauthorized" });

        const sourceId = Number(req.params.id);
        if (!sourceId || Number.isNaN(sourceId)) return res.status(400).json({ error: "ID non valido" });

        const cloned = await itineraryService.cloneItineraryById(sourceId, userId);
        res.status(200).json(cloned);
    } catch (error) {
        next(error);
    }
});

// POST /api/itineraries - Create or update an itinerary
router.post("/", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        if (!userId || Number.isNaN(userId)) return res.status(401).json({ error: "Unauthorized" });

        // Validate request body
        const validatedData = itinerarySchema.parse(req.body);

        const itinerary = await itineraryService.saveItinerary(userId, validatedData);
        res.status(200).json(itinerary);
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/me - Get all itineraries for the logged user
router.get("/me", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        if (!userId || Number.isNaN(userId)) return res.status(401).json({ error: "Unauthorized" });

        const itineraries = await itineraryService.getUserItineraries(userId);
        res.status(200).json(itineraries);
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/favorites - Get all favorited itineraries for the logged user
router.get("/favorites", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        if (!userId || Number.isNaN(userId)) return res.status(401).json({ error: "Unauthorized" });

        const favorites = await itineraryService.getUserFavorites(userId);
        res.status(200).json(favorites);
    } catch (error) {
        next(error);
    }
});

// POST /api/itineraries/:id/favorite - Add an itinerary to favorites
router.post("/:id/favorite", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const itineraryId = Number(req.params.id);
        if (!userId || !itineraryId) return res.status(400).json({ error: "Parametri non validi" });

        await itineraryService.addFavorite(userId, itineraryId);
        res.status(200).json({ message: "Aggiunto ai preferiti" });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/itineraries/:id/favorite - Remove an itinerary from favorites
router.delete("/:id/favorite", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const itineraryId = Number(req.params.id);
        if (!userId || !itineraryId) return res.status(400).json({ error: "Parametri non validi" });

        await itineraryService.removeFavorite(userId, itineraryId);
        res.status(200).json({ message: "Rimosso dai preferiti" });
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/:id/favorite-status - Check if an itinerary is favorited
router.get("/:id/favorite-status", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const itineraryId = Number(req.params.id);
        if (!userId || !itineraryId) return res.status(400).json({ error: "Parametri non validi" });

        const isFavorite = await itineraryService.getFavoriteStatus(userId, itineraryId);
        res.status(200).json({ isFavorite });
    } catch (error) {
        next(error);
    }
});

// GET /api/itineraries/:id - Get a single itinerary by ID (owner only)
router.get("/:id", authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.user?.userId);
        const id = Number(req.params.id);
        if (!userId || !id) return res.status(400).json({ error: "Parametri non validi" });

        const itinerary = await itineraryService.getItineraryById(id, userId);
        if (!itinerary) return res.status(404).json({ error: "Itinerario non trovato" });
        res.status(200).json(itinerary);
    } catch (error) {
        next(error);
    }
});

export default router;

