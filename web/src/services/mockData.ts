import type { User, Unit, UserFormData } from '../types/user';
import type { Notice, NoticeFormData } from '../types/notice';

// Simulated delay to mimic API calls
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ──────────────────────────────────────
// Mock Units (necessário para hidratar a relação Unit em User)
// ──────────────────────────────────────

const mockUnits: Unit[] = [
    {
        id: 'u-a-101',
        type: 'APARTMENT',
        block: 'Bloco A',
        number: '101',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'u-b-202',
        type: 'APARTMENT',
        block: 'Bloco B',
        number: '202',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'u-a-302',
        type: 'APARTMENT',
        block: 'Bloco A',
        number: '302',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: 'u-c-401',
        type: 'APARTMENT',
        block: 'Bloco C',
        number: '401',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
];

const findUnit = (id: string | null): Unit | null =>
    id ? mockUnits.find((u) => u.id === id) ?? null : null;

// ──────────────────────────────────────
// Mock Users
// ──────────────────────────────────────

let mockUsers: User[] = [
    {
        id: '1',
        name: 'Administrador DomusApp',
        email: 'admin@domusapp.com',
        cpf: '00000000000',
        phone: '6299990000',
        role: 'ADMIN',
        unitId: null,
        unit: null,
        status: 'ACTIVE',
        isSyndic: false,
        isCouncilMember: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: '2',
        name: 'Maria Silva',
        email: 'maria@email.com',
        cpf: '11111111111',
        phone: '6298881111',
        role: 'MORADOR',
        unitId: 'u-a-101',
        unit: findUnit('u-a-101'),
        status: 'ACTIVE',
        isSyndic: true,
        isCouncilMember: false,
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-02-20T14:30:00.000Z',
    },
    {
        id: '3',
        name: 'João Pereira',
        email: 'joao@email.com',
        cpf: '22222222222',
        phone: '6298882222',
        role: 'MORADOR',
        unitId: 'u-b-202',
        unit: findUnit('u-b-202'),
        status: 'ACTIVE',
        isSyndic: false,
        isCouncilMember: true,
        createdAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
    },
    {
        id: '4',
        name: 'Carlos Porteiro',
        email: 'carlos@email.com',
        cpf: '33333333333',
        phone: '6298883333',
        role: 'FUNCIONARIO',
        unitId: null,
        unit: null,
        status: 'ACTIVE',
        isSyndic: false,
        isCouncilMember: false,
        createdAt: '2026-02-10T09:00:00.000Z',
        updatedAt: '2026-02-10T09:00:00.000Z',
    },
    {
        id: '5',
        name: 'Ana Costa',
        email: 'ana@email.com',
        cpf: '44444444444',
        phone: '6298884444',
        role: 'MORADOR',
        unitId: 'u-a-302',
        unit: findUnit('u-a-302'),
        status: 'INACTIVE',
        isSyndic: false,
        isCouncilMember: false,
        createdAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-05T16:00:00.000Z',
    },
    {
        id: '6',
        name: 'Roberto Mendes',
        email: 'roberto@email.com',
        cpf: '55555555555',
        phone: '6298885555',
        role: 'MORADOR',
        unitId: 'u-c-401',
        unit: findUnit('u-c-401'),
        status: 'ACTIVE',
        isSyndic: false,
        isCouncilMember: false,
        createdAt: '2026-03-02T11:00:00.000Z',
        updatedAt: '2026-03-02T11:00:00.000Z',
    },
];

let nextUserId = 7;

// ──────────────────────────────────────
// Mock Notices
// ──────────────────────────────────────

let mockNotices: Notice[] = [
    {
        id: 'n1',
        title: 'Manutenção programada na piscina',
        content: 'Informamos que a piscina do condomínio ficará interditada nos dias 20 e 21 de abril para manutenção preventiva. A limpeza dos filtros e troca de azulejos danificados serão realizadas neste período. Agradecemos a compreensão de todos.',
        targetType: 'ALL',
        targetUnitId: null,
        targetUnit: null,
        authorId: '1',
        author: { name: 'Administrador DomusApp', role: 'ADMIN' },
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T14:30:00.000Z',
        status: 'PUBLISHED',
        priority: 'NORMAL',
    },
    {
        id: 'n2',
        title: 'Reunião do conselho — Pauta: taxa extra',
        content: 'Convocamos todos os moradores para a reunião extraordinária do conselho que acontecerá no dia 25 de abril, às 19h, no salão de festas. Pauta principal: aprovação de taxa extra para reforma do elevador do Bloco B. A presença de todos é imprescindível.',
        targetType: 'ALL',
        targetUnitId: null,
        targetUnit: null,
        authorId: '1',
        author: { name: 'Administrador DomusApp', role: 'ADMIN' },
        createdAt: '2026-04-08T09:00:00.000Z',
        updatedAt: '2026-04-08T09:00:00.000Z',
        status: 'PUBLISHED',
        priority: 'URGENT',
    },
    {
        id: 'n3',
        title: 'Novo horário da academia',
        content: 'A partir do dia 1º de maio, a academia do condomínio passará a funcionar em novo horário: de segunda a sexta, das 6h às 22h, e aos sábados e domingos, das 8h às 18h. O uso continua sendo exclusivo para moradores e familiares cadastrados.',
        targetType: 'ALL',
        targetUnitId: null,
        targetUnit: null,
        authorId: '1',
        author: { name: 'Administrador DomusApp', role: 'ADMIN' },
        createdAt: '2026-04-05T16:45:00.000Z',
        updatedAt: '2026-04-05T16:45:00.000Z',
        status: 'PUBLISHED',
        priority: 'NORMAL',
    },
    {
        id: 'n4',
        title: 'Dedetização nos blocos A e B',
        content: 'Será realizada dedetização preventiva nos blocos A e B no próximo sábado, dia 19 de abril, a partir das 8h. Pedimos que os moradores mantenham portas e janelas fechadas durante o procedimento. Animais de estimação devem ser removidos dos apartamentos.',
        targetType: 'ALL',
        targetUnitId: null,
        targetUnit: null,
        authorId: '1',
        author: { name: 'Administrador DomusApp', role: 'ADMIN' },
        createdAt: '2026-04-01T11:20:00.000Z',
        updatedAt: '2026-04-01T11:20:00.000Z',
        status: 'PUBLISHED',
        priority: 'NORMAL',
    },
];

let nextNoticeId = 5;

// ──────────────────────────────────────
// Auth Service
// ──────────────────────────────────────

export const mockAuthService = {
    async login(email: string, password: string) {
        await delay(800);

        if (!email || !password) {
            throw { response: { data: { error: 'Email e senha são obrigatórios.' } } };
        }

        if (password === 'wrong') {
            throw { response: { data: { error: 'Credenciais inválidas.' } } };
        }

        // Espelha o contrato real: token nenhum no corpo, só o perfil — na API
        // ele viaja em cookie httpOnly.
        const mockUser = mockUsers[0];
        return {
            user: mockUser,
        };
    },
};

// ──────────────────────────────────────
// User Service
// ──────────────────────────────────────

export const mockUserService = {
    async getAll(): Promise<User[]> {
        await delay(500);
        return [...mockUsers];
    },

    async getById(id: string): Promise<User> {
        await delay(300);
        const user = mockUsers.find((u) => u.id === id);
        if (!user) throw { response: { data: { error: 'Usuário não encontrado.' } } };
        return { ...user };
    },

    async search(query: string): Promise<User[]> {
        await delay(400);
        const q = query.toLowerCase();
        return mockUsers.filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.cpf.includes(q)
        );
    },

    async create(data: UserFormData): Promise<User> {
        await delay(600);

        if (!data.name || !data.email || !data.cpf) {
            throw { response: { data: { error: 'Nome, email e CPF são obrigatórios.' } } };
        }
        if (mockUsers.some((u) => u.email === data.email)) {
            throw { response: { data: { error: 'E-mail já cadastrado.' } } };
        }
        if (mockUsers.some((u) => u.cpf === data.cpf)) {
            throw { response: { data: { error: 'CPF já cadastrado.' } } };
        }

        const isMorador = data.role === 'MORADOR';
        const unitId = isMorador ? data.unitId ?? null : null;

        const newUser: User = {
            id: String(nextUserId++),
            name: data.name,
            email: data.email,
            cpf: data.cpf,
            phone: data.phone || null,
            role: data.role,
            unitId,
            unit: findUnit(unitId),
            status: data.status || 'ACTIVE',
            isSyndic: isMorador ? !!data.isSyndic : false,
            isCouncilMember: isMorador ? !!data.isCouncilMember : false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        mockUsers = [newUser, ...mockUsers];
        return { ...newUser };
    },

    async update(id: string, data: Partial<UserFormData>): Promise<User> {
        await delay(600);

        const index = mockUsers.findIndex((u) => u.id === id);
        if (index === -1) throw { response: { data: { error: 'Usuário não encontrado.' } } };

        if (data.email && data.email !== mockUsers[index].email) {
            if (mockUsers.some((u) => u.email === data.email)) {
                throw { response: { data: { error: 'E-mail já cadastrado por outro usuário.' } } };
            }
        }

        const merged: User = {
            ...mockUsers[index],
            ...data,
            // Garante que `unit` reflita `unitId` após o merge.
            unit: data.unitId !== undefined ? findUnit(data.unitId ?? null) : mockUsers[index].unit,
            updatedAt: new Date().toISOString(),
        } as User;

        if (merged.role !== 'MORADOR') {
            merged.unitId = null;
            merged.unit = null;
            merged.isSyndic = false;
            merged.isCouncilMember = false;
        }

        mockUsers[index] = merged;
        return { ...merged };
    },

    async delete(id: string): Promise<void> {
        await delay(400);
        const index = mockUsers.findIndex((u) => u.id === id);
        if (index === -1) throw { response: { data: { error: 'Usuário não encontrado.' } } };
        mockUsers.splice(index, 1);
    },
};

// ──────────────────────────────────────
// Notice Service
// ──────────────────────────────────────

export const mockNoticeService = {
    async getAll(): Promise<Notice[]> {
        await delay(500);
        return [...mockNotices];
    },

    async create(data: NoticeFormData): Promise<Notice> {
        await delay(600);

        if (!data.title?.trim() || !data.content?.trim()) {
            throw { response: { data: { error: 'Título e conteúdo são obrigatórios.' } } };
        }

        const newNotice: Notice = {
            id: `n${nextNoticeId++}`,
            title: data.title,
            content: data.content,
            targetType: data.targetType || 'ALL',
            targetUnitId: data.targetUnitId || null,
            targetUnit: null,
            authorId: '1',
            author: { name: 'Administrador DomusApp', role: 'ADMIN' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: data.status || 'PUBLISHED',
            priority: data.priority || 'NORMAL',
        };

        mockNotices = [newNotice, ...mockNotices];
        return { ...newNotice };
    },

    async delete(id: string): Promise<void> {
        await delay(400);
        const index = mockNotices.findIndex((n) => n.id === id);
        if (index === -1) throw { response: { data: { error: 'Aviso não encontrado.' } } };
        mockNotices.splice(index, 1);
    },
};
