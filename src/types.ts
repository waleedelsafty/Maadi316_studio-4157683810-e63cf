
export type Building = {
    id: string;
    name: string;
    address: string;
    ownerId: string;
    createdAt: any; // Firestore Timestamp
    floors: number;
    units: number;
    hasBasement?: boolean;
    basementCount?: number;
    hasMezzanine?: boolean;
    mezzanineCount?: number;
};

export type Level = {
    id: string;
    name: string;
    type: 'Basement' | 'Ground' | 'Mezzanine' | 'Typical Floor' | 'Penthouse' | 'Rooftop';
    floorNumber?: number;
    createdAt: any; // Firestore Timestamp
};
