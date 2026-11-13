import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '../../lib/apiError';
import { splitResidents } from '../../lib/invoiceForm';
import { userService } from '../../services/userService';
import type { User } from '../../types/user';

/** Carrega os moradores e separa quem pode receber cobrança de quem precisa de correção cadastral. */
export function useResidents() {
    const [users, setUsers] = useState<User[] | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setError('');
            try {
                const data = await userService.getAll();
                if (!cancelled) setUsers(data);
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Erro ao carregar os moradores.'));
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [attempt]);

    const { eligible, blocked } = useMemo(() => splitResidents(users ?? []), [users]);
    return { eligible, blocked, error, loading: users === null && !error, retry: () => setAttempt(value => value + 1) };
}
