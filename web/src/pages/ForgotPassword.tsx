import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Loader2, MailCheck } from 'lucide-react';
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

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [emailFocus, setEmailFocus] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    // A API sempre responde 200 com a mesma mensagem genérica (exista ou não
    // o e-mail) — então "enviado" aqui é só "a chamada terminou sem erro de
    // rede", não uma confirmação de que o e-mail existe.
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !email.includes('@')) {
            toast.error('Informe um e-mail válido.');
            return;
        }

        setIsLoading(true);
        try {
            await authService.forgotPassword(email.trim());
            setSubmitted(true);
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Não foi possível processar sua solicitação. Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    if (submitted) {
        return (
            <AuthShell title="Verifique seu e-mail." subtitle="">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 14,
                            padding: '18px 20px',
                            background: '#FAF7EE',
                            border: '1px solid #E8DEC2',
                            borderRadius: 2,
                        }}
                    >
                        <MailCheck size={18} color="#B8941F" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 13, color: '#5A5160', lineHeight: 1.6, margin: 0 }}>
                            Se <strong style={{ color: '#181020' }}>{email}</strong> estiver cadastrado, você vai
                            receber um e-mail com as instruções para redefinir sua senha. O link expira em 1 hora.
                        </p>
                    </div>
                    <Link to="/login" style={backLinkStyle}>
                        <ArrowLeft size={13} />
                        Voltar para o login
                    </Link>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Esqueceu sua senha?"
            subtitle="Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha."
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <FloatingField
                    id="email"
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    focused={emailFocus}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    autoComplete="email"
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
                            Enviando…
                        </>
                    ) : (
                        <>
                            Enviar instruções
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
