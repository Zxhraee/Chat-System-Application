export interface Message {
    id: string;
    channelId: string;
    userId: string;
    username: string;
    text: string;
    timestamp: number;
    avatarUrl?: string;
    imageUrl?: string;
}