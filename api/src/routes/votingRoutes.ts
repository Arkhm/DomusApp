import { Router } from 'express';
import { votingController } from '../controllers/votingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createVotingSchema, voteSchema } from '../schemas/votingSchema';
import { idParamSchema } from '../schemas/common';

const router = Router();

router.use(authMiddleware);

// Qualquer usuário autenticado lista: o service decide o que cada perfil enxerga
// (contagem de votos só para o painel ou depois de a votação encerrar).
router.get('/', votingController.list);

// Elegibilidade (morador ativo, votação aberta, voto único) é checada no service.
router.post('/:id/vote', validate(idParamSchema, 'params'), validate(voteSchema), votingController.vote);

// ADMIN e síndico podem criar ou apagar votações
router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createVotingSchema), votingController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamSchema, 'params'), votingController.delete);

export default router;
