import { Request, Response } from 'express';
import { userService } from '../services/userService';

export const userController = {
    async list(req: Request, res: Response) {
        try {
            const { search } = req.query;
            let users;

            if (search && typeof search === 'string') {
                users = await userService.search(search);
            } else {
                users = await userService.listAll();
            }

            res.status(200).json(users);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    },

    async getById(req: Request, res: Response) {
        try {
            
            const id = Number(req.params.id);
            const user = await userService.getById(id);
            res.status(200).json(user);
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    },

    async create(req: Request, res: Response) {
        try {
            const user = await userService.create(req.body);
            res.status(201).json(user);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    },

    async update(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const user = await userService.update(id, req.body);
            res.status(200).json(user);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    },

    async delete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const result = await userService.delete(id);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    },
};