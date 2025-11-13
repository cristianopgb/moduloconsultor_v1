# Genius Chat - File Attachment Update

## Implemented Changes

### 1. Manus API Key Configuration Fix

**Problem:** The Genius chat was failing with a 401 error: `"invalid token: token is malformed: token contains an invalid number of segments"`

**Root Cause:** The `MANUS_API_KEY` environment variable was not configured in Supabase Edge Functions.

**Solution:**
- Added API key format validation in `genius-create-task/index.ts`
- The function now validates that the API key is a valid JWT (3 segments separated by dots)
- Improved error messages to guide users when the API key is missing or invalid
- Created comprehensive README documentation

**Configuration Steps:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `gljoasdvlaitplbmbtzg`
3. Navigate to **Project Settings** > **Edge Functions**
4. Add a new secret:
   - **Name:** `MANUS_API_KEY`
   - **Value:** Your JWT token from https://manus.im
5. The token format must be: `header.payload.signature` (3 parts)

**Testing:**
After configuring the key, test with:
```bash
curl -X POST 'https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/genius-create-task' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Test connection",
    "conversation_id": "test-uuid",
    "files": []
  }'
```

### 2. Enhanced File Attachment UI

**What Changed:**

#### Before:
- Separate file upload button above the chat area
- Basic file counter with no preview
- No visual feedback for attached files
- No drag-and-drop support

#### After:
- Integrated file attachment button next to the send button (ChatGPT-style)
- Rich file preview with icons, names, and sizes
- Individual file remove buttons
- Drag-and-drop support on the entire input area
- Visual drag overlay with clear feedback
- Smooth animations and transitions
- Better error handling and validation feedback

**New Features:**

1. **Inline Attachment Button**
   - Paperclip icon positioned left of the text input
   - Disabled when 5 files are already attached
   - Hover effects and tooltips

2. **File Preview Cards**
   - Shows each file with appropriate icon (PDF, Excel, Image, etc.)
   - Displays file name and size
   - Individual remove buttons (visible on hover)
   - "Clear all" option to remove all files at once

3. **Drag-and-Drop Zone**
   - Drop files anywhere in the input area
   - Visual overlay appears during drag
   - Purple border and icon indicate drop zone
   - Prevents default browser behavior

4. **Smart Placeholder Text**
   - Changes based on whether files are attached
   - With files: "Descreva o que você quer que o Genius faça com os arquivos..."
   - Without files: "Digite sua mensagem ou arraste arquivos para anexar..."

5. **File Management**
   - Local state management in GeniusChat
   - Syncs with parent component (ChatPage)
   - Files cleared after successful send
   - Preserved on error for retry

**Technical Implementation:**

```typescript
// File state management
const [localFiles, setLocalFiles] = useState<File[]>([]);
const [isDragging, setIsDragging] = useState(false);

// Drag handlers
function handleDragEnter(e: React.DragEvent) { ... }
function handleDragLeave(e: React.DragEvent) { ... }
function handleDragOver(e: React.DragEvent) { ... }
function handleDrop(e: React.DragEvent) { ... }

// File operations
function handleFileSelect(files: FileList | null) { ... }
function removeFile(index: number) { ... }
```

### 3. User Experience Improvements

**Visual Design:**
- Consistent purple theme matching the Genius branding
- Smooth transitions and hover effects
- Clear visual hierarchy
- Responsive layout for mobile and desktop

**Feedback:**
- Real-time file count and size display
- Validation errors shown immediately
- Loading states during file processing
- Helpful hints about file formats and limits

**Accessibility:**
- Keyboard navigation support
- ARIA labels on buttons
- Focus states clearly visible
- Screen reader friendly

### 4. Files Modified

```
✅ supabase/functions/genius-create-task/index.ts
   - Added API key validation function
   - Improved error messages
   - Better telemetry

✅ supabase/functions/genius-create-task/README.md (NEW)
   - Comprehensive configuration guide
   - Troubleshooting section
   - API limits and supported formats

✅ src/components/Chat/GeniusChat.tsx
   - Integrated file attachment UI
   - Added drag-and-drop support
   - Enhanced file preview
   - Improved state management

✅ src/components/Chat/ChatPage.tsx
   - Removed separate file upload button
   - Simplified Genius mode rendering
```

## Testing Checklist

- [ ] Configure MANUS_API_KEY in Supabase Dashboard
- [ ] Test file attachment via click
- [ ] Test file attachment via drag-and-drop
- [ ] Test removing individual files
- [ ] Test "Clear all" functionality
- [ ] Test 5 file limit
- [ ] Test 25MB per file limit
- [ ] Test 100MB total limit
- [ ] Test different file types (PDF, Excel, CSV, images)
- [ ] Test sending with files
- [ ] Test sending without files
- [ ] Test error handling when API key is invalid
- [ ] Test mobile responsive layout

## Known Limitations

1. **MANUS_API_KEY Required:** The Genius feature will not work until the API key is properly configured in Supabase
2. **File Validation:** Client-side validation only; server validates again for security
3. **File Limits:** Maximum 5 files, 25MB each, 100MB total per task
4. **Supported Formats:** PDF, Excel, CSV, images, Word, PowerPoint, text files

## Next Steps

1. **Immediate:** Configure MANUS_API_KEY in production
2. **Short-term:** Test with real Manus API
3. **Future:** Add image thumbnails for preview
4. **Future:** Add progress bars for large file uploads
5. **Future:** Support for more file types if Manus adds support

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify MANUS_API_KEY is correctly configured
3. Check Supabase Edge Functions logs
4. Look for `trace_id` in error responses for debugging
5. Review the README at `supabase/functions/genius-create-task/README.md`

---

**Summary:** The Genius chat now has a modern, ChatGPT-style file attachment experience with drag-and-drop support, rich file previews, and better error handling. The critical MANUS_API_KEY configuration issue has been documented and validated.
