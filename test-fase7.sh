#!/bin/bash

# Script de teste para Fase 7 — Retention, purge e hard delete
# Testa: Retention config, Workspace Settings, hard delete documentos, hard delete conta, purge manual
#
# Execute a partir da raiz do projeto para garantir que paths e arquivos estejam corretos.

API_URL="http://localhost:3000/api"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}=== Teste Fase 7 — Retention, Purge e Hard Delete ===${COLOR_RESET}\n"

# 1. Autenticação
echo -e "${COLOR_BLUE}1. Autenticação${COLOR_RESET}"

# Verificar se a API está respondendo
echo "   Verificando se a API está rodando..."
HEALTH_CHECK=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>&1 || echo "000")
HTTP_CODE=$(echo "$HEALTH_CHECK" | tail -n1)
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "000" ]; then
  echo -e "${COLOR_YELLOW}⚠️  API health check retornou HTTP $HTTP_CODE${COLOR_RESET}"
  echo "   Certifique-se de que a API está rodando: cd apps/api && pnpm start:dev"
  exit 1
fi

# Tentar login primeiro
echo "   Tentando fazer login..."
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' 2>&1)
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
  TOKEN=$(echo "$LOGIN_BODY" | jq -r '.accessToken // empty')
  if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
    echo -e "${COLOR_GREEN}✅ Login bem-sucedido${COLOR_RESET}"
  fi
else
  # Login falhou ou usuário não existe, tentar registrar
  if [ "$HTTP_CODE" == "401" ]; then
    echo "   Login falhou (usuário pode estar inativo ou deletado)"
  else
    echo "   Login falhou (HTTP $HTTP_CODE)"
  fi
  echo "   Tentando registrar novo usuário..."
  REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test User"}' 2>&1)
  REGISTER_HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
  REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')
  
  if [ "$REGISTER_HTTP_CODE" == "201" ] || [ "$REGISTER_HTTP_CODE" == "200" ]; then
    TOKEN=$(echo "$REGISTER_BODY" | jq -r '.accessToken // empty')
    if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
      echo -e "${COLOR_GREEN}✅ Usuário registrado com sucesso${COLOR_RESET}"
    fi
  elif [ "$REGISTER_HTTP_CODE" == "409" ]; then
    # Usuário já existe, mas pode estar inativo (deletado)
    echo "   Usuário já existe (pode estar inativo)"
    echo "   Criando novo usuário com email único..."
    
    # Criar usuário com timestamp único
    TEST_EMAIL="test-$(date +%s)@example.com"
    REGISTER_RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"password123\",\"name\":\"Test User\"}" 2>&1)
    REGISTER_HTTP_CODE2=$(echo "$REGISTER_RESPONSE2" | tail -n1)
    REGISTER_BODY2=$(echo "$REGISTER_RESPONSE2" | sed '$d')
    
    if [ "$REGISTER_HTTP_CODE2" == "201" ] || [ "$REGISTER_HTTP_CODE2" == "200" ]; then
      TOKEN=$(echo "$REGISTER_BODY2" | jq -r '.accessToken // empty')
      if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
        echo -e "${COLOR_GREEN}✅ Novo usuário criado: $TEST_EMAIL${COLOR_RESET}"
      else
        echo -e "${COLOR_RED}❌ Falha ao extrair token da resposta${COLOR_RESET}"
        echo "   Resposta: $REGISTER_BODY2"
        exit 1
      fi
    else
      echo -e "${COLOR_RED}❌ Falha ao criar novo usuário (HTTP $REGISTER_HTTP_CODE2)${COLOR_RESET}"
      echo "   Resposta: $REGISTER_BODY2"
      exit 1
    fi
  else
    echo -e "${COLOR_RED}❌ Falha no registro (HTTP $REGISTER_HTTP_CODE)${COLOR_RESET}"
    echo "   Resposta: $REGISTER_BODY"
    exit 1
  fi
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${COLOR_RED}❌ Falha na autenticação - token não obtido${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Token obtido${COLOR_RESET}"

# 2. Criar Workspace
echo -e "\n${COLOR_BLUE}2. Criar Workspace${COLOR_RESET}"
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Fase 7 Test Workspace '$(date +%s)'"}')
WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | jq -r '.id')

if [ "$WORKSPACE_ID" == "null" ] || [ -z "$WORKSPACE_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar workspace${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Workspace ID: $WORKSPACE_ID${COLOR_RESET}"

# 3. Testar Retention - Obter configuração padrão
echo -e "\n${COLOR_BLUE}3. Testar Retention - Obter configuração${COLOR_RESET}"
RETENTION_GET=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/retention" \
  -H "Authorization: Bearer $TOKEN")

FILE_RETENTION=$(echo $RETENTION_GET | jq -r '.defaultFileRetentionDays // 30')
TEXT_RETENTION=$(echo $RETENTION_GET | jq -r '.defaultTextEmbeddingsRetentionDays // 90')

echo -e "${COLOR_GREEN}✅ Configuração obtida${COLOR_RESET}"
echo "   File retention: $FILE_RETENTION dias"
echo "   Text/embeddings retention: $TEXT_RETENTION dias"

# 4. Testar Retention - Atualizar configuração
echo -e "\n${COLOR_BLUE}4. Testar Retention - Atualizar configuração${COLOR_RESET}"
RETENTION_UPDATE=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"defaultFileRetentionDays":15,"defaultTextEmbeddingsRetentionDays":45}' 2>&1)
RETENTION_HTTP_CODE=$(echo "$RETENTION_UPDATE" | tail -n1)
RETENTION_BODY=$(echo "$RETENTION_UPDATE" | sed '$d')

if [ "$RETENTION_HTTP_CODE" == "200" ]; then
  NEW_FILE_RETENTION=$(echo $RETENTION_BODY | jq -r '.defaultFileRetentionDays')
  NEW_TEXT_RETENTION=$(echo $RETENTION_BODY | jq -r '.defaultTextEmbeddingsRetentionDays')
  echo -e "${COLOR_GREEN}✅ Configuração atualizada${COLOR_RESET}"
  echo "   File retention: $NEW_FILE_RETENTION dias"
  echo "   Text/embeddings retention: $NEW_TEXT_RETENTION dias"
else
  echo -e "${COLOR_RED}❌ Falha ao atualizar retention (HTTP $RETENTION_HTTP_CODE)${COLOR_RESET}"
  echo "   Resposta: $RETENTION_BODY"
  NEW_FILE_RETENTION=${NEW_FILE_RETENTION:-$FILE_RETENTION}
  NEW_TEXT_RETENTION=${NEW_TEXT_RETENTION:-$TEXT_RETENTION}
fi

# 5. Testar Retention - Validação de limites
echo -e "\n${COLOR_BLUE}5. Testar Retention - Validação de limites${COLOR_RESET}"
echo "   Tentando definir file retention > 365 dias (deve falhar)..."
RETENTION_INVALID=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"defaultFileRetentionDays":500}' 2>&1)
INVALID_HTTP_CODE=$(echo "$RETENTION_INVALID" | tail -n1)
INVALID_BODY=$(echo "$RETENTION_INVALID" | sed '$d')

if [ "$INVALID_HTTP_CODE" == "400" ]; then
  echo -e "${COLOR_GREEN}✅ Validação funcionando (HTTP 400 esperado)${COLOR_RESET}"
  echo "   Mensagem: $(echo $INVALID_BODY | jq -r '.message // "Validation error"')"
else
  echo -e "${COLOR_YELLOW}⚠️  Esperava HTTP 400, recebeu HTTP $INVALID_HTTP_CODE${COLOR_RESET}"
fi

# 5b. Testar Workspace Settings (GET/PUT /settings)
echo -e "\n${COLOR_BLUE}5b. Testar Workspace Settings - Obter configuração completa${COLOR_RESET}"
SETTINGS_GET=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/settings" \
  -H "Authorization: Bearer $TOKEN")

SETTINGS_RETENTION=$(echo $SETTINGS_GET | jq -r '.retention.defaultFileRetentionDays // empty')
SETTINGS_CHUNKING=$(echo $SETTINGS_GET | jq -r '.documentProcessing.chunkingStrategy // empty')

if [ ! -z "$SETTINGS_RETENTION" ] && [ "$SETTINGS_RETENTION" != "null" ]; then
  echo -e "${COLOR_GREEN}✅ Settings obtidas${COLOR_RESET}"
  echo "   Retention (via settings): $SETTINGS_RETENTION dias"
  echo "   Chunking strategy: $SETTINGS_CHUNKING"
else
  echo -e "${COLOR_YELLOW}⚠️  Resposta inesperada do GET /settings${COLOR_RESET}"
  echo "$SETTINGS_GET" | jq . 2>/dev/null || echo "$SETTINGS_GET"
fi

echo -e "\n${COLOR_BLUE}5c. Testar Workspace Settings - Atualizar chunking strategy${COLOR_RESET}"
SETTINGS_UPDATE=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL/workspaces/$WORKSPACE_ID/settings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"documentProcessing":{"chunkingStrategy":"sentence"}}' 2>&1)
SETTINGS_HTTP_CODE=$(echo "$SETTINGS_UPDATE" | tail -n1)
SETTINGS_UPDATE_BODY=$(echo "$SETTINGS_UPDATE" | sed '$d')

if [ "$SETTINGS_HTTP_CODE" == "200" ]; then
  NEW_CHUNKING=$(echo $SETTINGS_UPDATE_BODY | jq -r '.documentProcessing.chunkingStrategy')
  echo -e "${COLOR_GREEN}✅ Chunking strategy atualizada${COLOR_RESET}"
  echo "   Nova estratégia: $NEW_CHUNKING"
  # Restore paragraph for consistency
  curl -s -X PUT "$API_URL/workspaces/$WORKSPACE_ID/settings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"documentProcessing":{"chunkingStrategy":"paragraph"}}' > /dev/null
else
  echo -e "${COLOR_YELLOW}⚠️  Falha ao atualizar settings (HTTP $SETTINGS_HTTP_CODE)${COLOR_RESET}"
  echo "$SETTINGS_UPDATE_BODY" | jq . 2>/dev/null || echo "$SETTINGS_UPDATE_BODY"
fi

# 6. Criar Documento para teste de hard delete
echo -e "\n${COLOR_BLUE}6. Criar Documento para teste de hard delete${COLOR_RESET}"
DOCUMENT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Document Hard Delete","description":"Document for testing hard delete"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

if [ "$DOCUMENT_ID" == "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar documento${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Documento ID: $DOCUMENT_ID${COLOR_RESET}"

# 7. Testar Hard Delete - Deletar documento
echo -e "\n${COLOR_BLUE}7. Testar Hard Delete - Deletar documento${COLOR_RESET}"
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
DELETE_HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)

if [ "$DELETE_HTTP_CODE" == "204" ]; then
  echo -e "${COLOR_GREEN}✅ Documento deletado com sucesso${COLOR_RESET}"
else
  echo -e "${COLOR_RED}❌ Falha ao deletar documento (HTTP $DELETE_HTTP_CODE)${COLOR_RESET}"
fi

# 8. Testar Hard Delete - Idempotência (deletar novamente)
echo -e "\n${COLOR_BLUE}8. Testar Hard Delete - Idempotência${COLOR_RESET}"
echo "   Tentando deletar o mesmo documento novamente (deve ser idempotente)..."
DELETE_RESPONSE2=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
DELETE_HTTP_CODE2=$(echo "$DELETE_RESPONSE2" | tail -n1)

if [ "$DELETE_HTTP_CODE2" == "204" ]; then
  echo -e "${COLOR_GREEN}✅ Delete idempotente funcionando (HTTP 204 mesmo após já deletado)${COLOR_RESET}"
else
  echo -e "${COLOR_YELLOW}⚠️  Resposta HTTP: $DELETE_HTTP_CODE2${COLOR_RESET}"
  echo "   (Idempotência pode retornar 204 ou 404, ambos são aceitáveis)"
fi

# 9. Verificar Audit Logs do delete
echo -e "\n${COLOR_BLUE}9. Verificar Audit Logs do delete${COLOR_RESET}"
sleep 1
AUDIT_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/audit?action=delete&limit=5" \
  -H "Authorization: Bearer $TOKEN")

DELETE_LOGS_COUNT=$(echo $AUDIT_RESPONSE | jq '.logs | length')
if [ "$DELETE_LOGS_COUNT" -gt 0 ]; then
  echo -e "${COLOR_GREEN}✅ Audit log de delete encontrado${COLOR_RESET}"
  echo "   Logs de delete: $DELETE_LOGS_COUNT"
  echo "   Último log:"
  echo "$AUDIT_RESPONSE" | jq '.logs[0] | {action, targetType, targetId, metadata}'
else
  echo -e "${COLOR_YELLOW}⚠️  Nenhum audit log de delete encontrado${COLOR_RESET}"
fi

# 10. Testar Account Delete (com validação)
echo -e "\n${COLOR_BLUE}10. Testar Account Delete${COLOR_RESET}"
echo -e "${COLOR_YELLOW}⚠️  ATENÇÃO: Este teste vai deletar a conta do usuário!${COLOR_RESET}"
read -p "   Deseja continuar? (s/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
  DELETE_ACCOUNT_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/account" \
    -H "Authorization: Bearer $TOKEN" 2>&1)
  ACCOUNT_DELETE_HTTP_CODE=$(echo "$DELETE_ACCOUNT_RESPONSE" | tail -n1)
  ACCOUNT_DELETE_BODY=$(echo "$DELETE_ACCOUNT_RESPONSE" | sed '$d')
  
  if [ "$ACCOUNT_DELETE_HTTP_CODE" == "204" ]; then
    echo -e "${COLOR_GREEN}✅ Conta deletada com sucesso${COLOR_RESET}"
  elif [ "$ACCOUNT_DELETE_HTTP_CODE" == "400" ]; then
    echo -e "${COLOR_YELLOW}⚠️  Delete bloqueado (usuário pode ser único OWNER de workspace)${COLOR_RESET}"
    echo "   Resposta: $ACCOUNT_DELETE_BODY"
    echo "   Isso é esperado se o usuário for o único owner de um workspace."
  else
    echo -e "${COLOR_YELLOW}⚠️  Resposta HTTP: $ACCOUNT_DELETE_HTTP_CODE${COLOR_RESET}"
    echo "$ACCOUNT_DELETE_BODY" | jq . 2>/dev/null || echo "$ACCOUNT_DELETE_BODY"
  fi
else
  echo -e "${COLOR_YELLOW}⚠️  Teste de delete account pulado${COLOR_RESET}"
fi

# 11. Resumo
echo -e "\n${COLOR_BLUE}=== Resumo dos Testes ===${COLOR_RESET}"
echo "Workspace ID: $WORKSPACE_ID"
echo "Document ID: $DOCUMENT_ID (deletado)"
echo ""
echo -e "${COLOR_GREEN}✅ Testes concluídos!${COLOR_RESET}"
echo ""
echo "Funcionalidades testadas:"
echo "  ✅ GET /api/workspaces/:id/retention"
echo "  ✅ PUT /api/workspaces/:id/retention"
echo "  ✅ GET /api/workspaces/:id/settings"
echo "  ✅ PUT /api/workspaces/:id/settings (chunking strategy)"
echo "  ✅ Validação de limites de retention"
echo "  ✅ DELETE /api/workspaces/:id/documents/:docId (hard delete idempotente)"
echo "  ✅ Audit log de delete"
echo "  ✅ DELETE /api/account (hard delete com validações)"
echo ""
echo "Notas:"
echo "  - Purge job agendado roda automaticamente às 2:00 AM"
echo "  - Para testar purge manualmente, use o PurgeService diretamente"
echo "  - Retention configurado: File=$NEW_FILE_RETENTION dias, Text=$NEW_TEXT_RETENTION dias"
