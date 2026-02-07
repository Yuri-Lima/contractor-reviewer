#!/bin/bash

API_URL="http://localhost:3000/api"

echo "=== 1. Login ==="
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Registering user..."
  TOKEN=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test User"}' | jq -r '.accessToken')
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Exiting."
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

echo -e "\n=== 2. Create Workspace ==="
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Workspace '$(date +%s)'"}')
WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | jq -r '.id')

if [ "$WORKSPACE_ID" == "null" ] || [ -z "$WORKSPACE_ID" ]; then
  echo "❌ Failed to create workspace"
  exit 1
fi

echo "✅ Workspace ID: $WORKSPACE_ID"

echo -e "\n=== 3. Create Document ==="
DOCUMENT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Contract","description":"Test upload"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

if [ "$DOCUMENT_ID" == "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo "❌ Failed to create document"
  exit 1
fi

echo "✅ Document ID: $DOCUMENT_ID"
echo "   Status: $(echo $DOCUMENT_RESPONSE | jq -r '.status')"

echo -e "\n=== 4. Create Test File ==="
echo "This is a test document content for upload testing.
This document contains multiple lines to test the upload and processing pipeline.
The worker should process this file and mark it as available." > test-upload.txt
echo "✅ Test file created: test-upload.txt ($(wc -c < test-upload.txt) bytes)"

echo -e "\n=== 5. Upload File ==="
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-upload.txt")

FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
FILE_STATUS=$(echo $UPLOAD_RESPONSE | jq -r '.status')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo "❌ Upload failed:"
  echo $UPLOAD_RESPONSE | jq .
  exit 1
fi

echo "✅ File uploaded successfully!"
echo "   File ID: $FILE_ID"
echo "   File Name: $(echo $UPLOAD_RESPONSE | jq -r '.fileName')"
echo "   Size: $(echo $UPLOAD_RESPONSE | jq -r '.sizeBytes') bytes"
echo "   Initial Status: $FILE_STATUS"
echo "   Storage Key: $(echo $UPLOAD_RESPONSE | jq -r '.storageKey')"

echo -e "\n=== 6. Wait for Processing (15 seconds) ==="
for i in {15..1}; do
  echo -ne "\r   Waiting... $i seconds remaining"
  sleep 1
done
echo -e "\r   Waiting... done!          "

echo -e "\n=== 7. Check Document Status ==="
DOCUMENT_FINAL=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo $DOCUMENT_FINAL | jq -r '.status')
FILE_FINAL_STATUS=$(echo $DOCUMENT_FINAL | jq -r '.files[0].status // "N/A"')

echo "   Document Status: $FINAL_STATUS"
echo "   File Status: $FILE_FINAL_STATUS"

if [ "$FINAL_STATUS" == "available" ]; then
  echo "✅ Document processed successfully!"
elif [ "$FINAL_STATUS" == "processing" ]; then
  echo "⏳ Document still processing (worker may need more time)"
else
  echo "⚠️  Document status: $FINAL_STATUS"
fi

echo -e "\n=== 8. File Details ==="
echo $DOCUMENT_FINAL | jq '.files[0]'

echo -e "\n=== Tests completed! ==="
echo ""
echo "To check jobs in database:"
echo "  docker exec -it contractai-postgres psql -U contractai -d contractai -c \"SELECT * FROM document_jobs WHERE \\\"documentId\\\" = '$DOCUMENT_ID';\""
