# Posture AI by TRAE AI

Plataforma SaaS de monitoramento postural em tempo real com webcam, MediaPipe Pose, métricas biomecânicas, score postural, autenticação Supabase e integração contextual com Composio MCP para agenda e rotinas.

## Visão do produto

O foco atual do produto é:

- análise postural por webcam em tempo real
- renderização do esqueleto corporal com MediaPipe Pose
- score biomecânico contínuo
- recomendações ergonômicas acionáveis
- persistência por usuário no Supabase
- dashboard conectado à última análise salva
- integração futura da agenda via Composio MCP

## Stack principal

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase Auth + Supabase Database`
- `@supabase/ssr`
- `MediaPipe Tasks Vision`
- `OpenAI`
- `Recharts`
- `Zod`
- `React Hook Form`
- `Lucide React`

## Arquitetura resumida

### Frontend

- `src/app/(app)/analyze/page.tsx`
  Página principal do produto.
- `src/components/analyze/camera-capture.tsx`
  Captura da webcam, overlay do esqueleto, score em tempo real e persistência automática.
- `src/app/(app)/dashboard/page.tsx`
  Painel executivo orientado pela última análise salva.
- `src/components/integrations/integrations-panel.tsx`
  Fluxo central do MCP do Composio.

### Backend

- `src/app/api/posture/analyze/route.ts`
  Recebe landmarks, métricas e contexto para persistência.
- `src/lib/services/posture-analysis.service.ts`
  Orquestra interpretação, score, recomendações e plano.
- `src/lib/services/data-service.ts`
  Camada central de dados autenticados no Supabase.
- `src/lib/composio.ts`
  Camada de integração do Composio por usuário autenticado.

### Autenticação

- `src/lib/supabase/client.ts`
  Cliente browser do Supabase.
- `src/lib/supabase/server.ts`
  Cliente server-side baseado em cookie.
- `src/lib/supabase/request-auth.ts`
  Cliente server-side autenticado por `Bearer` ou cookie.
- `src/lib/supabase/authenticated-fetch.ts`
  Helper client-side que injeta `Authorization: Bearer <access_token>`.

## Fluxo principal

1. Usuário faz login.
2. Aplicação redireciona para `Analyze`.
3. Webcam é autorizada.
4. MediaPipe detecta landmarks frame a frame.
5. O app calcula score, risco, métricas e recomendações.
6. A análise é salva automaticamente no Supabase por usuário.
7. O `Dashboard` reflete os dados persistidos da `Analyze`.
8. Quando o MCP do Composio estiver configurado, a agenda enriquece o dashboard com contexto do dia.

## Estrutura das páginas

- `/analyze`
  Entrada principal da plataforma.
- `/dashboard`
  Painel executivo baseado nas análises salvas.
- `/integrations`
  Conexão do MCP do Composio.
- `/profile`
  Dados do usuário.
- `/settings`
  Preferências.

As rotas `/history` e `/daily-plan` foram retiradas da navegação principal e hoje redirecionam para o `Dashboard`.

## Variáveis de ambiente

Use `.env.local` com esta base:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
OPENAI_API_KEY=
COMPOSIO_API_KEY=
COMPOSIO_BASE_URL=https://backend.composio.dev
COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR=
COMPOSIO_AUTH_CONFIG_GMAIL=
COMPOSIO_AUTH_CONFIG_SLACK=
COMPOSIO_AUTH_CONFIG_TWILIO=
COMPOSIO_AUTH_CONFIG_NOTION=
```

## Variáveis obrigatórias por serviço

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Banco

- `DATABASE_URL`

### OpenAI

- `OPENAI_API_KEY`

### Composio

- `COMPOSIO_API_KEY`
- `COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR`

Se quiser conectar outros apps:

- `COMPOSIO_AUTH_CONFIG_GMAIL`
- `COMPOSIO_AUTH_CONFIG_SLACK`
- `COMPOSIO_AUTH_CONFIG_TWILIO`
- `COMPOSIO_AUTH_CONFIG_NOTION`

## Supabase

### Tabelas utilizadas

- `profiles`
- `user_preferences`
- `posture_sessions`
- `posture_analysis`
- `integrations`
- `connected_apps`
- `composio_connections`
- `calendar_insights`
- `daily_plans`
- `notifications`
- `reminders`
- `automation_rules`
- `automation_runs`

### Comportamento esperado

- cada usuário possui seu próprio contexto autenticado
- cada análise da câmera é salva por `user_id`
- o dashboard sempre lê os dados do usuário logado
- o MCP do Composio também é vinculado por `user_id`

## MediaPipe

### O que a Analyze faz

- solicita permissão da câmera
- inicia `getUserMedia`
- aguarda `loadedmetadata`
- processa o vídeo frame a frame
- renderiza:
  - pontos dos landmarks
  - conexões corporais
  - linha dos ombros
  - linha do quadril
  - linha vertical de alinhamento
  - centro de massa
  - ângulo cervical
  - ângulo do tronco

### Métricas calculadas

- score postural
- risco postural
- inclinação cervical
- inclinação do tronco
- assimetria dos ombros
- assimetria do quadril
- alinhamento corporal
- estabilidade corporal
- confiança da detecção

## Dashboard

O dashboard atual foi simplificado para refletir diretamente:

- última análise salva da `Analyze`
- últimas leituras persistidas
- desvios e recomendações atuais
- métricas biomecânicas salvas
- estado das integrações
- notificações
- bloco assíncrono de agenda via Composio

## Composio MCP

### Objetivo

Permitir que o usuário faça login no Composio e conecte sua agenda para que o dashboard possa cruzar:

- reuniões longas
- blocos consecutivos
- minutos sentado
- janelas livres
- recomendações ergonômicas baseadas na análise

### Fluxo

1. Usuário abre `Integrations`.
2. Clica em `Autenticar com Composio`.
3. O backend cria a conexão por usuário autenticado.
4. O Composio retorna a URL de autorização.
5. O usuário concede acesso.
6. O app volta para `Integrations` e sincroniza o status.
7. O dashboard passa a consultar a agenda sincronizada.

### Observação importante

Se o botão não abrir a autenticação, normalmente falta uma destas configurações:

- `COMPOSIO_API_KEY`
- `COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR`

## Desenvolvimento local

Instale dependências:

```bash
npm ci
```

Rode o projeto:

```bash
npm run dev -- --port 3001
```

Abra:

- `http://localhost:3001/analyze`

## Verificações

### TypeScript

```bash
npm run check
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

### Produção local

```bash
npm run start
```

## Docker

O projeto está preparado para deploy em container com:

- `Dockerfile`
- `.dockerignore`
- `next.config.ts` com `output: "standalone"`

### Build da imagem

```bash
docker build -t posture-ai .
```

### Rodar localmente em container

```bash
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_APP_URL=https://seu-dominio \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e DATABASE_URL=... \
  -e OPENAI_API_KEY=... \
  -e COMPOSIO_API_KEY=... \
  -e COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR=... \
  posture-ai
```

## Deploy no EasyPanel

### Configuração sugerida

- Runtime: `Dockerfile`
- Porta da aplicação: `3000`
- Healthcheck: `/analyze` ou `/dashboard`
- Domínio público: obrigatório para OAuth e câmera fora de localhost

### Variáveis no EasyPanel

Configure no painel:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `COMPOSIO_API_KEY`
- `COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR`
- opcionais do Composio para Gmail, Slack, Twilio e Notion

### Requisitos de produção

- HTTPS ativo
- callback OAuth do Supabase apontando para `/auth/callback`
- callback de conexão do Composio apontando para `/integrations?composio=connected`

## Deploy por GitHub

Este workspace precisa estar inicializado como repositório Git para permitir push.

Fluxo esperado:

```bash
git init
git remote add origin git@github.com:denilsontorres2024/deni-traeai-circuito.git
git add .
git commit -m "feat: refine analyze dashboard composio and easypanel deploy"
git push -u origin main
```

## Estado atual do projeto

### Já implementado

- Analyze como primeira experiência
- webcam-only
- overlay do esqueleto corporal
- score e métricas em tempo real
- salvamento automático no Supabase
- dashboard orientado pela Analyze
- fluxo autenticado centralizado com `Bearer`
- MCP com botão explícito de autenticação
- containerização pronta para EasyPanel

### Dependências externas ainda necessárias

- chaves reais do Supabase
- `DATABASE_URL`
- chave da OpenAI
- chave da Composio
- auth config do Google Calendar no Composio

## Licença

Uso privado/proprietário, conforme estratégia do produto.
