import { z } from "zod";

const itineraryItemSchema = z.object({
    id: z.coerce.number().optional(),
    itemTypeCode: z.enum(["ACTIVITY", "ACCOMMODATION", "TRANSPORT"]),
    dayNumber: z.coerce.number().int().min(1),
    orderInt: z.coerce.number().int().min(1),
    title: z.string().max(120).optional().nullable(),
    note: z.string().max(400).optional().nullable(),
    plannedStartAt: z.string().datetime({ offset: true }).optional().nullable(),
    plannedEndAt: z.string().datetime({ offset: true }).optional().nullable(),
    groupName: z.string().max(120).optional().nullable(),
    groupStartAt: z.string().datetime({ offset: true }).optional().nullable(),
    groupEndAt: z.string().datetime({ offset: true }).optional().nullable(),
    activityId: z.coerce.number().int().positive().optional().nullable(),
    accommodationId: z.coerce.number().int().positive().optional().nullable(),
});

export const itinerarySchema = z.object({
    id: z.coerce.number().optional(),
    copyFromId: z.coerce.number().int().positive().optional(),
    name: z.string().min(3, "Il nome deve avere almeno 3 caratteri").optional(),
    description: z.string().nullish(),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullish(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullish(),
    isPublished: z.boolean().optional(),
    visibilityCode: z.string().optional(),
    locationId: z.coerce.number().int().positive().optional().nullable(),
    chatSessionId: z.coerce.number().int().positive().optional().nullable(),
    items: z.array(itineraryItemSchema).optional(),
});
