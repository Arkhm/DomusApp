import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../components/luxury/AuthShell';
import FloatingField from '../components/luxury/FloatingField';
import { authService } from '../services/authService';
import { apiErrorMessage } from '../lib/apiError';

const backLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    color: '#5A5160',
    textDecoration: 'none',
};

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [pwFocus, setPwFocus] = useState(false);
    const [confirmFocus, setConfirmFocus] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Link sem token (aberto direto, copiado errado, etc.) — nem tenta
    // renderizar o formulário, já orienta a pedir um link novo.
    if (!token) {
        return (
            <AuthShell title="Link inválido." subtitle="">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 14,
                            padding: '18px 20px',
                            background: '#FBF3F1',
                            border: '1px solid #E9C7BE',
                            borderRadius: 2,
                        }}
                    >
                        <TriangleAlert size={18} color="#B8543D" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 13, color: '#5A5160', lineHeight: 1.6, margin: 0 }}>
                            Este link de redefinição de senha está incompleto ou inválido.
                        </p>
                    </div>
                    <Link to="/esqueci-senha" style={backLinkStyle}>
                        <ArrowLeft size={13} />
                        Solicitar um novo link
                    </Link>
                </div>
            </AuthShell>
        );
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (password.length < 8) {
            toast.error('A senha deve ter pelo menos 8 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem.');
            return;
        }

        setIsLoading(true);
        try {
            await authService.resetPassword(token, password);
            toast.success('Senha redefinida com sucesso.');
            navigate('/login');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Não foi possível redefinir sua senha. Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell title="Redefinir senha." subtitle="Escolha uma nova senha para acessar sua conta.">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <FloatingField
                    id="password"
                    label="Nova senha"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    focused={pwFocus}
                    onFocus={() => setPwFocus(true)}
                    onBlur={() => setPwFocus(false)}
                    autoComplete="new-password"
                    trailing={
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                padding: 8,
                                color: '#8C8395',
                                cursor: 'pointer',
                            }}
                        >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    }
                />

                <FloatingField
                    id="confirmPassword"
                    label="Confirmar nova senha"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    focused={confirmFocus}
                    onFocus={() => setConfirmFocus(true)}
                    onBlur={() => setConfirmFocus(false)}
                    autoComplete="new-password"
                />

                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        padding: '14px 22px',
                        marginTop: 8,
                        background: 'linear-gradient(180deg, #C8A532 0%, #B8941F 100%)',
                        color: '#FFFFFF',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        border: '1px solid #B8941F',
                        borderRadius: 2,
                        cursor: isLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        boxShadow: '0 2px 12px rgba(184, 148, 31, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                        transition: 'all 0.25s ease',
                        opacity: isLoading ? 0.7 : 1,
                    }}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Redefinindo…
                        </>
                    ) : (
                        <>
                            Redefinir senha
                            <ArrowRight size={14} />
                        </>
                    )}
                </button>

                <Link to="/login" style={{ ...backLinkStyle, justifyContent: 'center', marginTop: -8 }}>
                    <ArrowLeft size={13} />
                    Voltar para o login
                </Link>
            </form>
        </AuthShell>
    );
}
