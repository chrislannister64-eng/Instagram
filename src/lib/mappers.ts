import { AppNotification, Comment, Message, Post, Story, User } from '../types';

/*
 * The database uses snake_case and its own row shapes. The UI uses the friendlier
 * types in ../types. These functions are the translation layer between the two,
 * so components never need to know what the database looks like.
 */

export interface ProfileRow {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  followers?: number;
  following?: number;
}

export interface CommentRow {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface PostRow {
  id: string;
  user_id: string;
  image_url: string;
  aspect_ratio: number | string;
  caption: string;
  created_at: string;
  likes?: { user_id: string }[];
  saves?: { user_id: string }[];
  comments?: CommentRow[];
}

export interface NotificationRow {
  id: string;
  type: 'like' | 'comment' | 'follow';
  actor_id: string;
  post_id: string | null;
  text: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  read_at: string | null;
}

export interface StoryRow {
  id: string;
  user_id: string;
  image_url: string;
  created_at: string;
}

const time = (iso: string) => Date.parse(iso);

/** Shown for people who haven't uploaded a profile picture (generated from their username). */
export const placeholderAvatar = (username: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(username || '?')}&background=efefef&color=262626&size=150`;

export function mapProfile(row: ProfileRow, followedByMe: boolean, hasStory: boolean): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    bio: row.bio,
    avatar: row.avatar_url ?? placeholderAvatar(row.username),
    followers: row.followers ?? 0,
    following: row.following ?? 0,
    hasStory,
    followedByMe,
  };
}

export function mapComment(row: CommentRow): Comment {
  return { id: row.id, userId: row.user_id, text: row.text, createdAt: time(row.created_at) };
}

export function mapPost(row: PostRow, meId: string): Post {
  const likes = row.likes ?? [];
  return {
    id: row.id,
    userId: row.user_id,
    image: row.image_url,
    aspectRatio: Number(row.aspect_ratio),
    caption: row.caption,
    likes: likes.length,
    likedByMe: likes.some((l) => l.user_id === meId),
    // The "saves" table is private, so any row returned is the current user's own.
    saved: (row.saves ?? []).length > 0,
    comments: (row.comments ?? []).map(mapComment).sort((a, b) => a.createdAt - b.createdAt),
    createdAt: time(row.created_at),
  };
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    userId: row.actor_id,
    postId: row.post_id ?? undefined,
    text: row.text ?? undefined,
    createdAt: time(row.created_at),
  };
}

export function mapStory(row: StoryRow): Story {
  return { id: row.id, userId: row.user_id, imageUrl: row.image_url, createdAt: time(row.created_at) };
}

/** Converts a message row into (who the chat is with, the message as the UI sees it, is it unread incoming). */
export function mapMessage(row: MessageRow, meId: string) {
  const fromMe = row.sender_id === meId;
  const message: Message = { id: row.id, fromMe, text: row.text, createdAt: time(row.created_at) };
  return {
    otherId: fromMe ? row.receiver_id : row.sender_id,
    message,
    unread: !fromMe && row.read_at === null,
  };
}
