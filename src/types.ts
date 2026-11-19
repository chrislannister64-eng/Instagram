export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  hasStory: boolean;
  followedByMe: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  image: string;
  /** width / height, e.g. 1 (square), 0.8 (4:5 portrait), 1.78 (16:9) */
  aspectRatio: number;
  caption: string;
  likes: number;
  likedByMe: boolean;
  saved: boolean;
  comments: Comment[];
  createdAt: number;
}

export type NotificationType = 'like' | 'comment' | 'follow';

export interface AppNotification {
  id: string;
  type: NotificationType;
  userId: string;
  postId?: string;
  text?: string;
  createdAt: number;
}

export interface Story {
  id: string;
  userId: string;
  imageUrl: string;
  createdAt: number;
}

export interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: number;
}

export interface Conversation {
  /** The other person's user id (one conversation per user). */
  userId: string;
  messages: Message[];
  unread: number;
}

export type TabKey = 'home' | 'explore' | 'create' | 'activity' | 'profile' | 'messages';
