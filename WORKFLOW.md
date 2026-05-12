# 🔄 Fluxo de Trabalho e Versionamento

Para mantermos qualidade, previsibilidade e organização no DomusApp, adotamos dois padrões:

- **Gitflow** para gerenciamento de branches
- **Conventional Commits** para o histórico de alterações

---

## 🌿 1. Branches

> Nunca faça commits diretos em `main` ou `develop`. Todo código novo deve partir de uma branch específica.

| Branch | Propósito |
|---|---|
| `main` | **Produção.** Representa o que está no ar. Só recebe código via Pull Request testado e revisado. |
| `develop` | **Integração.** Base do desenvolvimento. Todas as features partem daqui e retornam aqui. |
| `feature/<nome>` | Desenvolvimento de novas funcionalidades. Ex: `feature/sistema-de-ocorrencias` |
| `bugfix/<nome>` | Correção de bugs encontrados em desenvolvimento. Ex: `bugfix/erro-login-morador` |
| `hotfix/<nome>` | Correções críticas e urgentes que vão direto para `main`. Ex: `hotfix/queda-banco-de-dados` |

### Fluxo do Dia a Dia

```bash
# 1. Atualize a base
git checkout develop
git pull

# 2. Crie sua branch
git checkout -b feature/minha-feature

# 3. Trabalhe e faça seus commits
git add .
git commit -m "feat: adicionar minha feature"

# 4. Suba a branch e abra um Pull Request apontando para develop
git push origin feature/minha-feature
```

---

## 📝 2. Mensagens de Commit (Conventional Commits)

Cada commit deve comunicar claramente o que foi alterado e por quê. Siga a estrutura:

```
<tipo>: <descrição no imperativo>
```

**Exemplos:**
```
feat: adicionar rota de criação de eventos
fix: corrigir quebra de layout no mobile
docs: atualizar README com instruções do Docker
```

### Tipos Permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Mudanças apenas em documentação |
| `style` | Formatação, espaços, ponto e vírgula — sem impacto na lógica |
| `refactor` | Refatoração que não corrige bug nem adiciona feature |
| `test` | Adição ou correção de testes |
| `build` / `chore` | Build, dependências, Docker, infra |

### Regras

1. **Minúscula** no início do tipo e da descrição
2. **Sem ponto final** na mensagem
3. **Verbo no imperativo**