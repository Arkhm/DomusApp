import { useContext } from 'react';
import { AuthContext, type AuthContextData } from '../contexts/authStore';

/**
 * Hook que expõe o `AuthContext`. Mora em arquivo separado do provider para
 * satisfazer `react-refresh/only-export-components` — o módulo do provider só
 * exporta componentes/contexto e este hook fica isolado.
 */
export function useAuth(): AuthContextData {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.');
    }
    return ctx;
}
