import { createHash } from "crypto";
import prisma from "../../config/prisma";
import { ImageService } from "../image/image.service";
import { EmailService } from "../email/email.service";

type DraftItemPayload = {
    itemTypeCode: string;
    dayNumber: number;
    orderInt: number;
    note: string | null;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    groupName: string | null;
    groupStartAt: Date | null;
    groupEndAt: Date | null;
    activityId: number | null;
    accommodationId: number | null;
};

type SanitizedItemsResult = {
    items: DraftItemPayload[];
    droppedItems: Array<{
        index: number;
        reason: string;
        itemTypeCode: string;
        activityId: number | null;
        accommodationId: number | null;
    }>;
};

type NormalizedDraftIdentity = {
    name: string;
    description: string | null;
    startDate: Date | null;
    endDate: Date | null;
    isPublished: boolean;
    visibilityCode: string;
    locationId: number | null;
    chatSessionId: number | null;
    imageUrl: string;
};

const DEFAULT_ITINERARY_IMAGE_URL = "https://images.trvl-media.com/place/6046257/dfc1097b-fb0b-4d2f-96f5-15d86e72f134.jpg";

export class ItineraryService {
    private imageService: ImageService;
    private emailService: EmailService;

    constructor() {
        this.imageService = new ImageService();
        this.emailService = new EmailService();
    }

    private getItineraryInclude() {
        return {
            items: {
                orderBy: [
                    { dayNumber: 'asc' as const },
                    { orderInt: 'asc' as const }
                ],
                select: {
                    id: true,
                    itineraryId: true,
                    itemTypeCode: true,
                    dayNumber: true,
                    orderInt: true,
                    note: true,
                    plannedStartAt: true,
                    plannedEndAt: true,
                    groupName: true,
                    groupStartAt: true,
                    groupEndAt: true,
                    activityId: true,
                    accommodationId: true,
                    activity: { select: { id: true, name: true, categoryId: true } },
                    accommodation: { select: { id: true, name: true } },
                    itemType: { select: { code: true, label: true } }
                }
            }
        };
    }

    private buildItemData(data: any): DraftItemPayload[] {
        return (data?.items || []).map((item: any): DraftItemPayload => ({
            itemTypeCode: item.itemTypeCode,
            dayNumber: Number(item.dayNumber || 1),
            orderInt: Number(item.orderInt || 1),
            note: item.note || null,
            plannedStartAt: item.plannedStartAt ? new Date(item.plannedStartAt) : null,
            plannedEndAt: item.plannedEndAt ? new Date(item.plannedEndAt) : null,
            groupName: item.groupName || null,
            groupStartAt: item.groupStartAt ? new Date(item.groupStartAt) : null,
            groupEndAt: item.groupEndAt ? new Date(item.groupEndAt) : null,
            activityId: item.activityId ? Number(item.activityId) : null,
            accommodationId: item.accommodationId ? Number(item.accommodationId) : null
        }));
    }

    private async sanitizeItemReferences(locationId: number | null, items: DraftItemPayload[]): Promise<SanitizedItemsResult> {
        if (!locationId || items.length === 0) {
            return { items, droppedItems: [] };
        }

        const requestedActivityIds = Array.from(
            new Set(items.map((item) => item.activityId).filter((value): value is number => Boolean(value)))
        );
        const requestedAccommodationIds = Array.from(
            new Set(items.map((item) => item.accommodationId).filter((value): value is number => Boolean(value)))
        );

        const [activities, accommodations] = await Promise.all([
            requestedActivityIds.length > 0
                ? prisma.activity.findMany({
                    where: {
                        id: { in: requestedActivityIds },
                        locationId
                    },
                    select: { id: true }
                })
                : Promise.resolve([]),
            requestedAccommodationIds.length > 0
                ? prisma.accommodation.findMany({
                    where: {
                        id: { in: requestedAccommodationIds },
                        locationId
                    },
                    select: { id: true }
                })
                : Promise.resolve([])
        ]);

        const validActivityIds = new Set(activities.map((entry) => entry.id));
        const validAccommodationIds = new Set(accommodations.map((entry) => entry.id));
        const droppedItems: SanitizedItemsResult['droppedItems'] = [];

        const validItems = items.filter((item, index) => {
            if (item.itemTypeCode === 'ACTIVITY') {
                if (!item.activityId || !validActivityIds.has(item.activityId)) {
                    droppedItems.push({
                        index,
                        reason: 'invalid_activity_reference',
                        itemTypeCode: item.itemTypeCode,
                        activityId: item.activityId,
                        accommodationId: item.accommodationId
                    });
                    return false;
                }
            }

            if (item.itemTypeCode === 'ACCOMMODATION') {
                if (!item.accommodationId || !validAccommodationIds.has(item.accommodationId)) {
                    droppedItems.push({
                        index,
                        reason: 'invalid_accommodation_reference',
                        itemTypeCode: item.itemTypeCode,
                        activityId: item.activityId,
                        accommodationId: item.accommodationId
                    });
                    return false;
                }
            }

            return true;
        });

        const normalizedItems = this.reindexItems(validItems);
        return {
            items: normalizedItems,
            droppedItems
        };
    }

    private reindexItems(items: DraftItemPayload[]): DraftItemPayload[] {
        const counters = new Map<number, number>();

        return items
            .slice()
            .sort((left, right) => {
                if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
                return left.orderInt - right.orderInt;
            })
            .map((item) => {
                const nextOrder = (counters.get(item.dayNumber) || 0) + 1;
                counters.set(item.dayNumber, nextOrder);
                return {
                    ...item,
                    orderInt: nextOrder
                };
            });
    }

    private async withLocation(itinerary: any) {
        if (!itinerary) return itinerary;
        if (!itinerary.locationId) return { ...itinerary, location: null };

        const location = await prisma.location.findUnique({ where: { id: itinerary.locationId } });
        return { ...itinerary, location };
    }

    private normalizeDraftIdentity(data: any, oldImageUrl?: string): NormalizedDraftIdentity {
        return {
            name: data?.name || "Il mio Viaggio",
            description: data?.description ?? null,
            startDate: data?.startDate ? new Date(data.startDate) : null,
            endDate: data?.endDate ? new Date(data.endDate) : null,
            isPublished: data?.isPublished === true,
            visibilityCode: data?.visibilityCode || "PRIVATE",
            locationId: data?.locationId ? Number(data.locationId) : null,
            chatSessionId: data?.chatSessionId ? Number(data.chatSessionId) : null,
            imageUrl: data?.imageUrl || oldImageUrl || DEFAULT_ITINERARY_IMAGE_URL
        };
    }

    /**
     * Enriches the draft payload with an image from Location.image (cached)
     * If Location.image is null, fetches from Unsplash and caches it
     * 
     * This ensures:
     * 1. First itinerary for a location → API call + cache
     * 2. Subsequent itineraries → uses cached image (no API call)
     */
    private async enrichDraftPayloadWithImage(
        draftPayload: NormalizedDraftIdentity,
        locationId: number | null
    ): Promise<NormalizedDraftIdentity> {
        // Only fetch image if:
        // 1. locationId exists
        // 2. imageUrl is the DEFAULT (not customized by user)
        if (
            locationId &&
            draftPayload.imageUrl === DEFAULT_ITINERARY_IMAGE_URL
        ) {
            try {
                // Get location with cached image
                const location = await prisma.location.findUnique({
                    where: { id: locationId },
                    select: { id: true, name: true, image: true }
                });

                if (location) {
                    // If image is already cached, use it
                    if (location.image) {
                        return {
                            ...draftPayload,
                            imageUrl: location.image
                        };
                    }

                    // If not cached, fetch from Unsplash and save to Location.
                    // If Unsplash is unavailable, use a destination-aware fallback without caching it.
                    const fetchedImageUrl = await this.imageService.getLocationImage(location.name);
                    if (fetchedImageUrl) {
                        // Cache it in Location.image for future use
                        await prisma.location.update({
                            where: { id: location.id },
                            data: { image: fetchedImageUrl }
                        });

                        return {
                            ...draftPayload,
                            imageUrl: fetchedImageUrl
                        };
                    }

                    return {
                        ...draftPayload,
                        imageUrl: this.imageService.getDefaultLocationImage(location.name)
                    };
                }
            } catch (error) {
                console.warn(
                    `Failed to enrich itinerary with automatic image for location ${locationId}:`,
                    error instanceof Error ? error.message : 'Unknown error'
                );
                // Fall through to return original payload with default image
            }
        }

        return draftPayload;
    }

    private normalizeItemForComparison(item: DraftItemPayload) {
        return {
            itemTypeCode: item.itemTypeCode,
            dayNumber: item.dayNumber,
            orderInt: item.orderInt,
            note: item.note,
            plannedStartAt: item.plannedStartAt,
            plannedEndAt: item.plannedEndAt,
            groupName: item.groupName,
            groupStartAt: item.groupStartAt,
            groupEndAt: item.groupEndAt,
            activityId: item.activityId,
            accommodationId: item.accommodationId
        };
    }

    private buildDraftLockKey(userId: number, identity: NormalizedDraftIdentity, items: DraftItemPayload[]) {
        const payload = JSON.stringify({
            userId,
            identity: {
                ...identity,
                startDate: identity.startDate?.toISOString() ?? null,
                endDate: identity.endDate?.toISOString() ?? null,
                chatSessionId: identity.chatSessionId
            },
            items: items
                .slice()
                .sort((left, right) => {
                    if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
                    if (left.orderInt !== right.orderInt) return left.orderInt - right.orderInt;
                    if (left.itemTypeCode !== right.itemTypeCode) return left.itemTypeCode.localeCompare(right.itemTypeCode);
                    return (left.activityId ?? left.accommodationId ?? 0) - (right.activityId ?? right.accommodationId ?? 0);
                })
                .map((item) => this.normalizeItemForComparison(item))
        });

        const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16);
        return BigInt(`0x${hash}`) & BigInt('0x7fffffffffffffff');
    }

    async saveItinerary(userId: number, data: any) {
        try {
            const { id, copyFromId, locationId } = data;

            // If updating, preserve the old imageUrl if not explicitly provided
            let oldImageUrl: string | undefined;
            if (id) {
                const existing = await prisma.itinerary.findUnique({
                    where: { id: Number(id) },
                    select: { imageUrl: true }
                });
                oldImageUrl = existing?.imageUrl;
            }

            const draftPayload = this.normalizeDraftIdentity(data, oldImageUrl);

            // Enrich payload with automatic image from Google Places if locationId exists
            const enrichedDraftPayload = await this.enrichDraftPayloadWithImage(
                draftPayload,
                draftPayload.locationId
            );

            const rawItems = this.buildItemData(data);
            const { items, droppedItems } = await this.sanitizeItemReferences(enrichedDraftPayload.locationId, rawItems);

            if (droppedItems.length > 0) {
                console.warn('Itinerary items dropped because of invalid POI references', {
                    userId,
                    locationId: enrichedDraftPayload.locationId,
                    droppedItems
                });
            }

            if (rawItems.length > 0 && items.length === 0) {
                throw new Error('Tutti gli item dell’itinerario sono stati scartati perché non validi per la destinazione selezionata');
            }

            if (copyFromId) {
                const cloned = await prisma.$transaction(async (tx) => {
                    const source = await tx.itinerary.findFirst({
                        where: {
                            id: Number(copyFromId),
                            OR: [
                                { userId },
                                { isPublished: true },
                                { visibilityCode: 'PUBLIC' }
                            ]
                        },
                        include: {
                            items: {
                                orderBy: [
                                    { dayNumber: 'asc' as const },
                                    { orderInt: 'asc' as const }
                                ]
                            }
                        }
                    });

                    if (!source) {
                        throw new Error('Itinerario non trovato o non autorizzato');
                    }

                    const sourceIdentity = this.normalizeDraftIdentity({
                        name: data?.name || `${source.name} (Copia)`,
                        description: data?.description ?? source.description,
                        startDate: data?.startDate ?? source.startDate,
                        endDate: data?.endDate ?? source.endDate,
                        isPublished: data?.isPublished ?? false,
                        visibilityCode: data?.visibilityCode || 'PRIVATE',
                        locationId: data?.locationId ?? source.locationId,
                        chatSessionId: data?.chatSessionId ?? null,
                        imageUrl: data?.imageUrl || source.imageUrl || DEFAULT_ITINERARY_IMAGE_URL
                    });

                    const sourceItems = this.reindexItems(this.buildItemData({ items: source.items }));
                    const clonedItems = (await this.sanitizeItemReferences(sourceIdentity.locationId, sourceItems)).items;

                    const createData: any = {
                        name: sourceIdentity.name,
                        description: sourceIdentity.description,
                        startDate: sourceIdentity.startDate,
                        endDate: sourceIdentity.endDate,
                        isPublished: sourceIdentity.isPublished,
                        imageUrl: sourceIdentity.imageUrl,
                        user: {
                            connect: { id: userId }
                        },
                        visibility: {
                            connect: { code: sourceIdentity.visibilityCode }
                        }
                    };

                    if (sourceIdentity.locationId) {
                        createData.location = { connect: { id: sourceIdentity.locationId } };
                    }

                    if (sourceIdentity.chatSessionId) {
                        createData.chatSession = { connect: { id: sourceIdentity.chatSessionId } };
                    }

                    const created = await tx.itinerary.create({ data: createData });

                    if (clonedItems.length > 0) {
                        await tx.itineraryItem.createMany({
                            data: clonedItems.map((item: DraftItemPayload) => ({
                                ...item,
                                itineraryId: created.id
                            }))
                        });
                    }

                    return tx.itinerary.findUnique({
                        where: { id: created.id },
                        include: this.getItineraryInclude()
                    });
                }, { maxWait: 10000, timeout: 15000 });

                return this.withLocation(cloned);
            }

            // If an ID is provided, we try to update
            if (id) {
                const existing = await prisma.itinerary.findFirst({
                    where: { id: Number(id), userId }
                });

                if (!existing) {
                    throw new Error("Itinerario non trovato o non autorizzato");
                }

                const updated = await prisma.$transaction(async (tx) => {
                    const updateData: any = {
                        name: enrichedDraftPayload.name,
                        description: enrichedDraftPayload.description,
                        startDate: enrichedDraftPayload.startDate,
                        endDate: enrichedDraftPayload.endDate,
                        isPublished: enrichedDraftPayload.isPublished,
                        imageUrl: enrichedDraftPayload.imageUrl,
                        visibility: {
                            connect: { code: enrichedDraftPayload.visibilityCode }
                        }
                    };

                    if (locationId) {
                        updateData.location = { connect: { id: Number(locationId) } };
                    } else {
                        updateData.location = { disconnect: true };
                    }

                    if (enrichedDraftPayload.chatSessionId) {
                        updateData.chatSession = { connect: { id: enrichedDraftPayload.chatSessionId } };
                    }

                    const up = await tx.itinerary.update({
                        where: { id: Number(id) },
                        data: updateData
                    });

                    await tx.itineraryItem.deleteMany({
                        where: { itineraryId: Number(id) }
                    });

                    if (items.length > 0) {
                        await tx.itineraryItem.createMany({
                            data: items.map((item: DraftItemPayload) => ({
                                ...item,
                                itineraryId: Number(id)
                            }))
                        });
                    }

                    return tx.itinerary.findUnique({
                        where: { id: Number(id) },
                        include: this.getItineraryInclude()
                    });
                }, { maxWait: 10000, timeout: 15000 });

                // Trigger notification if published now but wasn't before
                if (enrichedDraftPayload.isPublished && !existing.isPublished) {
                    this.notifyFollowers(userId, updated).catch(e => console.error("Async notification error:", e));
                }

                return this.withLocation(updated);
            }

            // If no ID is provided, reuse the most recent matching draft instead of creating duplicates.
            const createdWithItems = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(${this.buildDraftLockKey(userId, enrichedDraftPayload, items)})`;

                const matchingDraft = await tx.itinerary.findFirst({
                    where: {
                        userId,
                        name: enrichedDraftPayload.name,
                        description: enrichedDraftPayload.description,
                        startDate: enrichedDraftPayload.startDate,
                        endDate: enrichedDraftPayload.endDate,
                        isPublished: enrichedDraftPayload.isPublished,
                        visibilityCode: enrichedDraftPayload.visibilityCode,
                        locationId: enrichedDraftPayload.locationId,
                        chatSessionId: enrichedDraftPayload.chatSessionId,
                        imageUrl: enrichedDraftPayload.imageUrl
                    },
                    orderBy: { updatedAt: 'desc' },
                    include: this.getItineraryInclude()
                });

                if (matchingDraft) {
                    const updateData: any = {
                        name: enrichedDraftPayload.name,
                        description: enrichedDraftPayload.description,
                        startDate: enrichedDraftPayload.startDate,
                        endDate: enrichedDraftPayload.endDate,
                        isPublished: enrichedDraftPayload.isPublished,
                        imageUrl: enrichedDraftPayload.imageUrl,
                        visibility: {
                            connect: { code: enrichedDraftPayload.visibilityCode }
                        }
                    };

                    if (enrichedDraftPayload.locationId) {
                        updateData.location = { connect: { id: enrichedDraftPayload.locationId } };
                    } else {
                        updateData.location = { disconnect: true };
                    }

                    if (enrichedDraftPayload.chatSessionId) {
                        updateData.chatSession = { connect: { id: enrichedDraftPayload.chatSessionId } };
                    }

                    await tx.itinerary.update({
                        where: { id: matchingDraft.id },
                        data: updateData
                    });

                    await tx.itineraryItem.deleteMany({
                        where: { itineraryId: matchingDraft.id }
                    });

                    if (items.length > 0) {
                        await tx.itineraryItem.createMany({
                            data: items.map((item: DraftItemPayload) => ({
                                ...item,
                                itineraryId: matchingDraft.id
                            }))
                        });
                    }

                    return tx.itinerary.findUnique({
                        where: { id: matchingDraft.id },
                        include: this.getItineraryInclude()
                    });
                }

                const createData: any = {
                    ...enrichedDraftPayload,
                    user: {
                        connect: { id: userId }
                    },
                    visibility: {
                        connect: { code: enrichedDraftPayload.visibilityCode }
                    }
                };

                // Remove visibilityCode, locationId and chatSessionId from createData since we use relations instead
                delete createData.visibilityCode;
                delete createData.locationId;
                delete createData.chatSessionId;

                if (enrichedDraftPayload.locationId) {
                    createData.location = {
                        connect: { id: enrichedDraftPayload.locationId }
                    };
                }

                if (enrichedDraftPayload.chatSessionId) {
                    createData.chatSession = {
                        connect: { id: enrichedDraftPayload.chatSessionId }
                    };
                }

                const created = await tx.itinerary.create({
                    data: createData
                });

                if (items.length > 0) {
                    await tx.itineraryItem.createMany({
                        data: items.map((item: DraftItemPayload) => ({
                            ...item,
                            itineraryId: created.id
                        }))
                    });
                }

                return tx.itinerary.findUnique({
                    where: { id: created.id },
                    include: this.getItineraryInclude()
                });
            }, { maxWait: 10000, timeout: 15000 });

            if (enrichedDraftPayload.isPublished) {
                this.notifyFollowers(userId, createdWithItems).catch(e => console.error("Async notification error:", e));
            }

            return this.withLocation(createdWithItems);
        } catch (error) {
            console.error("Errore salvataggio itinerario:", error);
            throw error;
        }
    }

    async cloneItineraryById(sourceId: number, userId: number) {
        try {
            const cloned = await prisma.$transaction(async (tx) => {
                // Fetch the source itinerary (can be public or owned by user)
                const source = await tx.itinerary.findFirst({
                    where: {
                        id: Number(sourceId),
                        OR: [
                            { userId },
                            { isPublished: true },
                            { visibilityCode: 'PUBLIC' }
                        ]
                    },
                    include: {
                        items: {
                            orderBy: [
                                { dayNumber: 'asc' as const },
                                { orderInt: 'asc' as const }
                            ]
                        }
                    }
                });

                if (!source) {
                    throw new Error("Itinerario non trovato o non autorizzato");
                }

                // Build the new itinerary data
                const createData: any = {
                    name: `${source.name} (Copia)`,
                    description: source.description,
                    startDate: source.startDate,
                    endDate: source.endDate,
                    isPublished: false,
                    visibilityCode: 'PRIVATE',
                    imageUrl: source.imageUrl || DEFAULT_ITINERARY_IMAGE_URL,
                    user: {
                        connect: { id: userId }
                    },
                    visibility: {
                        connect: { code: 'PRIVATE' }
                    }
                };

                if (source.locationId) {
                    createData.location = { connect: { id: source.locationId } };
                }

                // Create the new itinerary
                const created = await tx.itinerary.create({ data: createData });

                // Clone all items from source to new itinerary
                if (source.items && source.items.length > 0) {
                    await tx.itineraryItem.createMany({
                        data: source.items.map((item: any) => ({
                            itemTypeCode: item.itemTypeCode,
                            dayNumber: item.dayNumber,
                            orderInt: item.orderInt,
                            note: item.note,
                            plannedStartAt: item.plannedStartAt,
                            plannedEndAt: item.plannedEndAt,
                            groupName: item.groupName,
                            groupStartAt: item.groupStartAt,
                            groupEndAt: item.groupEndAt,
                            activityId: item.activityId,
                            accommodationId: item.accommodationId,
                            itineraryId: created.id
                        }))
                    });
                }

                // Return the complete cloned itinerary
                return tx.itinerary.findUnique({
                    where: { id: created.id },
                    include: this.getItineraryInclude()
                });
            }, { maxWait: 10000, timeout: 15000 });

            return this.withLocation(cloned);
        } catch (error) {
            console.error("Errore clonazione itinerario:", error);
            throw error;
        }
    }

    async getLatestDraft(userId: number) {
        try {
            const latest = await prisma.itinerary.findFirst({
                where: { userId, isPublished: false },
                orderBy: { updatedAt: 'desc' },
                include: this.getItineraryInclude()
            });

            return this.withLocation(latest);
        } catch (error: any) {
            console.error("Errore recupero bozza:", error);
            if (error?.code === 'P2022') {
                try {
                    const latestBasic = await prisma.itinerary.findFirst({
                        where: { userId, isPublished: false },
                        orderBy: { updatedAt: 'desc' }
                    });
                    if (!latestBasic) return this.withLocation(null);

                    const items = await prisma.itineraryItem.findMany({
                        where: { itineraryId: latestBasic.id },
                        orderBy: [
                            { dayNumber: 'asc' as const },
                            { orderInt: 'asc' as const }
                        ],
                        select: {
                            id: true,
                            itineraryId: true,
                            itemTypeCode: true,
                            dayNumber: true,
                            orderInt: true,
                            note: true,
                            plannedStartAt: true,
                            plannedEndAt: true,
                            groupName: true,
                            groupStartAt: true,
                            groupEndAt: true,
                            activityId: true,
                            accommodationId: true
                        }
                    });

                    const latestWithItems = { ...latestBasic, items };
                    return this.withLocation(latestWithItems);
                } catch (e2) {
                    console.error("Fallback fetch failed:", e2);
                    throw error;
                }
            }
            throw error;
        }
    }

    async getWorkspaceData(locationId: number, userId?: number) {
        const [location, accommodations, activities, categories, draft] = await Promise.all([
            prisma.location.findUnique({ where: { id: locationId } }),
            prisma.accommodation.findMany({ where: { locationId } }),
            prisma.activity.findMany({
                where: { locationId },
                include: { category: true }
            }),
            prisma.activityCategory.findMany({ orderBy: { name: 'asc' } }),
            userId ? this.getLatestDraft(userId) : Promise.resolve(null)
        ]);

        return {
            location,
            accommodations,
            activities,
            categories,
            draft
        };
    }

    async deleteItinerary(id: number, userId: number) {
        try {
            return await prisma.itinerary.delete({
                where: { id, userId }
            });
        } catch (error) {
            console.error("Errore eliminazione itinerario:", error);
            throw error;
        }
    }

    async getPublicItineraries(locationId?: number, excludeUserId?: number) {
        try {
            const itineraries = await prisma.itinerary.findMany({
                where: {
                    OR: [
                        { isPublished: true },
                        { visibilityCode: 'PUBLIC' }
                    ],
                    ...(locationId ? { locationId } : {}),
                    ...(excludeUserId ? { userId: { not: excludeUserId } } : {})
                },
                orderBy: { updatedAt: 'desc' },
                include: {
                    location: true,
                    user: {
                        include: { profile: true }
                    },
                    items: {
                        select: { dayNumber: true }
                    },
                    _count: {
                        select: { items: true }
                    }
                }
            });

            // Compute durationDays from the max dayNumber across all items
            return itineraries.map((itin) => {
                const maxDay = itin.items.length > 0
                    ? Math.max(...itin.items.map((i) => i.dayNumber))
                    : null;
                return { ...itin, durationDays: maxDay };
            });
        } catch (error) {
            console.error("Errore recupero itinerari pubblici:", error);
            throw error;
        }
    }

    async getPublicItineraryById(id: number) {
        try {
            return await prisma.itinerary.findUnique({
                where: {
                    id,
                    OR: [
                        { isPublished: true },
                        { visibilityCode: 'PUBLIC' }
                    ]
                },
                include: this.getItineraryInclude()
            });
        } catch (error) {
            console.error("Errore recupero itinerario pubblico per ID:", error);
            throw error;
        }
    }

    async getUserItineraries(userId: number) {
        try {
            return await prisma.itinerary.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                include: {
                    location: true,
                    items: {
                        take: 3,
                        include: {
                            activity: { select: { imageUrl: true } },
                            accommodation: { select: { imageUrl: true } }
                        }
                    },
                    _count: {
                        select: { items: true }
                    }
                }
            });
        } catch (error) {
            console.error("Errore recupero itinerari utente:", error);
            throw error;
        }
    }

    // ─── Favorites ────────────────────────────────────────────────────────────

    async getUserFavorites(userId: number) {
        try {
            const favorites = await prisma.itineraryFavorite.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: {
                    itinerary: {
                        include: {
                            location: true,
                            user: { include: { profile: true } },
                            _count: { select: { items: true } }
                        }
                    }
                }
            });
            return favorites.map(fav => fav.itinerary);
        } catch (error) {
            console.error("Errore recupero preferiti:", error);
            throw error;
        }
    }

    async addFavorite(userId: number, itineraryId: number) {
        try {
            await prisma.itineraryFavorite.upsert({
                where: { userId_itineraryId: { userId, itineraryId } },
                create: { userId, itineraryId },
                update: {}
            });
        } catch (error) {
            console.error("Errore aggiunta preferito:", error);
            throw error;
        }
    }

    async removeFavorite(userId: number, itineraryId: number) {
        try {
            await prisma.itineraryFavorite.deleteMany({
                where: { userId, itineraryId }
            });
        } catch (error) {
            console.error("Errore rimozione preferito:", error);
            throw error;
        }
    }

    async getFavoriteStatus(userId: number, itineraryId: number): Promise<boolean> {
        const record = await prisma.itineraryFavorite.findUnique({
            where: { userId_itineraryId: { userId, itineraryId } }
        });
        return !!record;
    }

    async getItineraryById(id: number, userId: number) {
        return prisma.itinerary.findFirst({
            where: { id, userId },
            include: this.getItineraryInclude()
        });
    }

    private async notifyFollowers(userId: number, itinerary: any) {
        try {
            const followers = await prisma.follow.findMany({
                where: { followingId: userId },
                include: {
                    follower: {
                        select: {
                            email: true
                        }
                    }
                }
            });

            if (followers.length === 0) return;

            const author = await prisma.user.findUnique({
                where: { id: userId },
                include: { profile: true }
            });

            const authorName = author?.profile ? `${author.profile.name} ${author.profile.surname}`.trim() : author?.email || 'Un utente';
            const frontendUrl = (process.env.FRONTEND_URL || 'https://smartfare.nicolas-dominici.it').replace(/\/+$/, '');
            const profileLink = `${frontendUrl}/profile/${userId}`;
            const itineraryImage = itinerary.imageUrl || "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000";

            // Send emails in parallel but catch errors individually
            const emailPromises = followers.map(f =>
                this.emailService.sendNewItineraryNotification(
                    f.follower.email,
                    authorName,
                    itinerary.name || "Nuovo Viaggio",
                    profileLink,
                    itineraryImage
                ).catch(err => console.error(`Failed to notify follower ${f.follower.email}:`, err))
            );

            await Promise.all(emailPromises);
            console.log(`✅ Notifiche inviate a ${followers.length} follower per l'itinerario ${itinerary.id}`);
        } catch (error) {
            console.error("Errore critico durante la notifica dei follower:", error);
        }
    }
}
