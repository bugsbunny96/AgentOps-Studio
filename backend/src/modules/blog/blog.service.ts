/**
 * Blog Service — CRUD for BlogPost documents.
 *
 * Slug generation: kebab-case from title, suffixed with random hex if collision.
 * Status transitions: draft → published sets publishedAt; published → draft clears it.
 */

import { BlogPostModel, type BlogStatus } from './blog.model';
import { BadRequest, NotFound } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title);
  if (!base) throw BadRequest('Title cannot be empty', 'INVALID_TITLE');

  let candidate = base;
  let attempt   = 0;

  while (true) {
    const query: Record<string, unknown> = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await BlogPostModel.findOne(query).lean();
    if (!existing) return candidate;

    attempt++;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 10) throw new Error('Could not generate unique slug — try a different title');
  }
}

function parseTags(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateBlogInput {
  title:       string;
  subtitle?:   string;
  body:        string;
  coverImage?: string;
  author?:     string;
  tags?:       string | string[];
  status?:     BlogStatus;
}

export async function createPost(data: CreateBlogInput, saEmail: string) {
  const slug        = await generateUniqueSlug(data.title);
  const status      = data.status === 'published' ? 'published' : 'draft';
  const publishedAt = status === 'published' ? new Date() : undefined;

  const post = await BlogPostModel.create({
    slug,
    title:       data.title.trim(),
    subtitle:    data.subtitle?.trim() ?? '',
    body:        data.body,
    coverImage:  data.coverImage?.trim() || undefined,
    author:      data.author?.trim() || saEmail,
    tags:        data.tags ? parseTags(data.tags) : [],
    status,
    publishedAt,
  });

  logger.info('Blog post created', { slug, status, author: saEmail });
  return post;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateBlogInput {
  title?:      string;
  subtitle?:   string;
  body?:       string;
  coverImage?: string;
  author?:     string;
  tags?:       string | string[];
  status?:     BlogStatus;
}

export async function updatePost(id: string, data: UpdateBlogInput) {
  const post = await BlogPostModel.findById(id);
  if (!post) throw NotFound('Blog post');

  if (data.title && data.title !== post.title) {
    post.slug = await generateUniqueSlug(data.title, id);
    post.title = data.title.trim();
  }
  if (data.subtitle !== undefined) post.subtitle = data.subtitle.trim();
  if (data.body      !== undefined) post.body     = data.body;
  if (data.coverImage !== undefined) post.coverImage = data.coverImage?.trim() || undefined;
  if (data.author    !== undefined) post.author   = data.author.trim();
  if (data.tags      !== undefined) post.tags     = parseTags(data.tags);

  // Status transition
  if (data.status && data.status !== post.status) {
    post.status = data.status;
    if (data.status === 'published' && !post.publishedAt) {
      post.publishedAt = new Date();
    } else if (data.status === 'draft') {
      post.publishedAt = undefined;
    }
  }

  await post.save();
  logger.info('Blog post updated', { id, status: post.status });
  return post;
}

// ─── Toggle Status ────────────────────────────────────────────────────────────

export async function togglePostStatus(id: string) {
  const post = await BlogPostModel.findById(id);
  if (!post) throw NotFound('Blog post');

  if (post.status === 'draft') {
    post.status = 'published';
    if (!post.publishedAt) post.publishedAt = new Date();
  } else {
    post.status = 'draft';
  }

  await post.save();
  return post;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePost(id: string) {
  const post = await BlogPostModel.findByIdAndDelete(id);
  if (!post) throw NotFound('Blog post');
  logger.info('Blog post deleted', { id });
  return { deleted: true };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ListBlogOptions {
  status?: BlogStatus;
  tag?:    string;
  page?:   number;
  limit?:  number;
}

export async function listPosts(options: ListBlogOptions = {}) {
  const { status, tag, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (tag)    filter.tags   = tag;

  const [posts, total] = await Promise.all([
    BlogPostModel.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-body') // list view: omit body for performance
      .lean(),
    BlogPostModel.countDocuments(filter),
  ]);

  return { posts, total, page, limit };
}

// ─── Get by ID or Slug ────────────────────────────────────────────────────────

export async function getPost(idOrSlug: string) {
  // Try by ObjectId first, fall back to slug
  const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
  const post = isObjectId
    ? await BlogPostModel.findById(idOrSlug).lean()
    : await BlogPostModel.findOne({ slug: idOrSlug }).lean();

  if (!post) throw NotFound('Blog post');
  return post;
}
