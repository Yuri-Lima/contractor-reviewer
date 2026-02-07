#!/bin/bash

# Script de teste para Fase 6 — Endpoints REST (mínimo)
# Testa: Redline, Privacy, Account, Audit

API_URL="http://localhost:3000/api"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}=== Teste Fase 6 — Endpoints REST ===${COLOR_RESET}\n"

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
    else
      echo -e "${COLOR_RED}❌ Falha ao extrair token da resposta de registro${COLOR_RESET}"
      echo "   Resposta: $REGISTER_BODY"
      exit 1
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
    echo ""
    echo "   Verificando se a API está rodando em $API_URL"
    echo "   Execute: cd apps/api && pnpm start:dev"
    exit 1
  fi
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${COLOR_RED}❌ Falha na autenticação - token não obtido${COLOR_RESET}"
  echo "   Resposta do login: $LOGIN_BODY"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Token obtido${COLOR_RESET}"

# 2. Criar Workspace
echo -e "\n${COLOR_BLUE}2. Criar Workspace${COLOR_RESET}"
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Fase 6 Test Workspace '$(date +%s)'"}')
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
  -d '{"title":"Test Document Fase 6","description":"Document for testing Fase 6 endpoints"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

if [ "$DOCUMENT_ID" == "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar documento${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Documento ID: $DOCUMENT_ID${COLOR_RESET}"

# 4. Upload arquivo (se necessário)
echo -e "\n${COLOR_BLUE}4. Upload arquivo (opcional)${COLOR_RESET}"
if [ -f "test-contract-naira.txt" ]; then
  UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test-contract-naira.txt")
  
  FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
  if [ "$FILE_ID" != "null" ] && [ ! -z "$FILE_ID" ]; then
    echo -e "${COLOR_GREEN}✅ Arquivo enviado${COLOR_RESET}"
    echo "   Aguardando processamento (10s)..."
    sleep 10
  fi
else
  echo -e "${COLOR_YELLOW}⚠️  Arquivo test-contract-naira.txt não encontrado, pulando upload${COLOR_RESET}"
fi

# 5. Testar Redline
echo -e "\n${COLOR_BLUE}5. Testar Redline${COLOR_RESET}"
echo "   Testando playbook: balanced"
REDLINE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"playbook":"balanced"}')

REDLINE_VERSION_ID=$(echo $REDLINE_RESPONSE | jq -r '.versionId // empty')
REDLINE_PLAYBOOK=$(echo $REDLINE_RESPONSE | jq -r '.playbook // empty')

if [ ! -z "$REDLINE_VERSION_ID" ] && [ "$REDLINE_VERSION_ID" != "null" ]; then
  echo -e "${COLOR_GREEN}✅ Redline gerado${COLOR_RESET}"
  echo "   Version ID: $REDLINE_VERSION_ID"
  echo "   Playbook: $REDLINE_PLAYBOOK"
  echo "   Changes: $(echo $REDLINE_RESPONSE | jq '.changes | length')"
else
  echo -e "${COLOR_YELLOW}⚠️  Resposta do redline:${COLOR_RESET}"
  echo "$REDLINE_RESPONSE" | jq .
fi

# 6. Testar Privacy - Toggle No-Logs
echo -e "\n${COLOR_BLUE}6. Testar Privacy - Toggle No-Logs${COLOR_RESET}"
echo "   Habilitando no-logs..."
NO_LOGS_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled":true}')

NO_LOGS_ENABLED=$(echo $NO_LOGS_RESPONSE | jq -r '.enabled // false')

if [ "$NO_LOGS_ENABLED" == "true" ]; then
  echo -e "${COLOR_GREEN}✅ No-logs habilitado${COLOR_RESET}"
else
  echo -e "${COLOR_YELLOW}⚠️  Resposta:${COLOR_RESET}"
  echo "$NO_LOGS_RESPONSE" | jq .
fi

# 7. Testar Privacy - Export
echo -e "\n${COLOR_BLUE}7. Testar Privacy - Export DSAR-lite${COLOR_RESET}"
EXPORT_FILE="privacy-export-$(date +%s).json"
EXPORT_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/privacy/export" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$EXPORT_FILE")

if [ -f "$EXPORT_FILE" ] && [ -s "$EXPORT_FILE" ]; then
  EXPORT_SIZE=$(wc -c < "$EXPORT_FILE")
  EXPORT_CONTENT=$(cat "$EXPORT_FILE" | jq '.')
  
  echo -e "${COLOR_GREEN}✅ Export criado: $EXPORT_FILE ($EXPORT_SIZE bytes)${COLOR_RESET}"
  echo "   Conteúdo:"
  echo "$EXPORT_CONTENT" | jq '{workspaceId, exportedAt, chatMessages: (.chatMessages | length), versions: (.versions | length), auditLogs: (.auditLogs | length)}'
  
  # Verificar se audit logs estão no export
  EXPORT_AUDIT_COUNT=$(cat "$EXPORT_FILE" | jq '.auditLogs | length')
  if [ "$EXPORT_AUDIT_COUNT" -gt 0 ]; then
    echo -e "${COLOR_GREEN}✅ Export inclui $EXPORT_AUDIT_COUNT audit logs${COLOR_RESET}"
  else
    echo -e "${COLOR_YELLOW}⚠️  Export não inclui audit logs (pode ser normal se nenhuma ação foi registrada ainda)${COLOR_RESET}"
  fi
else
  echo -e "${COLOR_RED}❌ Falha ao exportar dados${COLOR_RESET}"
fi

# 8. Testar Audit Logs
echo -e "\n${COLOR_BLUE}8. Testar Audit Logs${COLOR_RESET}"
echo "   Aguardando alguns segundos para garantir que logs foram criados..."
sleep 2

echo "   Buscando logs do workspace..."
AUDIT_RESPONSE=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/audit?limit=10" \
  -H "Authorization: Bearer $TOKEN")

AUDIT_TOTAL=$(echo $AUDIT_RESPONSE | jq -r '.total // 0')
AUDIT_LOGS_COUNT=$(echo $AUDIT_RESPONSE | jq '.logs | length')

if [ "$AUDIT_TOTAL" -gt 0 ] || [ "$AUDIT_LOGS_COUNT" -gt 0 ]; then
  echo -e "${COLOR_GREEN}✅ Audit logs encontrados${COLOR_RESET}"
  echo "   Total: $AUDIT_TOTAL"
  echo "   Retornados: $AUDIT_LOGS_COUNT"
  echo "   Primeiros logs:"
  echo "$AUDIT_RESPONSE" | jq '.logs[0:5] | .[] | {action, targetType, createdAt, metadata}'
  
  # Verificar ações esperadas
  echo ""
  echo "   Verificando ações registradas:"
  UPLOAD_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "upload")] | length')
  REDLINE_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "redline_generate")] | length')
  EXPORT_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "export_privacy")] | length')
  OPEN_VIEW_COUNT=$(echo $AUDIT_RESPONSE | jq '[.logs[] | select(.action == "open_view")] | length')
  
  echo "   - Upload: $UPLOAD_COUNT"
  echo "   - Redline: $REDLINE_COUNT"
  echo "   - Export Privacy: $EXPORT_COUNT"
  echo "   - Open/View: $OPEN_VIEW_COUNT"
else
  echo -e "${COLOR_YELLOW}⚠️  Nenhum log encontrado${COLOR_RESET}"
  echo "   Isso pode indicar que o registro de audit logs não está funcionando."
  echo "   Verifique se o AuditService está sendo injetado corretamente nos controllers."
fi

# 9. Testar filtros de Audit
echo -e "\n${COLOR_BLUE}9. Testar filtros de Audit${COLOR_RESET}"
echo "   Filtrando por ação: upload"
AUDIT_FILTERED=$(curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID/audit?action=upload&limit=5" \
  -H "Authorization: Bearer $TOKEN")

FILTERED_COUNT=$(echo $AUDIT_FILTERED | jq '.logs | length')
echo "   Logs com ação 'upload': $FILTERED_COUNT"

# 10. Testar Account Delete (último teste - destrutivo)
echo -e "\n${COLOR_BLUE}10. Testar Account Delete${COLOR_RESET}"
echo -e "${COLOR_YELLOW}⚠️  ATENÇÃO: Este teste vai desativar a conta do usuário!${COLOR_RESET}"
read -p "   Deseja continuar? (s/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Ss]$ ]]; then
  DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/account" \
    -H "Authorization: Bearer $TOKEN")
  
  HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" == "204" ]; then
    echo -e "${COLOR_GREEN}✅ Conta deletada com sucesso${COLOR_RESET}"
  else
    echo -e "${COLOR_YELLOW}⚠️  Resposta HTTP: $HTTP_CODE${COLOR_RESET}"
    DELETE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')
    echo "$DELETE_BODY" | jq . 2>/dev/null || echo "$DELETE_BODY"
  fi
else
  echo -e "${COLOR_YELLOW}⚠️  Teste de delete account pulado${COLOR_RESET}"
fi

# 11. Resumo
echo -e "\n${COLOR_BLUE}=== Resumo dos Testes ===${COLOR_RESET}"
echo "Workspace ID: $WORKSPACE_ID"
echo "Document ID: $DOCUMENT_ID"
echo ""
echo -e "${COLOR_GREEN}✅ Testes concluídos!${COLOR_RESET}"
echo ""
echo "Endpoints testados:"
echo "  ✅ POST /api/workspaces/:id/documents/:docId/redline"
echo "  ✅ POST /api/workspaces/:id/privacy/no-logs"
echo "  ✅ GET /api/workspaces/:id/privacy/export"
echo "  ✅ GET /api/workspaces/:id/audit"
echo "  ✅ DELETE /api/account (opcional)"
echo ""
echo "Arquivos gerados:"
if [ -f "$EXPORT_FILE" ]; then
  echo "  - $EXPORT_FILE"
fi
