import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { IncidentCategory, IncidentStatus, ParkingType, Prisma, ReservationStatus } from '@prisma/client';
import type { CommonArea, Event, Notice, Unit, User } from '@prisma/client';
import { prisma } from './lib/prisma';

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

const staffData = [
    { name: 'Carlos Porteiro (Dia)', email: 'carlos.portaria@domus.com', cpf: '33333333331', phone: '(62) 98888-3331', role: 'FUNCIONARIO' },
    { name: 'Roberto Porteiro (Noite)', email: 'roberto.portaria@domus.com', cpf: '33333333332', phone: '(62) 98888-3332', role: 'FUNCIONARIO' },
    { name: 'Ana Zeladora', email: 'ana.zeladoria@domus.com', cpf: '33333333333', phone: '(62) 98888-3333', role: 'FUNCIONARIO' },
    { name: 'Marcos Manutenção', email: 'marcos.manutencao@domus.com', cpf: '33333333334', phone: '(62) 98888-3334', role: 'FUNCIONARIO' },
];

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

async function seed() {
    const now = new Date();
    const dayMs = 86_400_000;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).map(part => [part.type, part.value]));
    const today = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    // Dias civis seguem o armazenamento de reservas/faturas; eventos são instantes de Brasília.
    const civilDate = (days: number) => new Date(today.getTime() + days * dayMs);
    const at = (days: number, time = '12:00') =>
        new Date(`${civilDate(days).toISOString().slice(0, 10)}T${time}:00-03:00`);
    const defaultPassword = await bcrypt.hash('123456', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    console.log('Preparando dados fictícios de demonstração...');
    const result = await prisma.$transaction(async tx => {
        // Verificar antes de qualquer escrita também evita duplicar unidades numa segunda execução.
        const existing = await Promise.all([
            tx.user.count(), tx.unit.count(), tx.commonArea.count(), tx.parkingSpot.count(),
            tx.paymentOperation.count(), tx.paymentWebhook.count(),
        ]);
        if (existing.some(count => count > 0)) return null;

        const units: Unit[] = [];
        for (const data of unitsData) {
            units.push(await tx.unit.create({ data: { ...data, createdAt: at(-120), updatedAt: at(-120) } }));
        }
        const admin = await tx.user.create({ data: {
            name: 'Administrador DomusApp', email: 'admin@domusapp.com', cpf: '00000000000',
            phone: '(62) 99999-0000', password: adminPassword, role: 'ADMIN', status: 'ACTIVE',
            createdAt: at(-110), updatedAt: at(-110),
        } });
        for (const staff of staffData) {
            await tx.user.create({ data: {
                ...staff, password: defaultPassword, status: 'ACTIVE', createdAt: at(-100), updatedAt: at(-100),
            } });
        }
        const residents: User[] = [];
        for (const resident of residentsData) {
            residents.push(await tx.user.create({ data: {
                name: resident.name, email: resident.email, cpf: resident.cpf, role: resident.role,
                password: defaultPassword, status: 'ACTIVE', isSyndic: resident.isSyndic || false,
                isCouncilMember: resident.isCouncilMember || false, unitId: units[resident.unitIndex].id,
                createdAt: at(-100), updatedAt: at(-100),
            } }));
        }
        const syndic = residents[0];
        const unitResidents = residents.filter((resident, index, list) =>
            list.findIndex(other => other.unitId === resident.unitId) === index);

        const spots: Prisma.ParkingSpotCreateManyInput[] = units.map((unit, index) => ({
            number: `M-${String(index + 1).padStart(2, '0')}`, unitId: unit.id,
            type: index === 0 ? ParkingType.DISABLED : ParkingType.RESIDENT,
        }));
        for (const [index, unitIndex] of [0, 1, 6, 10].entries()) {
            spots.push({ number: `M-${17 + index}`, type: ParkingType.RESIDENT, unitId: units[unitIndex].id });
        }
        spots.push(
            { number: 'V-01', type: ParkingType.VISITOR }, { number: 'V-02', type: ParkingType.VISITOR },
            { number: 'L-01', type: ParkingType.RESIDENT }, { number: 'PCD-02', type: ParkingType.DISABLED },
        );
        await tx.parkingSpot.createMany({ data: spots });
        for (const unit of units) {
            await tx.unit.update({ where: { id: unit.id }, data: {
                parkingSpots: await tx.parkingSpot.count({ where: { unitId: unit.id } }),
            } });
        }
        await tx.vehicle.createMany({ data: unitResidents.slice(0, 12).map((resident, index) => ({
            plate: `DOM${String(index).padStart(4, '0')}`, model: ['Fiat Argo', 'Honda Civic', 'Toyota Corolla', 'VW Polo'][index % 4],
            color: ['Branco', 'Prata', 'Preto', 'Azul'][index % 4], unitId: resident.unitId!,
        })) });
        await tx.pet.createMany({ data: [
            { name: 'Luna', species: 'CACHORRO', size: 'PEQUENO' }, { name: 'Thor', species: 'CACHORRO', size: 'GRANDE' },
            { name: 'Mel', species: 'GATO', size: 'PEQUENO' }, { name: 'Nina', species: 'CACHORRO', size: 'MEDIO' },
            { name: 'Simba', species: 'GATO', size: 'PEQUENO' }, { name: 'Pipoca', species: 'PASSARO', size: 'PEQUENO' },
            { name: 'Bob', species: 'CACHORRO', size: 'MEDIO' }, { name: 'Amora', species: 'OUTRO', size: 'PEQUENO' },
        ].map((pet, index) => ({ ...pet, ownerId: residents[index].id })) });

        const noticesData = [
            { title: 'Dedetização semestral', content: 'A dedetização das áreas comuns ocorrerá na próxima semana, a partir das 08h. Mantenham os pets nos apartamentos.', priority: 'URGENT' },
            { title: 'Regras de descarte de lixo', content: 'Deposite os recicláveis nas lixeiras azuis e desmonte as caixas de papelão.' },
            { title: 'Encontro dos moradores', content: 'Nosso próximo encontro acontecerá na churrasqueira. Cada unidade pode levar um prato para compartilhar.' },
            { title: 'Manutenção da piscina', content: 'A piscina está temporariamente fechada para manutenção. Consulte a administração antes de utilizá-la.', priority: 'URGENT' },
            { title: 'Assembleia geral ordinária', content: 'Consulte o evento da assembleia para a data, horário e local. A pauta inclui a prestação de contas.' },
            { title: 'Vistoria do apartamento A-101', content: 'O responsável pela unidade deve combinar com a administração a vistoria preventiva.', targetUnitId: units[0].id },
            { title: 'Vistoria da garagem B-101', content: 'A equipe irá verificar a impermeabilização da garagem vinculada à sua unidade.', targetUnitId: units[6].id },
            { title: 'Atualização cadastral A-102', content: 'Confiram os veículos e pets cadastrados para a unidade.', targetUnitId: units[1].id },
            { title: 'Planejamento da próxima reforma', content: 'Rascunho interno aguardando aprovação da administração.', status: 'DRAFT' },
        ];
        const notices: Notice[] = [];
        for (const [index, data] of noticesData.entries()) {
            const createdAt = at(-15 + index);
            notices.push(await tx.notice.create({ data: {
                ...data, targetType: data.targetUnitId ? 'UNIT' : 'ALL', status: data.status ?? 'PUBLISHED',
                priority: data.priority ?? 'NORMAL', authorId: index % 2 ? syndic.id : admin.id,
                createdAt, updatedAt: createdAt,
            } }));
        }

        const eventsData: Prisma.EventCreateManyInput[] = [
            { title: 'Assembleia geral ordinária', content: 'Prestação de contas e planejamento das melhorias.', eventDate: at(7, '19:30'), location: 'Salão de festas', category: 'ASSEMBLEIA', capacity: 60, authorId: admin.id },
            { title: 'Encontro dos moradores', content: 'Encontro para integração dos moradores e famílias.', eventDate: at(10, '16:00'), location: 'Churrasqueira', category: 'CONFRATERNIZACAO', capacity: 30, authorId: syndic.id },
            { title: 'Manutenção dos portões', content: 'Utilize o acesso de pedestres durante a manutenção.', eventDate: at(3, '09:00'), location: 'Entrada principal', category: 'MANUTENCAO', authorId: admin.id },
            { title: 'Reunião do conselho', content: 'Reunião de acompanhamento das despesas do mês.', eventDate: at(5, '18:30'), location: 'Sala de reuniões', category: 'REUNIAO', capacity: 10, targetType: 'UNIT', targetUnitId: units[6].id, authorId: syndic.id },
            { title: 'Vistoria da unidade A-102', content: 'A equipe de manutenção fará a vistoria previamente combinada.', eventDate: at(2, '10:00'), location: 'Apartamento A-102', category: 'MANUTENCAO', targetType: 'UNIT', targetUnitId: units[1].id, authorId: admin.id },
            { title: 'Campanha solidária', content: 'Obrigado aos moradores que participaram da arrecadação.', eventDate: at(-12, '10:00'), location: 'Recepção', category: 'OUTRO', authorId: syndic.id },
            { title: 'Cinema ao ar livre', content: 'Evento cancelado por indisponibilidade do equipamento.', eventDate: at(4, '19:00'), location: 'Quadra', category: 'CONFRATERNIZACAO', status: 'CANCELLED', authorId: admin.id },
            { title: 'Feira de troca de livros', content: 'Programação em planejamento, ainda não publicada.', eventDate: at(20, '15:00'), location: 'Salão de festas', category: 'OUTRO', status: 'DRAFT', authorId: syndic.id },
        ];
        const events: Event[] = [];
        for (const [index, data] of eventsData.entries()) {
            const createdAt = at(index === 5 ? -20 : -5);
            events.push(await tx.event.create({ data: { ...data, createdAt, updatedAt: createdAt } }));
        }
        // Leituras apenas de conteúdo publicado e destinado a quem o leu.
        for (const [noticeIndex, residentIndex] of [[0, 0], [1, 3], [5, 0], [7, 3]]) {
            await tx.noticeRead.create({ data: {
                noticeId: notices[noticeIndex].id, userId: residents[residentIndex].id, readAt: at(-1),
            } });
            await tx.notificationRead.create({ data: {
                type: 'NOTICE', sourceId: notices[noticeIndex].id, userId: residents[residentIndex].id, readAt: at(-1),
            } });
        }
        await tx.notificationRead.createMany({ data: [
            { type: 'EVENT', sourceId: events[0].id, userId: residents[0].id, readAt: at(-1) },
            { type: 'EVENT', sourceId: events[4].id, userId: residents[3].id, readAt: at(-1) },
        ] });

        const votingsData = [
            { title: 'Nova cor da fachada do condomínio', description: 'Escolha a cor da próxima pintura.', startDate: at(-2), endDate: at(7), options: ['Branco gelo', 'Cinza claro', 'Bege areia'], voters: unitResidents.filter(resident => resident.unitId !== units[1].id).slice(0, 4), authorId: admin.id },
            { title: 'Reforma da academia', description: 'Qual melhoria deve receber prioridade?', startDate: at(-1), endDate: at(3), options: ['Novas esteiras e bicicletas', 'Expansão dos pesos livres e piso'], voters: [residents[3], residents[5]], authorId: syndic.id },
            { title: 'Horário limite do salão de festas', description: 'Definição do horário de uso aos finais de semana.', startDate: at(-30), endDate: at(-7), options: ['Até 22h', 'Até 00h', 'Até 02h'], voters: unitResidents.slice(0, 8), authorId: admin.id },
            { title: 'Troca da empresa de segurança', description: 'Avaliação da proposta de troca de prestador.', startDate: at(-60), endDate: at(-50), options: ['Aprovar troca', 'Manter atual', 'Abster'], voters: unitResidents.slice(0, 10), authorId: admin.id },
            { title: 'Melhorias no espaço infantil', description: 'Votação agendada para avaliar as propostas de melhoria.', startDate: at(5), endDate: at(12), options: ['Renovar brinquedos', 'Instalar cobertura'], voters: [], authorId: syndic.id },
        ];
        let totalVotes = 0;
        for (const data of votingsData) {
            const voting = await tx.voting.create({ data: {
                title: data.title, description: data.description, startDate: data.startDate, endDate: data.endDate,
                authorId: data.authorId, createdAt: new Date(data.startDate.getTime() - dayMs),
                options: { create: data.options.map(text => ({ text, createdAt: new Date(data.startDate.getTime() - dayMs) })) },
            }, include: { options: true } });
            for (const [index, resident] of data.voters.entries()) {
                const option = voting.options[index % voting.options.length];
                await tx.votingVote.create({ data: {
                    votingId: voting.id, optionId: option.id, unitId: resident.unitId!, userId: resident.id,
                    createdAt: new Date(data.startDate.getTime() + 3_600_000),
                } });
                await tx.votingOption.update({ where: { id: option.id }, data: { votes: { increment: 1 } } });
                totalVotes++;
            }
        }

        const areas: CommonArea[] = [];
        for (const data of [
            { name: 'Salão de festas', description: 'Espaço com mesas, cadeiras e cozinha de apoio.', capacity: 60, rules: 'Respeitar o horário reservado e devolver o espaço limpo.' },
            { name: 'Churrasqueira', description: 'Área coberta para confraternizações.', capacity: 30, rules: 'Não utilizar som em volume excessivo e recolher o lixo.' },
            { name: 'Quadra poliesportiva', description: 'Quadra para atividades esportivas.', capacity: 20, rules: 'Usar calçados adequados. Não levar recipientes de vidro.' },
            { name: 'Sala de reuniões', description: 'Sala para reuniões e pequenos encontros.', capacity: 10, rules: 'Manter as portas fechadas e respeitar o limite de pessoas.' },
            { name: 'Piscina', description: 'Temporariamente fechada para manutenção.', capacity: 25, rules: 'Uso suspenso até nova comunicação.', isActive: false },
        ]) areas.push(await tx.commonArea.create({ data: { ...data, createdAt: at(-100) } }));

        const reservations = [
            { area: 0, resident: 0, day: 7, status: ReservationStatus.PENDING },
            { area: 1, resident: 3, day: 3, status: ReservationStatus.PENDING },
            { area: 2, resident: 5, day: 4, status: ReservationStatus.PENDING },
            { area: 3, resident: 6, day: 6, status: ReservationStatus.PENDING },
            { area: 0, resident: 7, day: 10, status: ReservationStatus.APPROVED },
            { area: 1, resident: 0, day: 5, status: ReservationStatus.APPROVED },
            { area: 2, resident: 9, day: -8, status: ReservationStatus.APPROVED },
            { area: 3, resident: 3, day: -3, status: ReservationStatus.APPROVED },
            { area: 0, resident: 10, day: 9, status: ReservationStatus.REJECTED },
            { area: 1, resident: 11, day: -6, status: ReservationStatus.REJECTED },
            { area: 2, resident: 12, day: 8, status: ReservationStatus.CANCELLED },
            { area: 4, resident: 13, day: -10, status: ReservationStatus.CANCELLED },
        ];
        await tx.reservation.createMany({ data: reservations.map(data => ({
            commonAreaId: areas[data.area].id, userId: residents[data.resident].id, date: civilDate(data.day),
            startTime: '14:00', endTime: '17:00', status: data.status,
            rejectionReason: data.status === 'REJECTED' ? 'Horário indisponível por manutenção preventiva.' : null,
            createdAt: at(Math.min(data.day - 7, -2)), updatedAt: at(Math.min(data.day - 5, -1)),
        })) });

        const incidentTitles = [
            'Som alto após o horário permitido', 'Lâmpada queimada na garagem', 'Portão com fechamento irregular',
            'Limpeza do corredor', 'Objeto encontrado na recepção', 'Ruído recorrente de obra',
            'Interfone sem funcionamento', 'Iluminação do acesso lateral', 'Resíduos na área de convivência',
            'Solicitação de orientação sobre mudança', 'Barulho na área comum', 'Vazamento na entrada do bloco',
        ];
        const categories = [IncidentCategory.BARULHO, IncidentCategory.MANUTENCAO, IncidentCategory.SEGURANCA,
            IncidentCategory.LIMPEZA, IncidentCategory.OUTRO];
        const statuses = [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED, IncidentStatus.CLOSED];
        await tx.incident.createMany({ data: incidentTitles.map((title, index) => {
            const status = statuses[Math.floor(index / 3)];
            const resident = residents[index];
            const createdAt = at(-20 + index);
            const respondedAt = status === 'OPEN' ? null : at(-18 + index);
            return {
                title, description: `Registro fictício: ${title.toLowerCase()}. Solicito acompanhamento da administração.`,
                category: categories[index % categories.length], status, authorId: resident.id, unitId: resident.unitId,
                response: status === 'OPEN' ? null : status === 'IN_PROGRESS'
                    ? 'Recebemos a solicitação e a equipe responsável está acompanhando.'
                    : status === 'RESOLVED' ? 'A equipe concluiu o atendimento solicitado.' : 'Atendimento concluído e ocorrência encerrada.',
                createdAt, respondedAt, updatedAt: respondedAt ?? createdAt,
            };
        }) });

        const invoiceStatuses = ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PAID', 'PAID', 'PAID', 'PAID', 'OVERDUE', 'OVERDUE', 'OVERDUE', 'CANCELLED'];
        for (const [index, status] of invoiceStatuses.entries()) {
            const resident = unitResidents[index];
            const dueDate = civilDate(status === 'PENDING' ? 5 + index : -5 - index * 3);
            const referenceMonth = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), 1));
            const paidAt = status === 'PAID' ? new Date(dueDate.getTime() - 2 * dayMs) : null;
            const createdAt = new Date(dueDate.getTime() - 10 * dayMs);
            await tx.invoice.create({ data: {
                description: `${index === 10 ? 'Taxa extraordinária' : 'Taxa condominial'} — demonstração ${referenceMonth.toISOString().slice(0, 7)}`,
                amount: new Prisma.Decimal(index === 10 ? '120.00' : String(350 + index * 15)),
                dueDate, referenceMonth, status, type: index === 10 ? 'EXTRAORDINARY' : 'MONTHLY_FEE',
                userId: resident.id, unitId: resident.unitId!, paymentSource: 'SEED', paidAt,
                createdAt, updatedAt: paidAt ?? createdAt,
                audits: { create: {
                    actorId: admin.id, source: 'SYSTEM', action: 'SEED', reason: 'Dado fictício de demonstração, sem emissão no provedor.',
                    fromStatus: 'PENDING', toStatus: status, amount: new Prisma.Decimal(index === 10 ? '120.00' : String(350 + index * 15)),
                    createdAt: paidAt ?? createdAt,
                } },
            } });
        }
        return { unidades: units.length, usuarios: 1 + staffData.length + residents.length, vagas: spots.length,
            veiculos: 12, pets: 8, comunicados: notices.length, eventos: events.length, votacoes: votingsData.length,
            votos: totalVotes, areasComuns: areas.length, reservas: reservations.length, ocorrencias: incidentTitles.length,
            faturas: invoiceStatuses.length };
    }, { maxWait: 10_000, timeout: 60_000 });

    if (!result) {
        console.log('Banco já populado. Seed ignorado; nenhum registro foi alterado.');
        return;
    }
    console.table(result);
    console.log('Seed concluído. Dados financeiros são fictícios e não emitem pagamentos.');
}

seed()
    .catch(error => {
        console.error('Erro ao executar seed:', error);
        process.exitCode = 1;
    })
    .finally(async () => { await prisma.$disconnect(); });
