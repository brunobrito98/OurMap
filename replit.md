# Event Management Platform

Uma plataforma completa de gerenciamento de eventos com sistema social, construída com React, Express.js e PostgreSQL.

## Visão Geral

Este é um aplicativo fullstack para criação, descoberta e participação em eventos com recursos sociais como sistema de amizades, chat, avaliações e notificações.

<<<<<<< HEAD
## Arquitetura
=======
**September 25, 2025**
- **Replit Environment Setup**: Successfully configured application for Replit environment
  - tsx already installed and configured in package.json devDependencies
  - Vite configuration properly set with host "0.0.0.0" and port 5000
  - allowedHosts: true configured in server/vite.ts for Replit proxy support
  - Workflow configured with webview output type for frontend display
  - Application successfully running with Supabase database connection
  - Mapbox integration configured with VITE_MAPBOX_ACCESS_TOKEN
  - Deploy configuration set for autoscale deployment target
- **Environment Variables**: MAPBOX_ACCESS_TOKEN configured and working
  - Admin user creation pending ADMIN_USERNAME and ADMIN_PASSWORD secrets
  - Email functionality disabled (SENDGRID_API_KEY not required)
  - Application fully operational with existing database data

**September 24, 2025**
- **Event Lifecycle Management**: Successfully implemented filtering and restriction system for ended events
  - Modified backend `getEvents()` query to filter out events that have already ended from main screen
  - Enhanced filtering logic to check `endTime` if available, otherwise uses `dateTime` for event completion
  - Added validation to `/api/events/:id/attend` endpoint to prevent attendance changes on ended events
  - Updated `EventDetails.tsx` frontend component to disable attendance buttons for ended events
  - Added visual indicator showing "Evento Finalizado" (Event Ended) when event has concluded
  - Implemented real-time validation using event end time or start time comparison with current time
  - Enhanced user experience by preventing interactions with past events while maintaining data integrity
- **SMS Authentication Removal**: Successfully completed full removal of SMS authentication system
  - Removed all SMS authentication routes from backend (/api/auth/phone/start, /verify, /link)
  - Updated registration system to accept optional phone number field without verification requirements
  - Enhanced profile update route (/api/user/profile) to handle phone number updates and clearing
  - Simplified frontend authentication to credentials-only, removing SMS verification UI components
  - Fixed ChangePhone.tsx to allow simple phone number updates without SMS verification
  - Phone number is now purely optional contact information with no verification requirements
  - Maintained data consistency with phoneE164, phoneCountry, and phoneVerified fields in database
  - Application now functions completely without Twilio dependencies or SMS verification
>>>>>>> b4834d820d9b5fb53e5ca847f2282afbcbe31e5a

### Frontend
- **Framework**: React 18 com TypeScript
- **Roteamento**: Wouter
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **Estado**: TanStack Query (React Query)
- **Mapas**: Mapbox GL JS
- **Bundler**: Vite

### Backend
- **Runtime**: Node.js com TypeScript
- **Framework**: Express.js
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Supabase)
- **Autenticação**: Sistema híbrido (Replit Auth + Local Auth)
- **Upload**: Multer para arquivos
- **Email**: SendGrid (opcional)
- **SMS**: Twilio (para verificação de telefone)

### Recursos Principais

1. **Sistema de Eventos**
   - Criação e edição de eventos
   - Categorização hierárquica
   - Localização com mapas (Mapbox)
   - Eventos públicos e privados
   - Sistema de convites
   - Crowdfunding/vaquinhas
   - Eventos recorrentes

2. **Sistema Social**
   - Sistema de amizades
   - Chat privado entre usuários
   - Avaliações de eventos e organizadores
   - Notificações em tempo real

3. **Autenticação**
   - Login com Replit Auth
   - Registro local com username/password
   - Sistema de reset de senha
   - Autenticação por telefone (preparado)

## Configuração do Ambiente

### Secrets Necessários

O projeto requer os seguintes secrets configurados no Replit:

- `DATABASE_URL`: String de conexão do PostgreSQL/Supabase
- `MAPBOX_ACCESS_TOKEN`: Token de acesso do Mapbox ✓ (configurado)
- `ADMIN_USERNAME`: Username para usuário admin inicial
- `ADMIN_PASSWORD`: Senha para usuário admin inicial
- `SENDGRID_API_KEY`: Chave da API do SendGrid (opcional)
- `TWILIO_ACCOUNT_SID`: SID da conta Twilio (opcional)
- `TWILIO_AUTH_TOKEN`: Token de autenticação Twilio (opcional)

### Estado Atual da Configuração

✅ **Funcionando**:
- Servidor Express rodando na porta 5000
- Frontend React servido pelo Vite
- Conexão com banco Supabase estabelecida
- Mapbox configurado
- Sistema de roteamento funcionando
- APIs respondendo corretamente

⚠️ **Pendente**:
- Configuração de ADMIN_USERNAME e ADMIN_PASSWORD
- SendGrid (opcional para emails)
- Twilio (opcional para SMS)

## Scripts Disponíveis

- `npm run dev`: Inicia servidor de desenvolvimento
- `npm run build`: Build para produção
- `npm run start`: Inicia servidor de produção
- `npm run db:push`: Sincroniza schema do banco

## Deploy

O projeto está configurado para deploy no Replit com:
- **Tipo**: Autoscale
- **Build**: `npm run build`
- **Start**: `npm run start`
- **Porta**: 5000

## Estrutura de Pastas

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes React + UI
│   │   ├── pages/          # Páginas/rotas
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilitários
├── server/                 # Backend Express
│   ├── auth.ts            # Sistema de autenticação
│   ├── db.ts              # Configuração do banco
│   ├── routes.ts          # Rotas da API
│   └── storage.ts         # Interface de dados
├── shared/                 # Schemas compartilhados
└── migrations/             # Migrações do banco
```

## Data Model

O banco utiliza PostgreSQL com as seguintes entidades principais:
- `users`: Usuários e autenticação
- `events`: Eventos e detalhes
- `categories`: Categorias hierárquicas
- `event_attendees`: Participação em eventos
- `friendships`: Sistema de amizades
- `conversations`: Conversas de chat
- `notifications`: Sistema de notificações
- `event_ratings`: Avaliações de eventos

## Últimas Atualizações

**25/09/2025 20:50**:
- Projeto importado e configurado para o Replit
- Workflow configurado com output webview na porta 5000
- Conexão com Supabase estabelecida
- Frontend e backend comunicando corretamente
- Mapbox configurado e funcionando
- Aguardando configuração dos secrets de admin

## Próximos Passos

1. Configurar ADMIN_USERNAME e ADMIN_PASSWORD nos secrets
2. Verificar funcionamento completo da aplicação
3. Testar criação de eventos e sistema social
4. Configurar SendGrid se necessário para emails