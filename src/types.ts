
export type Building = {
    id: string;
    name: string;
    address: string;
    ownerId: string;
    createdAt: any; // Firestore Timestamp
    floors: number;
    units: number;
};
