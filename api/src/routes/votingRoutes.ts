import { idParamsSchema } from '../schemas/common';
import { Router } from 'express';
import { votingController } from '../controllers/votingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { castVoteSchema, createVotingSchema } from '../schemas/votingSchema';

const router = Router();

router.use(authMiddleware);

// Morador também lista: precisa ver as votações para poder votar.
router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'MORADOR']), votingController.list);
router.post('/:id/votes', authorizeRole(['MORADOR']), validate(idParamsSchema, 'params'), validate(castVoteSchema), votingController.vote);

router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createVotingSchema), votingController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamsSchema, 'params'), votingController.delete);

export default router;
