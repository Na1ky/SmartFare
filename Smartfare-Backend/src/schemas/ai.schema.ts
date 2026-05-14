import { z } from 'zod';

const itineraryItemSchema = z.object({
  id: z.coerce.number().optional(),
  dayNumber: z.coerce.number().int().min(1),
  orderInt: z.coerce.number().int().min(1),
  note: z.string().max(400).optional().nullable(),
  itemTypeCode: z.enum(['ACTIVITY', 'ACCOMMODATION', 'TRANSPORT']),
  activityId: z.coerce.number().int().positive().optional().nullable(),
  accommodationId: z.coerce.number().int().positive().optional().nullable(),
  plannedStartAt: z.string().optional().nullable(),
  plannedEndAt: z.string().optional().nullable(),
  groupName: z.string().optional().nullable(),
  groupStartAt: z.string().optional().nullable(),
  groupEndAt: z.string().optional().nullable(),
});

export const aiItineraryChatSchema = z.object({
  message: z.string().min(1, 'Il messaggio non può essere vuoto').max(2000),
  locationId: z.coerce.number().int().positive().optional(),
  itinerary: z.object({
    id: z.coerce.number().optional(),
    name: z.string().optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    locationId: z.coerce.number().int().positive().optional().nullable(),
    items: z.array(itineraryItemSchema).optional(),
  }).optional().nullable(),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).optional(),
  preferences: z.object({
    style: z.string().max(120).optional(),
    pace: z.string().max(120).optional(),
    interests: z.array(z.string().max(80)).max(12).optional(),
    language: z.string().max(12).optional(),
  }).optional(),
});
