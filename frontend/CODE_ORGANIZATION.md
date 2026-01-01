# Code Organization & Optimization

**Last Updated:** January 1, 2026

## Overview

The codebase has been refactored into modular, maintainable components following best practices.

## New Structure

### Types (`src/types/`)
```
types/
└── chat.types.ts         # Shared TypeScript interfaces
```

**Purpose**: Centralized type definitions to avoid duplication and maintain consistency.

### Utils (`src/utils/`)
```
utils/
└── chat.utils.ts         # Helper functions
```

**Functions**:
- `formatTime()` - Format timestamps
- `formatDate()` - Format dates with relative time
- `groupMessagesByDate()` - Group messages by day
- `truncateText()` - Truncate long text
- `isToday()` - Check if date is today

### Hooks (`src/hooks/`)
```
hooks/
├── useMessageActions.ts  # Message editing & actions
├── useFileUpload.ts      # File upload with progress
└── useWebSocket.ts       # WebSocket connection (existing)
```

**Custom Hooks**:
- `useMessageEditing()` - Manage message edit state
- `useMessageActions()` - Check message permissions
- `useReactions()` - Manage reaction picker state
- `useFileUpload()` - Handle file uploads

### Components

#### Chat Components (`src/components/chat/`)
```
chat/
├── MessageItem.tsx       # Single message display
├── MessageList.tsx       # List with date grouping (existing - can be updated)
├── MessageInput.tsx      # Input field (existing - can be updated)
├── VoiceRecorder.tsx     # Voice recording
├── VoiceMessage.tsx      # Voice playback
└── ThreadView.tsx        # Message threading
```

#### Layout Components (`src/components/layout/`)
```
layout/
├── ChatHeader.tsx        # Header with action buttons
├── ChatArea.tsx          # Main chat container (simplified)
└── Sidebar.tsx           # Sidebar navigation
```

## Benefits

### 1. **Modularity**
- Each component has a single responsibility
- Easy to test individual components
- Reusable across the app

### 2. **Maintainability**
- Easier to find and fix bugs
- Clear separation of concerns
- Consistent naming conventions

### 3. **Performance**
- Smaller components re-render less
- Custom hooks extract logic for better memoization
- Utils can be tree-shaken

### 4. **Developer Experience**
- Shorter files (< 300 lines)
- Better IDE autocomplete
- Clearer imports

## Migration Guide

### Before (ChatArea.tsx - 962 lines)
```tsx
// Everything in one file
const ChatArea = () => {
    // 50+ lines of state
    // Multiple handlers
    // Nested JSX
    // ...
}
```

### After (Modular)
```tsx
// ChatArea.tsx - orchestrates components
import { ChatHeader } from './ChatHeader';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { useMessageActions } from '@/hooks/useMessageActions';

const ChatArea = () => {
    const { editingMessageId, ... } = useMessageEditing();
    
    return (
        <>
            <ChatHeader ... />
            <MessageList ... />
            <MessageInput ... />
        </>
    );
}
```

## Usage Examples

### Using Custom Hooks
```tsx
import { useMessageEditing, useMessageActions } from '@/hooks/useMessageActions';

function MyComponent() {
    const { 
        editingMessageId, 
        startEditing, 
        saveEdit 
    } = useMessageEditing();
    
    const { 
        canEditMessage, 
        canDeleteMessage 
    } = useMessageActions(currentUser);
    
    // Use in component...
}
```

### Using Utils
```tsx
import { formatTime, groupMessagesByDate } from '@/utils/chat.utils';

const grouped = groupMessagesByDate(messages);
const time = formatTime(message.timestamp);
```

### Using Types
```tsx
import type { Message, Reaction } from '@/types/chat.types';

function processMessage(msg: Message) {
    // Fully typed
}
```

## Next Steps

1. **Update ChatArea.tsx** to use new components
2. **Update MessageList.tsx** to use MessageItem
3. **Update MessageInput.tsx** to follow new pattern
4. **Add unit tests** for utils and hooks
5. **Document complex components** with JSDoc

## Performance Tips

1. **Memoize expensive computations**
   ```tsx
   const grouped = useMemo(
       () => groupMessagesByDate(messages), 
       [messages]
   );
   ```

2. **Use React.memo for pure components**
   ```tsx
   export const MessageItem = React.memo(function MessageItem(props) {
       // ...
   });
   ```

3. **Lazy load heavy components**
   ```tsx
   const EmojiPicker = lazy(() => import('emoji-picker-react'));
   ```

## File Size Comparison

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| ChatArea.tsx | 962 lines | ~300 lines | -69% |
| useWebSocket.ts | 731 lines | Can be split | TBD |

---

*Last Updated: 2025-12-18*
