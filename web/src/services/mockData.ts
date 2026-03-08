import type { User } from '../types/user';

// Simulated delay to mimic API calls
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock users database (in-memory)
let mockUsers: User[] = [
    {
        id: '1',
        name: 'Administrador DomusApp',
        email: 'admin@domusapp.com',
        cpf: '00000000000',
        telefone: '(62) 99999-0000',
        perfil: 'administrador',
        unidade: null,
        status: 'ativo',
        is_sindico: false,
        is_conselheiro: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
        id: '2',
        name: 'Maria Silva',
        email: 'maria@email.com',
        cpf: '11111111111',
        telefone: '(62) 98888-1111',
        perfil: 'morador',
        unidade: 'Bloco A - 101',
        status: 'ativo',
        is_sindico: true,
        is_conselheiro: false,
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-02-20T14:30:00.000Z',
    },
    {
        id: '3',
        name: 'João Pereira',
        email: 'joao@email.com',
        cpf: '22222222222',
        telefone: '(62) 98888-2222',
        perfil: 'morador',
        unidade: 'Bloco B - 202',
        status: 'ativo',
        is_sindico: false,
        is_conselheiro: true,
        createdAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-02-01T08:00:00.000Z',
    },
    {
        id: '4',
        name: 'Carlos Porteiro',
        email: 'carlos@email.com',
        cpf: '33333333333',
        telefone: '(62) 98888-3333',
        perfil: 'funcionario',
        unidade: null,
        status: 'ativo',
        is_sindico: false,
        is_conselheiro: false,
        createdAt: '2026-02-10T09:00:00.000Z',
        updatedAt: '2026-02-10T09:00:00.000Z',
    },
    {
        id: '5',
        name: 'Ana Costa',
        email: 'ana@email.com',
        cpf: '44444444444',
        telefone: '(62) 98888-4444',
        perfil: 'morador',
        unidade: 'Bloco A - 302',
        status: 'inativo',
        is_sindico: false,
        is_conselheiro: false,
        createdAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-05T16:00:00.000Z',
    },
    {
        id: '6',
        name: 'Roberto Mendes',
        email: 'roberto@email.com',
        cpf: '55555555555',
        telefone: '(62) 98888-5555',
        perfil: 'morador',
        unidade: 'Bloco C - 401',
        status: 'ativo',
        is_sindico: false,
        is_conselheiro: false,
        createdAt: '2026-03-02T11:00:00.000Z',
        updatedAt: '2026-03-02T11:00:00.000Z',
    },
];

let nextId = 7;

export const mockAuthService = {
    async login(email: string, password: string) {
        await delay(800);

        // Accept any non-empty credentials in mock mode
        if (!email || !password) {
            throw { response: { data: { error: 'Email e senha são obrigatórios.' } } };
        }

        // Simulate invalid credentials for a specific case
        if (password === 'wrong') {
            throw { response: { data: { error: 'Credenciais inválidas.' } } };
        }

        const mockUser = mockUsers[0]; // Return admin user
        return {
            token: 'mock-jwt-token-domusapp',
            user: mockUser,
        };
    },
};

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

    async create(data: any): Promise<User> {
        await delay(600);

        // Validate
        if (!data.name || !data.email || !data.cpf) {
            throw { response: { data: { error: 'Nome, email e CPF são obrigatórios.' } } };
        }
        if (mockUsers.some((u) => u.email === data.email)) {
            throw { response: { data: { error: 'E-mail já cadastrado.' } } };
        }
        if (mockUsers.some((u) => u.cpf === data.cpf)) {
            throw { response: { data: { error: 'CPF já cadastrado.' } } };
        }

        const newUser: User = {
            id: String(nextId++),
            name: data.name,
            email: data.email,
            cpf: data.cpf,
            telefone: data.telefone || null,
            perfil: data.perfil || 'morador',
            unidade: data.perfil === 'morador' ? data.unidade || null : null,
            status: data.status || 'ativo',
            is_sindico: data.perfil === 'morador' ? data.is_sindico || false : false,
            is_conselheiro: data.perfil === 'morador' ? data.is_conselheiro || false : false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        mockUsers = [newUser, ...mockUsers];
        return { ...newUser };
    },

    async update(id: string, data: any): Promise<User> {
        await delay(600);

        const index = mockUsers.findIndex((u) => u.id === id);
        if (index === -1) throw { response: { data: { error: 'Usuário não encontrado.' } } };

        // Check email uniqueness
        if (data.email && data.email !== mockUsers[index].email) {
            if (mockUsers.some((u) => u.email === data.email)) {
                throw { response: { data: { error: 'E-mail já cadastrado por outro usuário.' } } };
            }
        }

        const updated: User = {
            ...mockUsers[index],
            ...data,
            updatedAt: new Date().toISOString(),
        };

        // Clear morador fields if not morador
        if (updated.perfil !== 'morador') {
            updated.unidade = null;
            updated.is_sindico = false;
            updated.is_conselheiro = false;
        }

        mockUsers[index] = updated;
        return { ...updated };
    },

    async delete(id: string): Promise<void> {
        await delay(400);
        const index = mockUsers.findIndex((u) => u.id === id);
        if (index === -1) throw { response: { data: { error: 'Usuário não encontrado.' } } };
        mockUsers.splice(index, 1);
    },
};
