import "dotenv/config";
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

// Mesmo UUID usado na migration `add_condominium_multi_tenant` para o backfill
// dos dados que existiam antes do multi-tenant.
const DEFAULT_CONDOMINIUM_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
    console.log('🌱 Iniciando seed do banco de dados para a apresentação...');

    // 0. Condomínio: raiz do isolamento multi-tenant. Todo dado criado abaixo
    // pertence a ele. O id é o mesmo constante da migration, para o seed e o
    // backfill dos dados legados apontarem para o mesmo tenant.
    console.log('🏢 Criando o condomínio (tenant) padrão...');

    const condominium = await prisma.condominium.upsert({
        where: { id: DEFAULT_CONDOMINIUM_ID },
        update: {},
        create: {
            id: DEFAULT_CONDOMINIUM_ID,
            name: 'Domus Residence',
            city: 'Goiânia',
            state: 'GO',
        },
    });

    // 1. Criar Unidades (Units) em lote para termos volume
    console.log('🏠 Criando dezenas de unidades (Apartamentos e Casas)...');
    
    const unitsData = [
        // Bloco A
        { type: 'APARTMENT', block: 'Bloco A', number: '101' },
        { type: 'APARTMENT', block: 'Bloco A', number: '102' },
        { type: 'APARTMENT', block: 'Bloco A', number: '201' },
        { type: 'APARTMENT', block: 'Bloco A', number: '202' },
        { type: 'APARTMENT', block: 'Bloco A', number: '301' },
        { type: 'APARTMENT', block: 'Bloco A', number: '302' },
        // Bloco B
        { type: 'APARTMENT', block: 'Bloco B', number: '101' },
        { type: 'APARTMENT', block: 'Bloco B', number: '102' },
        { type: 'APARTMENT', block: 'Bloco B', number: '201' },
        { type: 'APARTMENT', block: 'Bloco B', number: '202' },
        // Casas (Quadras)
        { type: 'HOUSE', block: 'Quadra 1', number: '01' },
        { type: 'HOUSE', block: 'Quadra 1', number: '02' },
        { type: 'HOUSE', block: 'Quadra 1', number: '03' },
        { type: 'HOUSE', block: 'Quadra 2', number: '12' },
        { type: 'HOUSE', block: 'Quadra 2', number: '15' },
        { type: 'HOUSE', block: null, number: '88' }, // Casa sem bloco
    ];

    const createdUnits = [];
    for (const data of unitsData) {
        const unit = await prisma.unit.create({ data: { ...data, condominiumId: condominium.id } });
        createdUnits.push(unit);
    }

    // 2. Verificar se o Admin já existe
    const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@domusapp.com' },
    });

    if (existingAdmin) {
        console.log('⚠️ O banco já tem dados. Recomendamos rodar "docker compose exec api npx prisma migrate reset" para limpar e rodar este seed do zero.');
        return;
    }

    // Gerando a senha padrão uma única vez para otimizar o tempo do seed
    const defaultPassword = await bcrypt.hash('123456', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    // 3. Criar a Administração e Funcionários
    console.log('👤 Criando Administração e equipe de Funcionários...');
    
    const admin = await prisma.user.create({
        data: {
            name: 'Administrador DomusApp', email: 'admin@domusapp.com', cpf: '00000000000',
            phone: '(62) 99999-0000', password: adminPassword, role: 'ADMIN',
            status: 'ACTIVE', isSyndic: false, isCouncilMember: false,
            condominiumId: condominium.id,
        },
    });

    const staffData = [
        { name: 'Carlos Porteiro (Dia)', email: 'carlos.portaria@domus.com', cpf: '33333333331', phone: '(62) 98888-3331', role: 'FUNCIONARIO' },
        { name: 'Roberto Porteiro (Noite)', email: 'roberto.portaria@domus.com', cpf: '33333333332', phone: '(62) 98888-3332', role: 'FUNCIONARIO' },
        { name: 'Ana Zeladora', email: 'ana.zeladoria@domus.com', cpf: '33333333333', phone: '(62) 98888-3333', role: 'FUNCIONARIO' },
        { name: 'Marcos Manutenção', email: 'marcos.manutencao@domus.com', cpf: '33333333334', phone: '(62) 98888-3334', role: 'FUNCIONARIO' },
    ];

    for (const staff of staffData) {
        await prisma.user.create({ data: { ...staff, password: defaultPassword, status: 'ACTIVE', isSyndic: false, isCouncilMember: false, condominiumId: condominium.id } });
    }

    // 4. Criar Moradores Vinculados às Unidades
    console.log('👥 Criando dezenas de moradores...');

    const residentsData = [
        // Síndica
        { name: 'Maria Silva (Síndica)', email: 'maria.sindica@email.com', cpf: '11111111111', role: 'MORADOR', isSyndic: true, unitIndex: 0 },
        // Conselho
        { name: 'João Pereira (Conselho)', email: 'joao.conselho@email.com', cpf: '22222222222', role: 'MORADOR', isCouncilMember: true, unitIndex: 6 },
        { name: 'Beatriz Souza (Conselho)', email: 'beatriz.conselho@email.com', cpf: '22222222223', role: 'MORADOR', isCouncilMember: true, unitIndex: 10 },
        // Moradores Comuns
        { name: 'Fernando Costa', email: 'fernando@email.com', cpf: '44444444441', role: 'MORADOR', unitIndex: 1 },
        { name: 'Camila Rocha', email: 'camila@email.com', cpf: '44444444442', role: 'MORADOR', unitIndex: 1 }, // Divide apartamento com Fernando
        { name: 'Ricardo Almeida', email: 'ricardo@email.com', cpf: '44444444443', role: 'MORADOR', unitIndex: 2 },
        { name: 'Patrícia Lima', email: 'patricia@email.com', cpf: '44444444444', role: 'MORADOR', unitIndex: 3 },
        { name: 'Eduardo Mendes', email: 'eduardo@email.com', cpf: '44444444445', role: 'MORADOR', unitIndex: 4 },
        { name: 'Juliana Castro', email: 'juliana@email.com', cpf: '44444444446', role: 'MORADOR', unitIndex: 5 },
        { name: 'Lucas Martins', email: 'lucas@email.com', cpf: '44444444447', role: 'MORADOR', unitIndex: 7 },
        { name: 'Amanda Oliveira', email: 'amanda@email.com', cpf: '44444444448', role: 'MORADOR', unitIndex: 8 },
        { name: 'Roberto Nunes', email: 'roberton@email.com', cpf: '44444444449', role: 'MORADOR', unitIndex: 11 },
        { name: 'Vanessa Pires', email: 'vanessa@email.com', cpf: '44444444450', role: 'MORADOR', unitIndex: 12 },
        { name: 'Thiago Guedes', email: 'thiago@email.com', cpf: '44444444451', role: 'MORADOR', unitIndex: 13 },
        { name: 'Sandra Mello', email: 'sandra@email.com', cpf: '44444444452', role: 'MORADOR', unitIndex: 14 },
    ];

    for (const resident of residentsData) {
        await prisma.user.create({
            data: {
                name: resident.name,
                email: resident.email,
                cpf: resident.cpf,
                password: defaultPassword,
                role: resident.role,
                status: 'ACTIVE',
                isSyndic: resident.isSyndic || false,
                isCouncilMember: resident.isCouncilMember || false,
                condominiumId: condominium.id,
                unitId: createdUnits[resident.unitIndex].id
            }
        });
    }
    console.log(`✅ ${residentsData.length + staffData.length} usuários (moradores e staff) inseridos!`);

    // 5. Criar Avisos de Teste (Notices) com histórico
    console.log('📢 Criando histórico de avisos...');
    
    const noticesData = [
        { title: 'Dedetização Semestral', content: 'Neste sábado, a partir das 08:00, realizaremos a dedetização nas áreas comuns. Mantenham os pets nos apartamentos.', targetType: 'ALL' },
        { title: 'Regras de Descarte de Lixo', content: 'Lembramos a todos que o lixo reciclável deve ser depositado nas lixeiras azuis. Caixas de papelão devem ser desmontadas.', targetType: 'ALL' },
        { title: 'Festa Junina do Condomínio', content: 'Reservem a data! Nossa festa junina acontecerá no próximo dia 24, na área das churrasqueiras. Cada unidade deve levar um prato típico.', targetType: 'ALL' },
        { title: 'Manutenção da Piscina', content: 'A piscina ficará fechada para tratamento de choque térmico durante toda a terça-feira.', targetType: 'ALL' },
        { title: 'Assembleia Geral Ordinária', content: 'Convocamos todos os moradores para a AGO no dia 15, às 19:30, no Salão de Festas Principal. Pauta: Prestação de contas.', targetType: 'ALL' },
        { title: 'Manutenção no Elevador (Bloco A)', content: 'O elevador de serviço estará em manutenção preventiva hoje das 14h às 16h.', targetType: 'UNIT', targetUnitId: createdUnits[0].id }, 
        { title: 'Vazamento na Garagem (Bloco B)', content: 'Identificamos um vazamento no subsolo. Pedimos aos moradores das vagas 10 a 20 que retirem os veículos provisoriamente.', targetType: 'UNIT', targetUnitId: createdUnits[6].id },
    ];

    for (const notice of noticesData) {
        await prisma.notice.create({
            data: { ...notice, authorId: admin.id, condominiumId: condominium.id }
        });
    }

    // 6. Criar Votações (Votings) com dados variados
    console.log('🗳️  Criando enquetes e votações...');

    const now = new Date();
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const votingsData = [
        // ATIVAS
        {
            title: 'Nova cor da fachada do condomínio', description: 'Vamos escolher a nova cor da fachada para a próxima pintura.',
            startDate: now, endDate: inOneWeek,
            options: [ { text: 'Branco gelo', votes: 14 }, { text: 'Cinza claro', votes: 27 }, { text: 'Bege areia', votes: 8 } ]
        },
        {
            title: 'Reforma da Academia', description: 'Devemos priorizar a compra de novas esteiras ou focar na expansão da área de peso livre?',
            startDate: now, endDate: inThreeDays,
            options: [ { text: 'Novas esteiras e bicicletas', votes: 18 }, { text: 'Expansão dos pesos livres e piso', votes: 22 } ]
        },
        // ENCERRADAS
        {
            title: 'Horário limite do Salão de Festas', description: 'Definição do horário limite para uso do salão aos finais de semana.',
            startDate: oneMonthAgo, endDate: oneWeekAgo,
            options: [ { text: 'Até 22h', votes: 10 }, { text: 'Até 00h', votes: 45 }, { text: 'Até 02h', votes: 12 } ]
        },
        {
            title: 'Troca da Empresa de Segurança', description: 'Aprovação para rescisão de contrato com a empresa atual e contratação da GuardShield Sec.',
            startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), endDate: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000),
            options: [ { text: 'Aprovar troca', votes: 52 }, { text: 'Manter atual', votes: 8 }, { text: 'Abster', votes: 2 } ]
        }
    ];

    for (const voting of votingsData) {
        await prisma.voting.create({
            data: {
                title: voting.title,
                description: voting.description,
                startDate: voting.startDate,
                endDate: voting.endDate,
                authorId: admin.id,
                condominiumId: condominium.id,
                options: { create: voting.options }
            }
        });
    }

    console.log('🎉 Seed finalizado com sucesso! O sistema está pronto para a apresentação.');
}

seed()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });