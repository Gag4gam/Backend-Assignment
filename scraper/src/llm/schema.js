import { z } from 'zod';

// 1. Input Validation Schema (incoming body for POST /enrich)
export const EnrichInputSchema = z.object({
  title: z.string().min(1, 'title is required and cannot be empty'),
  price_text: z.string().min(1, 'price_text is required'),
  availability_text: z.string().min(1, 'availability_text is required'),
  rating_text: z.string().nullable().optional(),
  description: z.string().max(4000, 'description exceeds maximum length').nullable().optional()
});

// 2. Permitted Categories (standard JS array)
export const CATEGORIES = [
  'Fiction',
  'Nonfiction',
  'Children',
  'Young Adult',
  'Poetry',
  'Art',
  'Academic',
  'Other'
];

// 3. Output Validation Schema (what the LLM or Stub must return)
export const EnrichOutputSchema = z.object({
  category: z.enum(CATEGORIES),
  summary: z.string().min(1),
  quality_flags: z.array(z.string())
});

// 4. Stub response satisfying the output schema
export const STUB_RESPONSE = {
  category: 'Fiction',
  summary: 'A poetic and whimsical collection of illustrated verses exploring imagination.',
  quality_flags: []
};