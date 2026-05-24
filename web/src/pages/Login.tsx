import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import Monogram from '../components/luxury/Monogram';
import aerial from '../assets/aerial-residence.webp';
import { apiErrorMessage } from '../lib/apiError';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [emailFocus, setEmailFocus] = useState(false);
    const [pwFocus, setPwFocus] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Preencha e-mail e senha.');
            return;
        }

        setIsLoading(true);

        try {
            await login({ email, password });
            toast.success('Acesso liberado.');
            navigate('/dashboard');
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Não foi possível autenticar. Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                width: '100%',
                background: '#FFFFFF',
                color: 'var(--color-bone)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 460px',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* LEFT — aerial photo with white vignette to the right edge */}
            <div
                style={{
                    position: 'relative',
                    minHeight: '100vh',
                    overflow: 'hidden',
                    background: '#0E2235',
                }}
            >
                {/* Photo */}
                <img
                    src={aerial}
                    alt="Vista aérea do empreendimento Domus Residence"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center center',
                        zIndex: 0,
                    }}
                />

                {/* Right-edge vignette fading to white for a seamless seam */}
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.45) 90%, rgba(255,255,255,0.92) 100%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                />

                {/* Warm overlay to bind the photo to the Domus palette */}
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                            'linear-gradient(180deg, rgba(24, 16, 32, 0.08) 0%, rgba(24, 16, 32, 0.18) 100%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }}
                />

                {/* Editorial pull-quote bottom-left */}
                <div
                    style={{
                        position: 'absolute',
                        left: 56,
                        bottom: 56,
                        maxWidth: 460,
                        zIndex: 2,
                    }}
                >
                    <div
                        className="tracking-luxe"
                        style={{
                            fontSize: 10,
                            color: '#D4AF37',
                            marginBottom: 16,
                            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}
                    >
                        Domus · Residence
                    </div>
                    <p
                        className="serif-it"
                        style={{
                            fontSize: 26,
                            lineHeight: 1.35,
                            color: '#F4EFE0',
                            fontWeight: 300,
                            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                        }}
                    >
                        “Cada detalhe registrado, cada vínculo cuidado — assim se conduz uma residência refinada.”
                    </p>
                </div>
            </div>

            {/* RIGHT — minimal form */}
            <div
                style={{
                    position: 'relative',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '64px 64px',
                    boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.04)',
                    zIndex: 2,
                }}
            >
                {/* Logo + wordmark */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 16,
                        marginBottom: 56,
                    }}
                >
                    <Monogram size={56} />
                    <div
                        className="serif"
                        style={{
                            fontSize: 28,
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            color: '#181020',
                            lineHeight: 1,
                        }}
                    >
                        Domus
                    </div>
                </div>

                {/* Greeting */}
                <div className="fade-up">
                    <h1
                        className="serif"
                        style={{
                            fontSize: 38,
                            fontWeight: 400,
                            color: '#181020',
                            letterSpacing: '-0.01em',
                            lineHeight: 1.1,
                            marginBottom: 12,
                        }}
                    >
                        Bem-vindo{' '}
                        <span className="serif-it" style={{ color: '#B8941F' }}>
                            de volta.
                        </span>
                    </h1>
                    <p style={{ fontSize: 14, color: '#5A5160', lineHeight: 1.6 }}>
                        Acesse sua conta para gerir o condomínio.
                    </p>

                    {/* Gold hairline */}
                    <div
                        style={{
                            width: 40,
                            height: 1,
                            background: 'linear-gradient(90deg, #B8941F 0%, transparent 100%)',
                            margin: '36px 0 32px',
                        }}
                    />

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

                        <FloatingField
                            id="pw"
                            label="Senha"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={setPassword}
                            focused={pwFocus}
                            onFocus={() => setPwFocus(true)}
                            onBlur={() => setPwFocus(false)}
                            autoComplete="current-password"
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
                                boxShadow:
                                    '0 2px 12px rgba(184, 148, 31, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                                transition: 'all 0.25s ease',
                                opacity: isLoading ? 0.7 : 1,
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Autenticando…
                                </>
                            ) : (
                                <>
                                    Entrar
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>

                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                toast('Esqueci minha senha — em breve!', { icon: '🚧' });
                            }}
                            style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 12,
                                color: '#5A5160',
                                textDecoration: 'none',
                                marginTop: -8,
                            }}
                        >
                            Esqueci minha senha
                        </a>
                    </form>
                </div>

                {/* Footer */}
                <div
                    style={{
                        marginTop: 'auto',
                        paddingTop: 48,
                        fontSize: 11,
                        color: '#8C8395',
                        lineHeight: 1.6,
                    }}
                >
                    Ao entrar, você concorda com os{' '}
                    <a
                        href="#"
                        style={{
                            color: '#B8941F',
                            textDecoration: 'none',
                            borderBottom: '1px solid rgba(184, 148, 31, 0.4)',
                        }}
                    >
                        Termos de Uso
                    </a>{' '}
                    e a{' '}
                    <a
                        href="#"
                        style={{
                            color: '#B8941F',
                            textDecoration: 'none',
                            borderBottom: '1px solid rgba(184, 148, 31, 0.4)',
                        }}
                    >
                        Política de Privacidade
                    </a>
                    .
                </div>
            </div>
        </div>
    );
}

// ---- Floating-label material-style input -------------------------------

interface FloatingFieldProps {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    autoComplete?: string;
    trailing?: React.ReactNode;
}

function FloatingField({
    id,
    label,
    type,
    value,
    onChange,
    focused,
    onFocus,
    onBlur,
    autoComplete,
    trailing,
}: FloatingFieldProps) {
    const filled = value && value.length > 0;
    const elevated = focused || filled;
    return (
        <div style={{ position: 'relative', paddingTop: 6 }}>
            <label
                htmlFor={id}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: elevated ? 0 : 22,
                    fontSize: elevated ? 10 : 14,
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: elevated ? '0.16em' : '0',
                    textTransform: elevated ? 'uppercase' : 'none',
                    color: focused ? '#B8941F' : '#5A5160',
                    fontWeight: 500,
                    pointerEvents: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {label}
            </label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                autoComplete={autoComplete}
                style={{
                    width: '100%',
                    padding: '12px 0 10px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: focused ? '1.5px solid #B8941F' : '1px solid #D8CDB6',
                    outline: 'none',
                    fontSize: 15,
                    color: '#181020',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.2s ease',
                }}
            />
            {trailing}
        </div>
    );
}

// CondominiumSelect removido: era um dropdown de demo que coletava um valor
// (`condominium`) nunca enviado para a API — dead code que confundia o fluxo.
// Quando virar multi-tenant de verdade, deve ser reintroduzido conectado ao
// backend e ao token JWT, não como input solto no login.
