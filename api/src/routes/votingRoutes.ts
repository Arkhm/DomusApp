import { Router } from 'express';
import { votingController } from '../controllers/votingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createVotingSchema } from '../schemas/votingSchema';
import { idParamSchema } from '../schemas/common';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), votingController.list);

// ADMIN e síndico podem criar ou apagar votações
router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createVotingSchema), votingController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), validate(idParamSchema, 'params'), votingController.delete);

export default router;
