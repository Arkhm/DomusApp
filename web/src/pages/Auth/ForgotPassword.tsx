import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { apiErrorMessage } from '../../lib/apiError';
import AuthShell, { AuthButton, AuthField } from './AuthShell';

/**
 * RF-007 — passo 1: pedir o link de recuperação.
 *
 * A tela de confirmação é mostrada mesmo quando o email não tem cadastro. Isso
 * é intencional e espelha a resposta da API: qualquer diferença visível aqui
 * transformaria o formulário em um verificador de "quem mora no condomínio".
 */
export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Informe o e-mail da sua conta.');
            return;
        }

        setIsLoading(true);
        try {
            await authService.forgotPassword(email.trim());
            setSent(true);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Não foi possível enviar o link. Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    if (sent) {
        return (
            <AuthShell
                title="Verifique seu"
                highlight="e-mail."
                subtitle="Se este endereço estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora."
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '16px 18px',
                        border: '1px solid #D8CDB6',
                        borderRadius: 2,
                        background: '#FDFBF5',
                        color: '#5A5160',
                        fontSize: 13,
                        lineHeight: 1.6,
                    }}
                >
                    <MailCheck size={18} color="#B8941F" style={{ flexShrink: 0 }} />
                    <span>
                        Não recebeu? Confira a caixa de spam antes de{' '}
                        <button
                            type="button"
                            onClick={() => setSent(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: '#B8941F',
                                cursor: 'pointer',
                                font: 'inherit',
                                textDecoration: 'underline',
                            }}
                        >
                            tentar de novo
                        </button>
                        .
                    </span>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Esqueceu a"
            highlight="senha?"
            subtitle="Informe o e-mail da sua conta e enviaremos um link para você criar uma nova."
            footer={
                <Link to="/login" style={{ fontSize: 12, color: '#5A5160', textDecoration: 'none' }}>
                    Lembrei minha senha — voltar ao login
                </Link>
            }
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <AuthField
                    id="email"
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    autoFocus
                />
                <AuthButton disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Enviando…
                        </>
                    ) : (
                        <>
                            Enviar link
                            <ArrowRight size={14} />
                        </>
                    )}
                </AuthButton>
            </form>
        </AuthShell>
    );
}
