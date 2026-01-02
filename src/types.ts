
export type UserProfile = {
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    defaultBuildingId?: string;
};

export type GlobalUnitType = {
    id: string;
    name: string;
    shortName?: string;
    description?: string;
    isMultiLevel?: boolean;
}

export type GlobalUtilityType = {
    id: string;
    name: string;
    description?: string;
}

export type GlobalPayableCategory = {
    id: string;
    name: string;
    description?: string;
    linksTo?: 'employee' | 'serviceProvider' | 'utility' | null;
}

export type GlobalPaymentMethod = {
    id: string;
    name: string;
    description?: string;
    icon?: string;
}

export type AppSettings = {
    globalUnitTypes?: GlobalUnitType[];
}

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
    hasPenthouse?: boolean;
    hasRooftop?: boolean;
    isDeleted?: boolean;
    financialStartDate?: any; // Firestore Timestamp
    enabledUnitTypeIds?: string[];
};

export type Level = {
    id: string;
    name: string;
    levelType: 'Basement' | 'Ground' | 'Mezzanine' | 'Typical Floor' | 'Penthouse' | 'Rooftop';
    floorNumber?: number;
    createdAt: any; // Firestore Timestamp
};

export type Unit = {
    id: string;
    unitNumber: string;
    levelId: string;
    ownerId: string;
    sqm: number;
    quarterlyMaintenanceFees: number;
    unitTypeId: string;
    parentUnitId?: string;
    childUnitIds?: string[];
    createdAt: any; // Firestore Timestamp
};

export type Owner = {
    id: string;
    name: string;
    email?: string;
    phoneNumber?: string;
    contactPerson?: string;
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

export type Payable = {
    id: string;
    description: string;
    amount: number;
    expenseDate: any; // Firestore Timestamp
    categoryTypeId: string;
    utilityTypeId?: string | null;
    vendor?: string;
    receiptUrl?: string;
    notes?: string;
    createdAt: any; // Firestore Timestamp
    employeeId?: string | null;
    serviceProviderId?: string | null;
};

export type Employee = {
    id: string;
    name: string;
    phoneNumber?: string;
    idNumber: string;
    photoUrl?: string;
    jobTitle: 'Security' | 'Doorman' | 'Concierge' | 'Gardner';
    jobDescription?: string;
    hireDate: any; // Firestore Timestamp
    createdAt: any; // Firestore Timestamp
};

export type SalaryHistory = {
    id: string;
    amount: number;
    effectiveDate: any; // Firestore Timestamp
    changeReason?: string;
};

export type ServiceProvider = {
    id: string;
    name: string;
    serviceType: 'Plumbing' | 'Electrical' | 'HVAC' | 'Cleaning' | 'Security' | 'Landscaping' | 'Pest Control' | 'Other';
    contactPerson?: string;
    phoneNumber?: string;
    email?: string;
    notes?: string;
    createdAt: any; // Firestore Timestamp
    hasMonthlyPayment?: boolean;
    monthlyPaymentAmount?: number | null;
};

export type ContractPaymentHistory = {
    id: string;
    amount: number;
    effectiveDate: any; // Firestore Timestamp
    changeReason?: string;
};

export type TestRecord = {
    id: string;
    date: any; // Firestore Timestamp
    ownerId: string;
    type: number;
};
