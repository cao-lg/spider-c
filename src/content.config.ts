import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 内容集合只负责"正文"。
//
// v2 变更:frontmatter 收敛为单一 id。
// 原来 title/duration/goals 等元数据在 course.ts 与每篇 mdx 里各写一份,已经漂移过
// (课时 30 vs 35、目标 3 条 vs 4 条),而构建不会报错。现在元数据的唯一来源是
// src/data/course.ts,mdx 只留 id 用于把正文挂到课程上。
const tutorials = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/tutorials' }),
  schema: z.object({
    /** 必须与 src/data/course.ts 中某节课的 id 一致 */
    id: z.string(),
  }),
});

export const collections = { tutorials };
