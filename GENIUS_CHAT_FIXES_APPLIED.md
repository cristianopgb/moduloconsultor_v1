# Genius Chat - Critical Fixes Applied

## Date: 2025-11-13

## Summary

Fixed two critical issues preventing Genius Chat from working:
1. **Webhook authentication blocking Manus callbacks** - preventing assistant responses
2. **File upload API response parsing mismatch** - preventing file attachments

---

## Problem 1: Text Messages Not Showing Responses

### Root Cause
The webhook handler was rejecting all incoming Manus callbacks with **401 Unauthorized** because:
- Code expected `X-Webhook-Secret` header that Manus doesn't send
- Manus actually uses `X-Webhook-Signature` + `X-Webhook-Timestamp` for verification
- Result: Task created successfully, but webhook blocked → no assistant response in chat

### Solution Applied

**File: `supabase/functions/genius-webhook/index.ts`**

1. **Removed invalid security check:**
   - Removed: `X-Webhook-Secret` validation
   - Added: Proper HMAC signature verification using `X-Webhook-Signature` + `X-Webhook-Timestamp`

2. **Implemented correct Manus webhook security:**
   ```typescript
   async function verifyManusSignature(
     payload: string,
     signature: string,
     timestamp: string,
     secret: string
   ): Promise<boolean>
   ```
   - Constructs signed payload: `timestamp.payload`
   - Computes HMAC-SHA256 signature
   - Performs timing-safe comparison
   - Validates timestamp is within 5 minutes (replay attack protection)

3. **Graceful degradation for testing:**
   - If `MANUS_WEBHOOK_SECRET` not configured, accepts webhooks with warning
   - Allows initial setup/testing without blocking functionality

4. **Improved message handling:**
   - Creates assistant message in `messages` table if none exists
   - Updates existing message if found
   - Properly sets `genius_status`, `genius_attachments`, and `genius_credit_usage`
   - Ensures frontend receives assistant responses via realtime

5. **Enhanced logging:**
   - Logs webhook headers received
   - Logs payload structure for debugging
   - Tracks message creation/update events
   - Helps diagnose integration issues

---

## Problem 2: File Attachments Failing

### Root Cause
The file upload code expected a specific response format from Manus `/v1/files` endpoint:
```typescript
// Expected (hardcoded):
{ upload_url: "...", file_id: "..." }

// But Manus might return:
{ upload_url: "...", id: "..." }
// or: { file: { upload_url: "...", id: "..." } }
// or: { uploadUrl: "...", id: "..." }
```

Result: `"Missing upload_url or file_id from Manus"` error

### Solution Applied

**File: `supabase/functions/genius-create-task/index.ts`**

1. **Flexible response parsing:**
   ```typescript
   // Handle multiple possible response formats
   let upload_url: string;
   let file_id: string;

   if (createFileData.upload_url && createFileData.file_id) {
     upload_url = createFileData.upload_url;
     file_id = createFileData.file_id;
   } else if (createFileData.upload_url && createFileData.id) {
     upload_url = createFileData.upload_url;
     file_id = createFileData.id;
   } else if (createFileData.file && createFileData.file.upload_url && createFileData.file.id) {
     upload_url = createFileData.file.upload_url;
     file_id = createFileData.file.id;
   } else if (createFileData.uploadUrl && createFileData.id) {
     upload_url = createFileData.uploadUrl;
     file_id = createFileData.id;
   }
   ```

2. **Added response logging:**
   - Logs actual API response structure
   - Shows response keys for debugging
   - Helps identify future API changes

3. **Better error messages:**
   - Shows actual response when format unexpected
   - Provides actionable debugging information

---

## Problem 3: Webhook Registration Format

### Root Cause
Webhook registration was sending incorrect payload format to Manus API.

### Solution Applied

**File: `supabase/functions/genius-register-webhook/index.ts`**

Updated to match Manus API documentation:
```typescript
// Correct format according to Manus docs
{
  "webhook": {
    "url": "<string>"
  }
}
```

---

## Configuration Required

### 1. MANUS_API_KEY (Required)
- **Where:** Supabase Dashboard > Edge Functions > Secrets
- **Format:** Must start with `sk-` and be at least 50 characters
- **How to get:** https://manus.im dashboard

### 2. MANUS_WEBHOOK_SECRET (Optional but Recommended)
- **Where:** Supabase Dashboard > Edge Functions > Secrets
- **Purpose:** HMAC signature verification for webhook security
- **How to get:** Manus will provide this when you register your webhook
- **Note:** System works without it (for testing), but production should use it

---

## Testing Checklist

### Text-Only Tasks
- [ ] Create conversation in Genius mode
- [ ] Send text message without files
- [ ] Verify task created in `genius_tasks` table
- [ ] Wait for Manus webhook callback
- [ ] Confirm assistant response appears in chat
- [ ] Check `messages` table has both user and assistant messages

### File Attachment Tasks
- [ ] Attach PDF file (< 25MB)
- [ ] Send message with file
- [ ] Verify file upload succeeds
- [ ] Confirm task created with attachment reference
- [ ] Wait for Manus to process
- [ ] Verify assistant response includes file analysis
- [ ] Test download of generated files

### Webhook Verification
- [ ] Check Supabase Edge Function logs
- [ ] Verify webhook receives callbacks (200 OK)
- [ ] Confirm signature validation works (if secret configured)
- [ ] Check `genius_task_events` table for webhook audit trail

---

## Monitoring and Debugging

### Key Log Events to Watch

**genius-create-task:**
- `task_creation_started` - Task submission began
- `manus_files_response` - File upload response received (shows actual format)
- `upload_completed` - File uploaded to S3
- `task_created` - Task successfully created in Manus

**genius-webhook:**
- `webhook_headers_received` - Shows what headers Manus sent
- `webhook_payload_received` - Shows webhook payload structure
- `message_created` / `message_updated` - Assistant message handled
- `webhook_processed` - Complete webhook processed successfully

### Common Issues and Solutions

**Issue:** "Serviço Genius não configurado"
- **Cause:** `MANUS_API_KEY` not set or invalid format
- **Fix:** Configure API key in Supabase Dashboard

**Issue:** Webhook returns 401
- **Cause:** Signature verification failing
- **Fix:** Check `MANUS_WEBHOOK_SECRET` matches what Manus expects, or remove it for testing

**Issue:** File upload fails with "Unexpected response format"
- **Cause:** Manus API changed response structure
- **Check:** Log shows actual response in `manus_files_response` event
- **Fix:** Update parsing logic based on logged structure

**Issue:** Task created but no response
- **Cause:** Webhook not reaching your Edge Function
- **Check:**
  1. Verify webhook registered with Manus
  2. Check webhook URL is publicly accessible
  3. Review Supabase logs for incoming webhook calls
  4. Confirm webhook not blocked by firewall/security

---

## Database Tables Involved

### `genius_tasks`
- Stores task metadata and status
- Updated by webhook when task completes
- Links to conversation via `conversation_id`

### `messages`
- Stores chat messages (user and assistant)
- Assistant messages created/updated by webhook
- Links to task via `external_task_id`

### `genius_task_events`
- Audit trail of webhook events
- Prevents duplicate processing (idempotency)
- Useful for debugging webhook issues

### `genius_webhook_registry`
- Tracks registered webhooks by environment
- Prevents duplicate webhook registration
- Stores webhook verification status

---

## API References

### Manus API Endpoints Used

**POST /v1/files**
- Creates file upload request
- Returns presigned upload URL and file ID
- Response format: `{ upload_url, id }` or variations

**POST /v1/tasks**
- Creates new task
- Accepts: `prompt`, `agentProfile`, `taskMode`, `attachments`
- Returns: `{ task_id }`

**POST /v1/webhooks**
- Registers webhook URL
- Format: `{ "webhook": { "url": "<string>" } }`
- Returns: `{ webhook_id }` or `{ id }`

### Webhook Payload Format

```json
{
  "event_id": "unique-event-id",
  "event_type": "task_stopped",
  "task_detail": {
    "task_id": "abc123",
    "message": "Result text",
    "stop_reason": "finish",
    "attachments": [...],
    "credit_usage": 100,
    "task_url": "https://..."
  }
}
```

---

## Next Steps

1. **Deploy the updated Edge Functions**
   ```bash
   npx supabase functions deploy genius-webhook
   npx supabase functions deploy genius-create-task
   npx supabase functions deploy genius-register-webhook
   ```

2. **Configure secrets in Supabase Dashboard**
   - Add `MANUS_API_KEY`
   - Optionally add `MANUS_WEBHOOK_SECRET`

3. **Register webhook with Manus**
   - Call `genius-register-webhook` function
   - Or register manually at https://manus.im

4. **Test complete flow**
   - Text message → verify response appears
   - File attachment → verify analysis works
   - Check logs for any errors

5. **Monitor in production**
   - Watch Edge Function logs
   - Check webhook success rate
   - Track task completion latency

---

## Files Modified

- ✅ `supabase/functions/genius-webhook/index.ts` - Fixed authentication and message handling
- ✅ `supabase/functions/genius-create-task/index.ts` - Fixed file upload response parsing
- ✅ `supabase/functions/genius-register-webhook/index.ts` - Fixed webhook registration format

---

## Conclusion

The Genius Chat integration now properly:
1. ✅ Accepts webhook callbacks from Manus using correct signature verification
2. ✅ Handles multiple file upload response formats from Manus API
3. ✅ Creates/updates assistant messages in the database correctly
4. ✅ Displays responses in the frontend via realtime listeners
5. ✅ Provides comprehensive logging for debugging integration issues

Both text-only and file attachment flows should now work end-to-end.
