import "dotenv/config";
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function seed() {
    console.log('🌱 Iniciando seed do banco de dados...');

    const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@domusapp.com' },
    });

    if (existingAdmin) {
        console.log('⚠️  Admin já existe. Seed ignorado.');
        return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
        data: {
            name: 'Administrador DomusApp',
            email: 'admin@domusapp.com',
            cpf: '00000000000',
            telefone: '(62) 99999-0000',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ATIVO',
            is_sindico: false,
            is_conselheiro: false,
        },
    });

    console.log('✅ Admin criado com sucesso!');

    const sampleUsers = [
        {
            name: 'Maria Silva', email: 'maria@email.com', cpf: '11111111111',
            telefone: '(62) 98888-1111', password: await bcrypt.hash('123456', 10),
            role: 'MORADOR', // <-- Corrigido
            unidade: 'Bloco A - 101', status: 'ATIVO', is_sindico: true, is_conselheiro: false,
        },
        {
            name: 'João Pereira', email: 'joao@email.com', cpf: '22222222222',
            telefone: '(62) 98888-2222', password: await bcrypt.hash('123456', 10),
            role: 'MORADOR', // <-- Corrigido
            unidade: 'Bloco B - 202', status: 'ATIVO', is_sindico: false, is_conselheiro: true,
        },
        {
            name: 'Carlos Porteiro', email: 'carlos@email.com', cpf: '33333333333',
            telefone: '(62) 98888-3333', password: await bcrypt.hash('123456', 10),
            role: 'FUNCIONARIO', // <-- Corrigido
            status: 'ATIVO', is_sindico: false, is_conselheiro: false,
        }
    ];

    for (const userData of sampleUsers) {
        await prisma.user.create({ data: userData });
    }

    console.log(`✅ ${sampleUsers.length} usuários de teste criados!`);
}

seed()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });