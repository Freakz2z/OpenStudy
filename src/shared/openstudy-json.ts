import { z } from 'zod';

export const OpenStudyJsonQuestionTypeSchema = z.enum([
  'choice',
  'multiple',
  'judge',
  'fill',
  'short',
  'code',
]);

export const OpenStudyJsonQuestionSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    sourceId: z.string().optional(),
    type: OpenStudyJsonQuestionTypeSchema,
    stem: z.string().min(1),
    options: z.array(z.string()).nullable().default(null),
    answer: z.string().min(1),
    explanation: z.string().nullable().default(null),
    pageOrSection: z.string().nullable().default(null),
    tags: z.array(z.string()).optional(),
    topic: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .superRefine((question, ctx) => {
    if (['choice', 'multiple', 'judge', 'code'].includes(question.type) && !question.options?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${question.type} 题型必须提供 options`,
        path: ['options'],
      });
    }
    if (['fill', 'short'].includes(question.type) && question.options && question.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${question.type} 题型不应包含 options`,
        path: ['options'],
      });
    }
  });

export const OpenStudyJsonQuestionSetSchema = z.object({
  version: z.literal('openstudy.question-set.v1'),
  title: z.string().optional(),
  source: z
    .object({
      path: z.string().optional(),
      fileType: z.string().optional(),
      importedAt: z.number().optional(),
    })
    .optional(),
  questions: z.array(OpenStudyJsonQuestionSchema),
});

export type OpenStudyJsonQuestion = z.infer<typeof OpenStudyJsonQuestionSchema>;
export type OpenStudyJsonQuestionSet = z.infer<typeof OpenStudyJsonQuestionSetSchema>;
