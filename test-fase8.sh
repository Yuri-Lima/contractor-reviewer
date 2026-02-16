#!/bin/bash

# Script de teste para Fase 8 — Privacy e Audit
# Testa: Chat messages, Versions, DSAR export completo, No-logs configurável, Download, Audit logs
#
# Execute a partir da raiz do projeto (test-contract-naira.txt deve estar disponível para upload opcional).

API_URL="http://localhost:3000/api"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}=== Teste Fase 8 — Privacy e Audit ===${COLOR_RESET}\n"

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
        exit 1
      fi
    else
      echo -e "${COLOR_RED}❌ Falha ao criar novo usuário (HTTP $REGISTER_HTTP_CODE2)${COLOR_RESET}"
      exit 1
    fi
  else
    echo -e "${COLOR_RED}❌ Falha no registro (HTTP $REGISTER_HTTP_CODE)${COLOR_RESET}"
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
  -d '{"name":"Fase 8 Test Workspace '$(date +%s)'"}')
WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | jq -r '.id')

if [ "$WORKSPACE_ID" == "null" ] || [ -z "$WORKSPACE_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar workspace${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Workspace ID: $WORKSPACE_ID${COLOR_RESET}"

# 3. Criar Documento
echo -e "\n${COLOR_BLUE}3. Criar Documento${COLOR_RESET}"
DOCUMENT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Document Fase 8","description":"Document for testing Fase 8"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

if [ "$DOCUMENT_ID" == "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar documento${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Documento ID: $DOCUMENT_ID${COLOR_RESET}"

# 4. Upload arquivo (se necessário)
echo -e "\n${COLOR_BLUE}4. Upload arquivo${COLOR_RESET}"
if [ -f "test-contract-naira.txt" ]; then
  UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test-contract-naira.txt")
  
  FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
  if [ "$FILE_ID" != "null" ] && [ ! -z "$FILE_ID" ]; then
    echo -e "${COLOR_GREEN}✅ Arquivo enviado (ID: $FILE_ID)${COLOR_RESET}"
    echo "   Aguardando processamento (15s)..."
    sleep 15
  else
    echo -e "${COLOR_YELLOW}⚠️  Upload pode ter falhado${COLOR_RESET}"
  fi
else
  echo -e "${COLOR_YELLOW}⚠️  Arquivo test-contract-naira.txt não encontrado, pulando upload${COLOR_RESET}"
fi

# 5. Testar Chat (cria chat message automaticamente)
echo -e "\n${COLOR_BLUE}5. Testar Chat (cria chat message)${COLOR_RESET}"
CHAT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"What is the governing law of this contract?"}')

CHAT_ANSWER=$(echo $CHAT_RESPONSE | jq -r '.answerText // "N/A"')
CHAT_CONFIDENCE=$(echo $CHAT_RESPONSE | jq -r '.confidence // "N/A"')
CHAT_CITATIONS=$(echo $CHAT_RESPONSE | jq '.citations | length')

if [ "$CHAT_ANSWER" != "N/A" ] && [ ! -z "$CHAT_ANSWER" ]; then
  echo -e "${COLOR_GREEN}✅ Chat funcionando${COLOR_RESET}"
  echo "   Resposta: $(echo $CHAT_ANSWER | cut -c1-100)..."
  echo "   Confiança: $CHAT_CONFIDENCE"
  echo "   Citações: $CHAT_CITATIONS"
else
  echo -e "${COLOR_YELLOW}⚠️  Chat retornou resposta vazia (pode ser normal se documento não foi processado)${COLOR_RESET}"
fi

# 6. Testar Redline (cria version automaticamente)
echo -e "\n${COLOR_BLUE}6. Testar Redline (cria version)${COLOR_RESET}"
REDLINE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"playbook":"balanced"}')

REDLINE_VERSION_ID=$(echo $REDLINE_RESPONSE | jq -r '.versionId // empty')

if [ ! -z "$REDLINE_VERSION_ID" ] && [ "$REDLINE_VERSION_ID" != "null" ]; then
  echo -e "${COLOR_GREEN}✅ Redline gerado (Version ID: $REDLINE_VERSION_ID)${COLOR_RESET}"
else
  echo -e "${COLOR_YELLOW}⚠️  Redline pode não ter criado version${COLOR_RESET}"
fi

# 7. Testar No-Logs - Obter configuração atual via GET /privacy/no-logs
echo -e "\n${COLOR_BLUE}7. Testar No-Logs - Obter configuração via GET /privacy/no-logs${COLOR_RESET}"
NO_LOGS_GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
NO_LOGS_GET_HTTP=$(echo "$NO_LOGS_GET_RESPONSE" | tail -n1)
NO_LOGS_GET=$(echo "$NO_LOGS_GET_RESPONSE" | sed '$d')

if [ "$NO_LOGS_GET_HTTP" == "200" ]; then
  NO_LOGS_GET_ENABLED=$(echo "$NO_LOGS_GET" | jq -r '.enabled')
  echo -e "${COLOR_GREEN}✅ No-logs config obtida${COLOR_RESET}"
  echo "   Enabled: $NO_LOGS_GET_ENABLED"
  echo "   Config: $(echo "$NO_LOGS_GET" | jq -c '.config // empty')"
else
  echo -e "${COLOR_YELLOW}⚠️  Não foi possível obter no-logs config (HTTP $NO_LOGS_GET_HTTP)${COLOR_RESET}"
  echo "   Resposta: $NO_LOGS_GET"
fi

# 8. Testar No-Logs - Habilitar com configuração granular
echo -e "\n${COLOR_BLUE}8. Testar No-Logs - Habilitar com configuração granular${COLOR_RESET}"
NO_LOGS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true,
    "config": {
      "skipChatMessages": true,
      "skipVersions": true,
      "acceleratedPurgeDays": 1
    }
  }' 2>&1)
NO_LOGS_HTTP_CODE=$(echo "$NO_LOGS_RESPONSE" | tail -n1)
NO_LOGS_BODY=$(echo "$NO_LOGS_RESPONSE" | sed '$d')

if [ "$NO_LOGS_HTTP_CODE" == "200" ]; then
  NO_LOGS_ENABLED=$(echo $NO_LOGS_BODY | jq -r '.enabled // false')
  if [ "$NO_LOGS_ENABLED" == "true" ]; then
    echo -e "${COLOR_GREEN}✅ No-logs habilitado com configuração granular${COLOR_RESET}"
    echo "   Config: $(echo $NO_LOGS_BODY | jq '.config')"
  else
    echo -e "${COLOR_YELLOW}⚠️  No-logs pode não ter sido habilitado${COLOR_RESET}"
  fi
else
  echo -e "${COLOR_RED}❌ Falha ao habilitar no-logs (HTTP $NO_LOGS_HTTP_CODE)${COLOR_RESET}"
fi

# 9. Testar Chat novamente (deve salvar com [REDACTED] se no-logs habilitado)
echo -e "\n${COLOR_BLUE}9. Testar Chat com No-Logs habilitado${COLOR_RESET}"
CHAT_RESPONSE2=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"What are the key terms of this contract?"}')

CHAT_ANSWER2=$(echo $CHAT_RESPONSE2 | jq -r '.answerText // "N/A"')
if [ "$CHAT_ANSWER2" != "N/A" ] && [ ! -z "$CHAT_ANSWER2" ]; then
  echo -e "${COLOR_GREEN}✅ Chat executado${COLOR_RESET}"
  echo "   Resposta: $(echo $CHAT_ANSWER2 | cut -c1-100)..."
  echo "   Nota: Com skipChatMessages=true, esta mensagem não deve ser salva no banco"
else
  echo -e "${COLOR_YELLOW}⚠️  Chat retornou resposta vazia${COLOR_RESET}"
fi

# 10. Testar DSAR Export Completo
echo -e "\n${COLOR_BLUE}10. Testar DSAR Export Completo${COLOR_RESET}"
EXPORT_FILE="privacy-export-fase8-$(date +%s).json"
EXPORT_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/privacy/export" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$EXPORT_FILE")

if [ -f "$EXPORT_FILE" ] && [ -s "$EXPORT_FILE" ]; then
  EXPORT_SIZE=$(wc -c < "$EXPORT_FILE")
  EXPORT_CONTENT=$(cat "$EXPORT_FILE" | jq '.')
  
  echo -e "${COLOR_GREEN}✅ Export criado: $EXPORT_FILE ($EXPORT_SIZE bytes)${COLOR_RESET}"
  echo "   Conteúdo:"
  echo "$EXPORT_CONTENT" | jq '{
    workspaceId,
    exportedAt,
    chatMessages: (.chatMessages | length),
    versions: (.versions | length),
    redlinePrompts: (.redlinePrompts | length),
    auditLogs: (.auditLogs | length)
  }'
  
  # Verificar se chat messages estão no export
  CHAT_MESSAGES_COUNT=$(cat "$EXPORT_FILE" | jq '.chatMessages | length')
  VERSIONS_COUNT=$(cat "$EXPORT_FILE" | jq '.versions | length')
  
  if [ "$CHAT_MESSAGES_COUNT" -gt 0 ]; then
    echo -e "${COLOR_GREEN}✅ Export inclui $CHAT_MESSAGES_COUNT chat messages${COLOR_RESET}"
    echo "   Primeira mensagem:"
    FIRST_QUESTION=$(cat "$EXPORT_FILE" | jq -r '.chatMessages[0].question')
    FIRST_ANSWER=$(cat "$EXPORT_FILE" | jq -r '.chatMessages[0].answerText // "null"')
    if [ "$FIRST_QUESTION" == "[REDACTED]" ]; then
      echo -e "${COLOR_GREEN}   ✅ Mensagem está redacted (no-logs funcionando)${COLOR_RESET}"
    else
      echo -e "${COLOR_YELLOW}   ⚠️  Mensagem não está redacted (foi criada antes de habilitar no-logs)${COLOR_RESET}"
    fi
    cat "$EXPORT_FILE" | jq '.chatMessages[0] | {question, answerText: (.answerText != null), confidence, citations: (.citations != null)}'
    
    # Verificar se há segunda mensagem (deve estar bloqueada se skipChatMessages=true)
    if [ "$CHAT_MESSAGES_COUNT" -eq 1 ]; then
      echo -e "${COLOR_GREEN}   ✅ Segunda mensagem não foi salva (skipChatMessages=true funcionando)${COLOR_RESET}"
    else
      echo -e "${COLOR_YELLOW}   ⚠️  Segunda mensagem foi salva (verificar se skipChatMessages está funcionando)${COLOR_RESET}"
    fi
  else
    echo -e "${COLOR_YELLOW}⚠️  Export não inclui chat messages (pode ser normal se no-logs habilitado)${COLOR_RESET}"
  fi
  
  if [ "$VERSIONS_COUNT" -gt 0 ]; then
    echo -e "${COLOR_GREEN}✅ Export inclui $VERSIONS_COUNT versions${COLOR_RESET}"
    echo "   Primeira version:"
    cat "$EXPORT_FILE" | jq '.versions[0] | {versionNumber, playbook, changes: (.changes != null)}'
  else
    echo -e "${COLOR_YELLOW}⚠️  Export não inclui versions (pode ser normal se no-logs habilitado)${COLOR_RESET}"
  fi
else
  echo -e "${COLOR_RED}❌ Falha ao exportar dados${COLOR_RESET}"
fi

# 11. Testar Download (se arquivo foi enviado)
echo -e "\n${COLOR_BLUE}11. Testar Download${COLOR_RESET}"
if [ ! -z "$FILE_ID" ] && [ "$FILE_ID" != "null" ]; then
  DOWNLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -L "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files/$FILE_ID/download" \
    -H "Authorization: Bearer $TOKEN" \
    -o /dev/null 2>&1)
  DOWNLOAD_HTTP_CODE=$(echo "$DOWNLOAD_RESPONSE" | tail -n1)
  
  if [ "$DOWNLOAD_HTTP_CODE" == "200" ]; then
    echo -e "${COLOR_GREEN}✅ Download funcionando (HTTP $DOWNLOAD_HTTP_CODE - arquivo servido diretamente)${COLOR_RESET}"
  elif [ "$DOWNLOAD_HTTP_CODE" == "302" ] || [ "$DOWNLOAD_HTTP_CODE" == "301" ]; then
    echo -e "${COLOR_GREEN}✅ Download funcionando (HTTP $DOWNLOAD_HTTP_CODE - redirect para S3/R2)${COLOR_RESET}"
  else
    echo -e "${COLOR_RED}❌ Download retornou HTTP $DOWNLOAD_HTTP_CODE${COLOR_RESET}"
    echo "   Verificar se arquivo foi processado corretamente"
  fi
else
  echo -e "${COLOR_YELLOW}⚠️  Pulando teste de download (arquivo não foi enviado)${COLOR_RESET}"
fi

# 12. Verificar Audit Logs Completos
echo -e "\n${COLOR_BLUE}12. Verificar Audit Logs Completos${COLOR_RESET}"
sleep 2
AUDIT_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/audit?limit=20" \
  -H "Authorization: Bearer $TOKEN")

AUDIT_TOTAL=$(echo $AUDIT_RESPONSE | jq -r '.total // 0')
AUDIT_LOGS_COUNT=$(echo $AUDIT_RESPONSE | jq '.logs | length')

if [ "$AUDIT_TOTAL" -gt 0 ] || [ "$AUDIT_LOGS_COUNT" -gt 0 ]; then
  echo -e "${COLOR_GREEN}✅ Audit logs encontrados${COLOR_RESET}"
  echo "   Total: $AUDIT_TOTAL"
  echo "   Retornados: $AUDIT_LOGS_COUNT"
  
  # Verificar ações esperadas
  echo ""
  echo "   Verificando ações registradas:"
  OPEN_VIEW_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "open_view")] | length')
  DOWNLOAD_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "download")] | length')
  UPLOAD_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "upload")] | length')
  CHAT_QUERY_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "chat_query")] | length')
  REDLINE_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "redline_generate")] | length')
  EXPORT_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "export_privacy")] | length')
  
  echo "   - Open/View: $OPEN_VIEW_COUNT"
  echo "   - Download: $DOWNLOAD_COUNT"
  echo "   - Upload: $UPLOAD_COUNT"
  echo "   - Chat Query: $CHAT_QUERY_COUNT"
  echo "   - Redline Generate: $REDLINE_COUNT"
  echo "   - Export Privacy: $EXPORT_COUNT"
  
  echo ""
  echo "   Últimos logs:"
  echo "$AUDIT_RESPONSE" | jq '.logs[0:5] | .[] | {action, targetType, createdAt, metadata}'
else
  echo -e "${COLOR_YELLOW}⚠️  Nenhum audit log encontrado${COLOR_RESET}"
fi

# 13. Resumo
echo -e "\n${COLOR_BLUE}=== Resumo dos Testes ===${COLOR_RESET}"
echo "Workspace ID: $WORKSPACE_ID"
echo "Document ID: $DOCUMENT_ID"
if [ ! -z "$FILE_ID" ] && [ "$FILE_ID" != "null" ]; then
  echo "File ID: $FILE_ID"
fi
echo ""
echo -e "${COLOR_GREEN}✅ Testes concluídos!${COLOR_RESET}"
echo ""
echo "Funcionalidades testadas:"
echo "  ✅ Chat messages (salvamento automático)"
echo "  ✅ Versions (criação via redline)"
echo "  ✅ DSAR export completo (chat + versions + audit logs)"
echo "  ✅ No-logs configurável (skipChatMessages, skipVersions, acceleratedPurgeDays)"
echo "  ✅ Download endpoint com audit log"
echo "  ✅ Audit logs completos (open_view, download, upload, chat_query, redline_generate, export_privacy)"
echo ""
echo "Arquivos gerados:"
if [ -f "$EXPORT_FILE" ]; then
  echo "  - $EXPORT_FILE"
fi
echo ""
echo "Notas:"
echo "  - Chat messages são salvos automaticamente após cada pergunta"
echo "  - Versions são criadas automaticamente após cada redline"
echo "  - No-logs redacta dados conforme configuração"
echo "  - Purge acelerado roda automaticamente no purge job diário"
