import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Mensagem opcional exibida no fallback. Útil pra escopar — ex: "Erro nos comunicados". */
    fallbackTitle?: string;
}

interface State {
    error: Error | null;
}

/**
 * Captura erros de render no subtree e mostra um fallback editorial em vez de
 * derrubar a aplicação inteira (tela branca). Único componente class do app —
 * `componentDidCatch` ainda é a única API estável para isso no React 19.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Boundary global: log no console é suficiente até existir um sink
        // (Sentry, LogRocket). Não usar `toast` aqui — pode ter sido o próprio
        // toaster que estourou.
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render(): ReactNode {
        if (!this.state.error) return this.props.children;

        const title = this.props.fallbackTitle ?? 'Algo deu errado.';
        return (
            <div
                role="alert"
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '64px 32px',
                    background: 'var(--color-ink-0)',
                    color: 'var(--color-bone)',
                    textAlign: 'center',
                    gap: 24,
                }}
            >
                <div
                    className="tracking-luxe"
                    style={{ fontSize: 10, color: 'var(--color-metal-1)' }}
                >
                    Domus · Painel
                </div>
                <h1
                    className="serif"
                    style={{
                        fontSize: 40,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        maxWidth: 560,
                        lineHeight: 1.15,
                    }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        fontSize: 14,
                        color: 'var(--color-bone-dim)',
                        maxWidth: 480,
                        lineHeight: 1.6,
                    }}
                >
                    Detectamos uma falha inesperada ao renderizar esta tela. Tente recarregar — se o problema
                    persistir, avise a administração.
                </p>
                <pre
                    className="mono"
                    style={{
                        fontSize: 11,
                        color: 'var(--color-bone-muted)',
                        background: 'var(--color-ink-1)',
                        border: '1px solid var(--color-line-strong)',
                        borderRadius: 2,
                        padding: '12px 16px',
                        maxWidth: 600,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {this.state.error.message}
                </pre>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="btn-ghost"
                        style={{ padding: '10px 18px' }}
                    >
                        Tentar novamente
                    </button>
                    <button
                        type="button"
                        onClick={() => window.location.assign('/dashboard')}
                        className="btn-gold"
                        style={{ padding: '10px 18px' }}
                    >
                        Voltar ao painel
                    </button>
                </div>
            </div>
        );
    }
}
