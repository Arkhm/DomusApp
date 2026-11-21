import { useEffect, useState } from 'react';
import { userService } from '../../services/userService';

/**
 * Nomes dos usuários por id, para mostrar quem fez cada registro do histórico.
 * Enquanto carrega, ou se a consulta falhar, devolve `null` e o histórico mostra só a origem do registro.
 */
export function useActorNames(): Record<string, string> | null {
    const [names, setNames] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const users = await userService.getAll();
                if (!cancelled) setNames(Object.fromEntries(users.map(user => [user.id, user.name])));
            } catch { /* sem os nomes, a linha mostra a origem do registro */ }
        }
        void load();
        return () => { cancelled = true; };
    }, []);

    return names;
}
