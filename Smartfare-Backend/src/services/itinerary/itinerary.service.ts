import { createHash } from "crypto";
import prisma from "../../config/prisma";

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
    imageUrl: string;
};

const DEFAULT_ITINERARY_IMAGE_URL = "https://images.trvl-media.com/place/6046257/dfc1097b-fb0b-4d2f-96f5-15d86e72f134.jpg";

export class ItineraryService {

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

    private normalizeDraftIdentity(data: any): NormalizedDraftIdentity {
        return {
            name: data?.name || "Il mio Viaggio",
            description: data?.description ?? null,
            startDate: data?.startDate ? new Date(data.startDate) : null,
            endDate: data?.endDate ? new Date(data.endDate) : null,
            isPublished: data?.isPublished === true,
            visibilityCode: data?.visibilityCode || "PRIVATE",
            locationId: data?.locationId ? Number(data.locationId) : null,
            imageUrl: data?.imageUrl || DEFAULT_ITINERARY_IMAGE_URL
        };
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
                endDate: identity.endDate?.toISOString() ?? null
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
            const { id, locationId } = data;
            const draftPayload = this.normalizeDraftIdentity(data);
            const rawItems = this.buildItemData(data);
            const { items, droppedItems } = await this.sanitizeItemReferences(draftPayload.locationId, rawItems);

            if (droppedItems.length > 0) {
                console.warn('Itinerary items dropped because of invalid POI references', {
                    userId,
                    locationId: draftPayload.locationId,
                    droppedItems
                });
            }

            if (rawItems.length > 0 && items.length === 0) {
                throw new Error('Tutti gli item dell’itinerario sono stati scartati perché non validi per la destinazione selezionata');
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
                    await tx.itinerary.update({
                        where: { id: Number(id) },
                        data: {
                            name: draftPayload.name,
                            description: draftPayload.description,
                            startDate: draftPayload.startDate,
                            endDate: draftPayload.endDate,
                            isPublished: draftPayload.isPublished,
                            imageUrl: draftPayload.imageUrl,
                            location: locationId ? { connect: { id: Number(locationId) } } : { disconnect: true },
                            visibility: {
                                connect: { code: draftPayload.visibilityCode }
                            }
                        }
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

                return this.withLocation(updated);
            }

            // If no ID is provided, reuse the most recent matching draft instead of creating duplicates.
            const createdWithItems = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(${this.buildDraftLockKey(userId, draftPayload, items)})`;

                const matchingDraft = await tx.itinerary.findFirst({
                    where: {
                        userId,
                        name: draftPayload.name,
                        description: draftPayload.description,
                        startDate: draftPayload.startDate,
                        endDate: draftPayload.endDate,
                        isPublished: draftPayload.isPublished,
                        visibilityCode: draftPayload.visibilityCode,
                        locationId: draftPayload.locationId,
                        imageUrl: draftPayload.imageUrl
                    },
                    orderBy: { updatedAt: 'desc' },
                    include: this.getItineraryInclude()
                });

                if (matchingDraft) {
                    await tx.itinerary.update({
                        where: { id: matchingDraft.id },
                        data: {
                            name: draftPayload.name,
                            description: draftPayload.description,
                            startDate: draftPayload.startDate,
                            endDate: draftPayload.endDate,
                            isPublished: draftPayload.isPublished,
                            imageUrl: draftPayload.imageUrl,
                            ...(draftPayload.locationId
                                ? { location: { connect: { id: draftPayload.locationId } } }
                                : { location: { disconnect: true } }),
                            visibility: {
                                connect: { code: draftPayload.visibilityCode }
                            }
                        }
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
                    ...draftPayload,
                    user: {
                        connect: { id: userId }
                    },
                    visibility: {
                        connect: { code: draftPayload.visibilityCode }
                    }
                };

                // Remove visibilityCode and locationId from createData since we use relations instead
                delete createData.visibilityCode;
                delete createData.locationId;

                if (draftPayload.locationId) {
                    createData.location = {
                        connect: { id: draftPayload.locationId }
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

            return this.withLocation(createdWithItems);
        } catch (error) {
            console.error("Errore salvataggio itinerario:", error);
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
                take: 12,
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
}
