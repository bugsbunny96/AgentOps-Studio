/**
 * Blog — Mongoose model
 *
 * Posts are created in the Super Admin portal and rendered on /blog (public).
 * Status lifecycle: draft → published (publishedAt is set on first publish).
 * Slugs are auto-generated from the title and guaranteed unique.
 */

import mongoose, { Schema, Document } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type BlogStatus = 'draft' | 'published';

export interface IBlogPost extends Document {
  slug:        string;
  title:       string;
  subtitle:    string;
  body:        string;          // Markdown
  coverImage?: string;          // URL
  author:      string;          // Super admin display name
  tags:        string[];
  status:      BlogStatus;
  publishedAt?: Date;
  createdAt:   Date;
  updatedAt:   Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const BlogPostSchema = new Schema<IBlogPost>(
  {
    slug: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
      lowercase: true,
      index:    true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    subtitle: {
      type:    String,
      default: '',
      trim:    true,
    },
    body: {
      type:     String,
      required: true,
    },
    coverImage: {
      type: String,
    },
    author: {
      type:    String,
      default: 'AgentOps Team',
      trim:    true,
    },
    tags: {
      type:    [String],
      default: [],
    },
    status: {
      type:    String,
      enum:    ['draft', 'published'],
      default: 'draft',
      index:   true,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'blog_posts',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ tags: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const BlogPostModel = mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);
