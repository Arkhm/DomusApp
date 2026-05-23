import api from './api';
import { mockNoticeService } from './mockData';
import type { Notice, NoticeFormData } from '../types/notice';

const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

const realNoticeService = {
    async getAll(): Promise<Notice[]> {
        const response = await api.get<Notice[]>('/notices');
        return response.data;
    },

    async create(data: NoticeFormData): Promise<Notice> {
        const response = await api.post<Notice>('/notices', data);
        return response.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/notices/${id}`);
    },

    async markAsRead(id: string): Promise<void> {
        await api.post(`/notices/${id}/read`);
    },
};

export const noticeService = isMockMode ? mockNoticeService : realNoticeService;
