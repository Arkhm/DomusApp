import "dotenv/config";
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function seed() {
    console.log('🌱 Iniciando seed do banco de dados...');

    // 1. Criar Unidades (Units) primeiro para podermos vinculá-las aos moradores
    console.log('🏠 Criando unidades...');
    const unitA101 = await prisma.unit.create({
        data: { type: 'APARTMENT', block: 'Bloco A', number: '101' }
    });

    const unitB202 = await prisma.unit.create({
        data: { type: 'APARTMENT', block: 'Bloco B', number: '202' }
    });

    // Algumas casas para demonstrar o modelo misto (Quadra + Lote)
    await prisma.unit.create({
        data: { type: 'HOUSE', block: 'Quadra 1', number: '12' }
    });

    await prisma.unit.create({
        data: { type: 'HOUSE', block: 'Quadra 2', number: '07' }
    });

    await prisma.unit.create({
        data: { type: 'HOUSE', block: null, number: '23' }
    });

    // 2. Verificar se o Admin já existe
    const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@domusapp.com' },
    });

    if (existingAdmin) {
        console.log('⚠️  Admin já existe. Limpe o banco (npx prisma migrate reset) para rodar o seed completo novamente.');
        return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 3. Criar o Administrador (Atributos em inglês e sem unidade)
    const admin = await prisma.user.create({
        data: {
            name: 'Administrador DomusApp',
            email: 'admin@domusapp.com',
            cpf: '00000000000',
            phone: '(62) 99999-0000',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
            isSyndic: false,
            isCouncilMember: false,
        },
    });

    console.log('✅ Admin criado com sucesso!');

    // 4. Criar Usuários de Teste
    const sampleUsers = [
        {
            name: 'Maria Silva', email: 'maria@email.com', cpf: '11111111111',
            phone: '(62) 98888-1111', password: await bcrypt.hash('123456', 10),
            role: 'MORADOR', 
            unitId: unitA101.id, // <-- Vinculado ao Bloco A - 101 via FK
            status: 'ACTIVE', isSyndic: true, isCouncilMember: false,
        },
        {
            name: 'João Pereira', email: 'joao@email.com', cpf: '22222222222',
            phone: '(62) 98888-2222', password: await bcrypt.hash('123456', 10),
            role: 'MORADOR', 
            unitId: unitB202.id, // <-- Vinculado ao Bloco B - 202 via FK
            status: 'ACTIVE', isSyndic: false, isCouncilMember: true,
        },
        {
            name: 'Carlos Porteiro', email: 'carlos@email.com', cpf: '33333333333',
            phone: '(62) 98888-3333', password: await bcrypt.hash('123456', 10),
            role: 'FUNCIONARIO', 
            status: 'ACTIVE', isSyndic: false, isCouncilMember: false,
        }
    ];

    for (const userData of sampleUsers) {
        await prisma.user.create({ data: userData });
    }

    console.log(`✅ ${sampleUsers.length} usuários de teste criados e vinculados às unidades!`);

    // 5. Criar Avisos de Teste (Notices)
    console.log('📢 Criando avisos de teste...');
    
    // Aviso Geral, para "ALL"
    await prisma.notice.create({
        data: {
            title: 'Dedetização Semestral',
            content: 'Informamos que neste sábado, a partir das 08:00, realizaremos a dedetização nas áreas comuns do condomínio. Pedimos que mantenham seus animais de estimação dentro dos apartamentos.',
            targetType: 'ALL',
            authorId: admin.id,
        }
    });

    // Aviso Específico
    await prisma.notice.create({
        data: {
            title: 'Manutenção no Elevador do Bloco A',
            content: 'O elevador de serviço do Bloco A estará em manutenção preventiva hoje das 14h às 16h.',
            targetType: 'UNIT',
            targetUnitId: unitA101.id, // Direcionado especificamente para a unidade A101
            authorId: admin.id,
        }
    });

    console.log('✅ Avisos criados com sucesso!');

    // 6. Criar Votações de Teste (Votings)
    console.log('🗳️  Criando votações de teste...');

    const now = new Date();
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Votação ATIVA (endDate futura)
    await prisma.voting.create({
        data: {
            title: 'Nova cor da fachada do condomínio',
            description: 'Vamos escolher a nova cor da fachada para a próxima pintura. Sua opinião é fundamental!',
            startDate: now,
            endDate: inOneWeek,
            authorId: admin.id,
            options: {
                create: [
                    { text: 'Branco gelo', votes: 4 },
                    { text: 'Cinza claro', votes: 7 },
                    { text: 'Bege areia', votes: 2 }
                ]
            }
        }
    });

    // Votação ENCERRADA (endDate passada)
    await prisma.voting.create({
        data: {
            title: 'Horário de uso do salão de festas',
            description: 'Definição do horário limite para uso do salão de festas aos finais de semana.',
            startDate: oneMonthAgo,
            endDate: oneWeekAgo,
            authorId: admin.id,
            options: {
                create: [
                    { text: 'Até 22h', votes: 3 },
                    { text: 'Até 00h', votes: 12 },
                    { text: 'Até 02h', votes: 5 }
                ]
            }
        }
    });

    console.log('✅ Votações criadas com sucesso!');
}

seed()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });