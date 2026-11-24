export interface CommonArea {
    id: string;
    name: string;
    description: string | null;
    capacity: number | null;
    rules: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CommonAreaFormData {
    name: string;
    description?: string | null;
    capacity?: number | null;
    rules?: string | null;
    isActive?: boolean;
}
