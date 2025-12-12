
export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export enum Persona {
  FRIEND = 'friend',
  TUTOR = 'tutor',
}

export interface Attachment {
  type: 'image' | 'video';
  url: string; // Base64 or Blob URL for display
  base64?: string; // Raw base64 for AI processing
  mimeType: string;
}

export interface Reaction {
  emoji: string;
  from: Role;
}

export interface Story {
  id: string;
  imageUrl: string;
  caption: string;
  timestamp: number;
  seen: boolean;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  audioData?: string; // Base64 audio string
  mood?: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
}

export interface UserProfile {
  name: string;
  bio: string; // The "Bestie Bio" (User's life)
  jeffStoryline: string; // Jeff's own life narrative
  topics: string[];
}

// --- NEW FEATURES ---

export interface PlannerItem {
  id: string;
  title: string;
  date: string; // ISO String
  type: 'event' | 'reminder' | 'date';
  completed: boolean;
  notes?: string;
}

export interface Expense {
  id: string;
  item: string;
  amount: number;
  category: 'exam' | 'budget' | 'other';
  date: string;
}

export interface WishlistItem {
  id: string;
  title: string;
  type: 'movie' | 'book' | 'item' | 'other';
  status: 'want' | 'acquired' | 'finished';
  notes?: string;
}

export interface NovelLog {
  id: string;
  title: string;
  author?: string;
  currentChapter: number;
  totalChapters?: number;
  notes: string; // For gossip/fan theories
}

export interface TimerState {
  isActive: boolean;
  duration: number; // in seconds
  remaining: number; // in seconds
  label: string;
}

export interface WalletItem {
  id: string;
  name: string;
  price: number;
  icon: string; // Emoji or Lucide icon name
}

export interface WalletState {
  balance: number;
  inventory: string[]; // List of item IDs bought
}
