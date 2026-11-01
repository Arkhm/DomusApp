import { Router } from 'express';
import { votingController } from '../controllers/votingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorizeRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createVotingSchema } from '../schemas/votingSchema';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['ADMIN', 'FUNCIONARIO', 'SYNDIC']), votingController.list);

router.post('/', authorizeRole(['ADMIN', 'SYNDIC']), validate(createVotingSchema), votingController.create);
router.delete('/:id', authorizeRole(['ADMIN', 'SYNDIC']), votingController.delete);

export default router;
