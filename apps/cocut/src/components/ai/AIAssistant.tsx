import { useState, useRef } from 'react';
import { C } from '../../theme/colors';
import { FONT_FAMILY, FONT_FAMILY_BRAND } from '../../theme/tokens';
import { Icons } from '../../theme/icons';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { coopAI, type AIMessage } from '../../services/aiEngine';
import { useElementStore } from '../../store/elementStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build context from current scene
      const elements = useElementStore.getState().elements;
      const sceneContext = elements
        .map((el) => `- ${el.type}: "${el.name}" at (${el.x},${el.y}), ${el.width}x${el.height}`)
        .join('\n');

      const aiMessages: AIMessage[] = [
        {
          role: 'system',
          content: `You are Co-op AI, a video production assistant built into CoEdit by Content Co-op. You help with:
- Scene layout and composition suggestions
- Color grading recommendations
- Edit pacing and timing advice
- Subtitle/caption refinement
- Motion graphics ideas
- Export settings recommendations

Current scene has ${elements.length} elements:
${sceneContext}

Be concise, professional, and creative. Never mention your underlying technology.`,
        },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMsg.content },
      ];

      const response = await coopAI.complete({
        messages: aiMessages,
        model: 'flash',
        maxTokens: 800,
        temperature: 0.7,
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.content, timestamp: Date.now() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Co-op AI is not configured yet. Add your API key in Settings to enable AI features.\n\nError: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  };

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: FONT_FAMILY_BRAND,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: `0 4px 20px ${C.accentGlow}`,
          zIndex: 500,
          letterSpacing: 0.3,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateX(-50%) scale(1.05)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateX(-50%) scale(1)';
        }}
      >
        <Icon d={Icons.zap} size={12} color="#fff" />
        Co-op AI
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 380,
        maxHeight: 440,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 12px 48px rgba(0,0,0,0.6)`,
        zIndex: 500,
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: `1px solid ${C.border}`,
          gap: 8,
        }}
      >
        <Icon d={Icons.zap} size={14} color={C.accent} />
        <span style={{ fontFamily: FONT_FAMILY_BRAND, fontSize: 13, fontWeight: 600, flex: 1 }}>
          Co-op AI
        </span>
        <span
          style={{ fontSize: 14, color: C.textDim, cursor: 'pointer', lineHeight: 1 }}
          onClick={() => setOpen(false)}
        >
          ✕
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 200,
          maxHeight: 300,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: C.textDim, fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
            Ask Co-op AI for help with your edit — layout suggestions, color grading, pacing advice, and more.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user' ? C.accent : C.surface2,
              color: msg.role === 'user' ? '#fff' : C.text,
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '12px 12px 12px 4px',
              background: C.surface2,
              color: C.textDim,
              fontSize: 11,
            }}
          >
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          padding: '8px 10px',
          borderTop: `1px solid ${C.border}`,
          gap: 6,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask Co-op AI..."
          style={{
            flex: 1,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '6px 10px',
            color: C.text,
            fontSize: 11,
            fontFamily: FONT_FAMILY,
            outline: 'none',
          }}
        />
        <Button small onClick={sendMessage} disabled={!input.trim() || loading}>
          <Icon d={Icons.zap} size={12} />
        </Button>
      </div>
    </div>
  );
}
