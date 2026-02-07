#!/bin/bash

# Script de teste para Fase 5 — RAG e citações
# Testa o fluxo completo: upload -> processamento -> chat com RAG

API_URL="http://localhost:3000/api"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_BLUE}=== Teste Fase 5 — RAG e Citações ===${COLOR_RESET}\n"

# 1. Login/Registro
echo -e "${COLOR_BLUE}1. Autenticação${COLOR_RESET}"
# Usar email único baseado em timestamp para evitar conflitos
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="password123"
TEST_NAME="Test User"

echo "   Registrando usuário: $TEST_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken // empty')

# Se registro falhou (usuário já existe ou outro erro), tentar login
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "   Registro falhou, tentando login..."
  HTTP_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.statusCode // empty')
  if [ "$HTTP_CODE" == "409" ]; then
    # Usuário já existe, usar email fixo e tentar login
    TEST_EMAIL="test@example.com"
    echo "   Tentando login com: $TEST_EMAIL"
    TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" | jq -r '.accessToken')
  fi
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${COLOR_RED}❌ Falha na autenticação${COLOR_RESET}"
  echo "   Resposta do registro:"
  echo "$REGISTER_RESPONSE" | jq .
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Token obtido${COLOR_RESET}"

# 2. Criar Workspace
echo -e "\n${COLOR_BLUE}2. Criar Workspace${COLOR_RESET}"
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"RAG Test Workspace '$(date +%s)'"}')
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
  -d '{"title":"Sample Contract","description":"Test contract for RAG"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

if [ "$DOCUMENT_ID" == "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo -e "${COLOR_RED}❌ Falha ao criar documento${COLOR_RESET}"
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Documento ID: $DOCUMENT_ID${COLOR_RESET}"

# 4. Preparar arquivo de teste
echo -e "\n${COLOR_BLUE}4. Preparar arquivo de teste${COLOR_RESET}"
TEST_FILE="test-contract-naira.txt"

if [ ! -f "$TEST_FILE" ]; then
  echo -e "${COLOR_RED}❌ Arquivo de teste não encontrado: $TEST_FILE${COLOR_RESET}"
  echo "   Por favor, certifique-se de que o arquivo existe no diretório atual."
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Arquivo preparado: $TEST_FILE${COLOR_RESET}"

# 5. Upload do arquivo
echo -e "\n${COLOR_BLUE}5. Upload do arquivo${COLOR_RESET}"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE")

FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
FILE_STATUS=$(echo $UPLOAD_RESPONSE | jq -r '.status')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo -e "${COLOR_RED}❌ Upload falhou:${COLOR_RESET}"
  echo $UPLOAD_RESPONSE | jq .
  exit 1
fi

echo -e "${COLOR_GREEN}✅ Arquivo enviado (ID: $FILE_ID, Status: $FILE_STATUS)${COLOR_RESET}"

# 6. Aguardar processamento completo
echo -e "\n${COLOR_BLUE}6. Aguardar processamento completo${COLOR_RESET}"
echo "   (parsing -> chunking -> embeddings)"
MAX_WAIT=120
WAIT_INTERVAL=5
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  DOCUMENT_STATUS=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  
  echo -ne "\r   Aguardando... ${ELAPSED}s (Status: $DOCUMENT_STATUS)"
  
  if [ "$DOCUMENT_STATUS" == "available" ]; then
    echo -e "\n${COLOR_GREEN}✅ Documento processado!${COLOR_RESET}"
    break
  elif [ "$DOCUMENT_STATUS" == "error" ]; then
    echo -e "\n${COLOR_RED}❌ Erro no processamento${COLOR_RESET}"
    exit 1
  fi
  
  sleep $WAIT_INTERVAL
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
done

if [ "$DOCUMENT_STATUS" != "available" ]; then
  echo -e "\n${COLOR_YELLOW}⚠️  Timeout aguardando processamento (Status: $DOCUMENT_STATUS)${COLOR_RESET}"
fi

# 7. Verificar jurisdição resolvida
echo -e "\n${COLOR_BLUE}7. Verificar resolução de jurisdição${COLOR_RESET}"
DOCUMENT_INFO=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN")

JURISDICTION=$(echo $DOCUMENT_INFO | jq -r '.resolvedJurisdiction // "N/A"')
JURISDICTION_STATUS=$(echo $DOCUMENT_INFO | jq -r '.jurisdictionStatus // "N/A"')

echo "   Jurisdição: $JURISDICTION"
echo "   Status: $JURISDICTION_STATUS"

if [ "$JURISDICTION" != "null" ] && [ "$JURISDICTION" != "N/A" ]; then
  echo -e "${COLOR_GREEN}✅ Jurisdição resolvida${COLOR_RESET}"
else
  echo -e "${COLOR_YELLOW}⚠️  Jurisdição não resolvida${COLOR_RESET}"
fi

# 8. Verificar chunks e embeddings
echo -e "\n${COLOR_BLUE}8. Verificar chunks e embeddings no banco${COLOR_RESET}"
CHUNKS_COUNT=$(docker exec contractai-postgres psql -U contractai -d contractai -t -c "SELECT COUNT(*) FROM chunks WHERE \"documentId\" = '$DOCUMENT_ID';" | tr -d ' ')
EMBEDDINGS_COUNT=$(docker exec contractai-postgres psql -U contractai -d contractai -t -c "SELECT COUNT(*) FROM chunks WHERE \"documentId\" = '$DOCUMENT_ID' AND embedding IS NOT NULL;" | tr -d ' ')

echo "   Chunks criados: $CHUNKS_COUNT"
echo "   Embeddings gerados: $EMBEDDINGS_COUNT"

if [ "$CHUNKS_COUNT" == "0" ]; then
  echo -e "${COLOR_RED}   ❌ Nenhum chunk foi criado!${COLOR_RESET}"
  echo "   Verificando jobs..."
  docker exec contractai-postgres psql -U contractai -d contractai -c "SELECT type, status, \"lastError\" FROM document_jobs WHERE \"documentId\" = '$DOCUMENT_ID' ORDER BY \"createdAt\" DESC;"
  echo ""
  echo -e "${COLOR_YELLOW}   ⚠️  O pipeline não completou. Verifique:${COLOR_RESET}"
  echo "   1. Worker está rodando? (cd apps/api && pnpm start:worker)"
  echo "   2. Redis está acessível?"
  echo "   3. Texto foi extraído do arquivo?"
  echo ""
  echo "   Continuando com teste de chat mesmo assim..."
elif [ "$EMBEDDINGS_COUNT" == "0" ]; then
  echo -e "${COLOR_YELLOW}   ⚠️  Chunks criados mas embeddings não foram gerados!${COLOR_RESET}"
  echo "   Verificando jobs de embedding..."
  EMBEDDING_ERROR=$(docker exec contractai-postgres psql -U contractai -d contractai -t -c "SELECT \"lastError\" FROM document_jobs WHERE \"documentId\" = '$DOCUMENT_ID' AND type = 'embedding' ORDER BY \"createdAt\" DESC LIMIT 1;" | tr -d ' ')
  
  if [ ! -z "$EMBEDDING_ERROR" ] && [ "$EMBEDDING_ERROR" != "" ]; then
    echo -e "${COLOR_RED}   ❌ Erro no job de embedding:${COLOR_RESET}"
    echo "   $EMBEDDING_ERROR"
    
    if echo "$EMBEDDING_ERROR" | grep -q "quota\|429"; then
      echo ""
      echo -e "${COLOR_RED}   ⚠️  PROBLEMA: OpenAI API quota excedida!${COLOR_RESET}"
      echo "   - Verifique sua conta OpenAI: https://platform.openai.com/account/billing"
      echo "   - Adicione créditos ou verifique limites de uso"
      echo "   - O chat não funcionará sem embeddings gerados"
    fi
  else
    echo "   Status dos jobs:"
    docker exec contractai-postgres psql -U contractai -d contractai -c "SELECT type, status, progress, \"lastError\" FROM document_jobs WHERE \"documentId\" = '$DOCUMENT_ID' AND type = 'embedding' ORDER BY \"createdAt\" DESC;"
  fi
  
  echo ""
  echo -e "${COLOR_YELLOW}   ⚠️  Verifique também:${COLOR_RESET}"
  echo "   1. OPENAI_API_KEY está configurada no .env?"
  echo "   2. Worker está rodando? (cd apps/api && pnpm start:worker)"
  echo "   3. Há erros nos logs do worker?"
  echo ""
  echo -e "${COLOR_YELLOW}   ⚠️  O chat retornará erro até que embeddings sejam gerados${COLOR_RESET}"
fi

# 9. Testar Chat com RAG
echo -e "\n${COLOR_BLUE}9. Testar Chat com RAG${COLOR_RESET}"

QUESTIONS=(
  "A clasula de Data protection esta alinhada com a leis atuais de protecao de dados na irlanda?"
  "A clausula de pensao esta alinhado com a nova lei que comecou a ter efeito em janeiro de 2026?"
  "O notice period esta alinhado com as leis da irlanda?"
  "O sick leave esta de acordo com as leis da irlanda?"
)

for i in "${!QUESTIONS[@]}"; do
  QUESTION="${QUESTIONS[$i]}"
  echo -e "\n   Pergunta $((i+1)): ${COLOR_YELLOW}$QUESTION${COLOR_RESET}"
  
  CHAT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"question\":\"$QUESTION\"}")
  
  # Debug: mostrar resposta completa se houver erro
  if echo "$CHAT_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${COLOR_RED}   ❌ Erro na API:${COLOR_RESET}"
    echo "$CHAT_RESPONSE" | jq .
    continue
  fi
  
  ANSWER=$(echo $CHAT_RESPONSE | jq -r '.answerText // empty')
  CONFIDENCE=$(echo $CHAT_RESPONSE | jq -r '.confidence // "N/A"')
  NOT_FOUND=$(echo $CHAT_RESPONSE | jq -r '.notFound // false')
  CITATIONS_COUNT=$(echo $CHAT_RESPONSE | jq '.citations | length // 0')
  
  if [ -z "$ANSWER" ] || [ "$ANSWER" == "null" ]; then
    echo -e "${COLOR_RED}   ❌ Resposta vazia ou inválida${COLOR_RESET}"
    echo "   Resposta completa da API:"
    echo "$CHAT_RESPONSE" | jq .
    continue
  fi
  
  echo "   Resposta: $ANSWER"
  echo "   Confiança: $CONFIDENCE"
  echo "   Não encontrado: $NOT_FOUND"
  echo "   Citações: $CITATIONS_COUNT"
  
  if [ "$CITATIONS_COUNT" -gt 0 ]; then
    echo "   Citações detalhadas:"
    echo $CHAT_RESPONSE | jq '.citations[] | {type, fileName, pageNumber, sourceName, quoteSnippet}'
  fi
  
  if [ "$NOT_FOUND" == "true" ]; then
    echo -e "${COLOR_YELLOW}⚠️  Resposta não encontrada${COLOR_RESET}"
  elif [ "$CONFIDENCE" == "high" ]; then
    echo -e "${COLOR_GREEN}✅ Alta confiança${COLOR_RESET}"
  elif [ "$CONFIDENCE" == "medium" ]; then
    echo -e "${COLOR_YELLOW}⚠️  Confiança média${COLOR_RESET}"
  else
    echo -e "${COLOR_YELLOW}⚠️  Baixa confiança${COLOR_RESET}"
  fi
  
  sleep 2  # Rate limiting
done

# 10. Resumo final
echo -e "\n${COLOR_BLUE}=== Resumo do Teste ===${COLOR_RESET}"
echo "Workspace ID: $WORKSPACE_ID"
echo "Document ID: $DOCUMENT_ID"
echo "File ID: $FILE_ID"
echo "Jurisdição: $JURISDICTION ($JURISDICTION_STATUS)"
echo ""
echo -e "${COLOR_GREEN}✅ Testes concluídos!${COLOR_RESET}"
echo ""
echo "Para verificar no banco de dados:"
echo "  docker exec -it contractai-postgres psql -U contractai -d contractai -c \"SELECT * FROM documents WHERE id = '$DOCUMENT_ID';\""
echo "  docker exec -it contractai-postgres psql -U contractai -d contractai -c \"SELECT COUNT(*) FROM chunks WHERE \\\"documentId\\\" = '$DOCUMENT_ID';\""
echo "  docker exec -it contractai-postgres psql -U contractai -d contractai -c \"SELECT * FROM document_jobs WHERE \\\"documentId\\\" = '$DOCUMENT_ID' ORDER BY \\\"createdAt\\\" DESC;\""
