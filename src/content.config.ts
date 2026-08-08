import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tutorials = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/tutorials' }),
  schema: z.object({
    id: z.string(),
    unitId: z.string(),
    order: z.number(),
    title: z.string(),
    summary: z.string(),
    goals: z.array(z.string()).default([]),
    duration: z.number().default(30),
    practiceTarget: z.string().optional(),
    skillDomain: z.array(z.string()).default([]),
  }),
});

export const collections = { tutorials };
