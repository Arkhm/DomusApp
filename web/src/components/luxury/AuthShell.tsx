import type { ReactNode } from 'react';
import Monogram from './Monogram';
import aerial from '../../assets/aerial-residence.webp';

// Layout compartilhado das telas de autenticação (foto + painel de formulário
// à direita). Extraído do Login.tsx pra "Esqueci minha senha" e "Redefinir
// senha" reaproveitarem a mesma casca visual sem duplicar ~100 linhas de
// estilo. O Login em si continua com o próprio JSX (já testado, não vale o
// risco de mexer numa tela que já está no ar por causa de uma tela nova).
interface AuthShellProps {
    title: ReactNode;
    subtitle: string;
    children: ReactNode;
}

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
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

            {/* RIGHT — minimal form panel */}
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
                        {title}
                    </h1>
                    <p style={{ fontSize: 14, color: '#5A5160', lineHeight: 1.6 }}>{subtitle}</p>

                    <div
                        style={{
                            width: 40,
                            height: 1,
                            background: 'linear-gradient(90deg, #B8941F 0%, transparent 100%)',
                            margin: '36px 0 32px',
                        }}
                    />

                    {children}
                </div>
            </div>
        </div>
    );
}
