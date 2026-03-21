export interface UserProfile {
  uid: string;
  displayName: string;
  bio?: string;
  photoURL?: string;
  email: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdBy: string;
  members: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  forwardedFrom?: string;
  reactions?: {
    [emoji: string]: string[];
  };
}

export interface DMRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface DM {
  id: string;
  members: string[];
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
