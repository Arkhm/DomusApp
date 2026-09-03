import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { apiErrorMessage } from '../../lib/apiError';
import AuthShell, { AuthButton, AuthField } from './AuthShell';

const MIN_PASSWORD = 8;

/**
 * RF-007 — passo 2: definir a nova senha.
 *
 * O token chega pela query string do link enviado por email. Quem valida se ele
 * existe e está no prazo é a API; aqui só conferimos que ele veio, para não
 * mandar o usuário preencher um formulário fadado ao erro.
 */
export default function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    if (!token) {
        return (
            <AuthShell
                title="Link"
                highlight="inválido."
                subtitle="Este endereço não traz um token de recuperação. Peça um link novo para redefinir sua senha."
            />
        );
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (password.length < MIN_PASSWORD) {
            toast.error(`A senha deve ter ao menos ${MIN_PASSWORD} caracteres.`);
            return;
        }

        if (password !== confirmation) {
            toast.error('As senhas não conferem.');
            return;
        }

        setIsLoading(true);
        try {
            const message = await authService.resetPassword(token, password);
            toast.success(message);
            // A API invalida as sessões abertas ao trocar a senha, então o
            // caminho daqui é sempre um login novo.
            navigate('/login', { replace: true });
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Não foi possível redefinir a senha. Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell
            title="Crie sua nova"
            highlight="senha."
            subtitle={`Use ao menos ${MIN_PASSWORD} caracteres. Ao confirmar, as sessões abertas nesta conta serão encerradas.`}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <AuthField
                    id="password"
                    label="Nova senha"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    autoFocus
                />
                <AuthField
                    id="confirmation"
                    label="Confirme a nova senha"
                    type="password"
                    value={confirmation}
                    onChange={setConfirmation}
                    autoComplete="new-password"
                />
                <AuthButton disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Salvando…
                        </>
                    ) : (
                        <>
                            Redefinir senha
                            <ArrowRight size={14} />
                        </>
                    )}
                </AuthButton>
            </form>
        </AuthShell>
    );
}
