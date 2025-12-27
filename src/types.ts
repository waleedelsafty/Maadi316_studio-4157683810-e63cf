
export type Building = {
    id: string;
    Building_name: string;
    address: string;
    ownerId: string;
    createdAt: any; // Firestore Timestamp
    floors: number;
    units: number;
    hasBasement?: boolean;
    basementCount?: number;
    hasMezzanine?: boolean;
    mezzanineCount?: number;
    hasPenthouse?: boolean;
    hasRooftop?: boolean;
    isDeleted?: boolean;
};

export type Level = {
    id: string;
    name: string;
    type: 'Basement' | 'Ground' | 'Mezzanine' | 'Typical Floor' | 'Penthouse' | 'Rooftop';
    floorNumber?: number;
    createdAt: any; // Firestore Timestamp
};

export type Unit = {
    id: string;
    unitNumber: string;
    levelId: string;
    sqm: number;
    quarterlyMaintenanceFees: number;
    ownerName: string;
    type: 'Office' | 'Commercial' | 'Flat Apartment' | 'Duplex Apartment' | 'Storage';
    createdAt: any; // Firestore Timestamp
};

export type Payment = {
    id: string;
    unitId: string;
    amount: number;
    paymentDate: any; // Firestore Timestamp
    quarter: string; // e.g., "Q1 2024"
    paymentType: 'Cash' | 'Bank Transfer' | 'Instapay Transfer';
    receiptUrl?: string;
    notes?: string;
    createdAt: any; // Firestore Timestamp
};
