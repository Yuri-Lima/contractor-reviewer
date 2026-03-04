# Integração de Audit Logs Automáticos

Este documento descreve a integração do registro automático de audit logs nos controllers da Fase 6.

## Mudanças Implementadas

### 1. Módulos Atualizados

#### `DocumentsModule`
- ✅ Adicionado `AuditModule` aos imports
- Permite que `DocumentsController`, `ChatController` e `RedlineController` usem `AuditService`

#### `PrivacyModule`
- ✅ Adicionado `AuditModule` aos imports
- Permite que `PrivacyController` use `AuditService`

### 2. Controllers Atualizados

#### `DocumentsController`
Registra automaticamente:
- **`open_view`**: Quando um documento é visualizado (`GET /documents/:id`)
- **`upload`**: Quando um arquivo é enviado (`POST /documents/:id/files`)
  - Metadata: `fileName`, `mimeType`, `size`
- **`delete`**: Quando um documento é deletado (`DELETE /documents/:id`)

#### `ChatController`
Registra automaticamente:
- **`chat_query`**: Quando uma pergunta é feita no chat (`POST /documents/:id/chat`)
  - Metadata: `questionLength`, `hasAnswer`, `confidence`, `citationsCount`
  - **Importante**: O conteúdo da pergunta NÃO é logado (apenas o tamanho)

#### `RedlineController`
Registra automaticamente:
- **`redline_generate`**: Quando um redline é gerado (`POST /documents/:id/redline`)
  - Metadata: `playbook`, `changesCount`

#### `PrivacyController`
Registra automaticamente:
- **`export_privacy`**: Quando dados de privacidade são exportados (`GET /privacy/export`)
  - Metadata: `chatMessagesCount`, `versionsCount`, `auditLogsCount`

### 3. Informações Capturadas

Cada audit log inclui:
- `workspaceId`: ID do workspace
- `actorUserId`: ID do usuário que realizou a ação
- `action`: Tipo de ação (`AuditAction`)
- `targetType`: Tipo do alvo (`TargetType`)
- `targetId`: ID do alvo (documento, arquivo, etc.)
- `ip`: Endereço IP do cliente (considerando proxies)
- `userAgent`: User-Agent do cliente
- `metadata`: Metadados seguros (sem conteúdo sensível)
- `createdAt`: Timestamp automático

### 4. Privacidade e Segurança

✅ **Conformidade com requisitos:**
- ❌ **NÃO** loga conteúdo de contratos
- ❌ **NÃO** loga perguntas completas do chat (apenas tamanho)
- ❌ **NÃO** loga chunks ou embeddings
- ✅ Loga apenas metadados seguros (tamanhos, contagens, IDs)
- ✅ Loga ações e timestamps para auditoria

## Como Testar

Execute o script de teste:

```bash
./test-fase6.sh
```

O script agora verifica:
1. Se audit logs são criados após cada ação
2. Se os logs aparecem no endpoint `/audit`
3. Se os logs são incluídos no export de privacidade
4. Contagem de cada tipo de ação

## Exemplo de Audit Log

```json
{
  "id": "uuid",
  "workspaceId": "uuid",
  "actorUserId": "uuid",
  "action": "upload",
  "targetType": "file",
  "targetId": "uuid",
  "ip": "127.0.0.1",
  "userAgent": "curl/7.68.0",
  "metadata": {
    "fileName": "contract.pdf",
    "mimeType": "application/pdf",
    "size": 12345
  },
  "createdAt": "2026-02-04T22:33:11.023Z"
}
```

## Próximos Passos

1. ✅ Integração completa de audit logs nos controllers principais
2. ⏳ Integrar audit logs em outros endpoints (workspace members, settings, etc.)
3. ⏳ Implementar filtros avançados na UI
4. ⏳ Adicionar alertas para ações suspeitas
5. ⏳ Implementar retenção de audit logs conforme política

## Troubleshooting

### Audit logs não aparecem

1. **Verificar injeção de dependência:**
   - Confirmar que `AuditModule` está importado no módulo do controller
   - Confirmar que `AuditService` está injetado no constructor

2. **Verificar decorators:**
   - `@CurrentUser()` deve estar presente para capturar `userId`
   - `@RequestInfo()` deve estar presente para capturar `ip` e `userAgent`

3. **Verificar erros no console:**
   - Se houver erro ao criar audit log, verificar logs da API
   - Verificar se a tabela `audit_logs` existe no banco

4. **Verificar RBAC:**
   - Endpoint `/audit` requer role ADMIN ou OWNER
   - Verificar se o usuário tem permissão para visualizar logs
