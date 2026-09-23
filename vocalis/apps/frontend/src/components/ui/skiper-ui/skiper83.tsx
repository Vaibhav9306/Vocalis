import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MentionTag {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const AVAILABLE_MENTIONS: MentionTag[] = [
  { id: 'meetings', label: 'meetings', icon: '📁', description: 'Search across all past meeting transcripts' },
  { id: 'tasks', label: 'tasks', icon: '✓', description: 'Query action items, owners, and deadlines' },
  { id: 'decisions', label: 'decisions', icon: '📜', description: 'Filter agreed decisions & commitments' },
  { id: 'notes', label: 'notes', icon: '📝', description: 'Query synthesized executive summaries' },
  { id: 'people', label: 'people', icon: '👤', description: 'Filter by speakers and participants' },
];

interface Skiper83Props {
  onSend: (message: string, selectedMentions: MentionTag[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const Skiper83: React.FC<Skiper83Props> = ({
  onSend,
  isLoading = false,
  placeholder = "Ask anything about your meetings, tasks, or decisions... Type '@' to specify context",
  className = '',
}) => {
  const [text, setText] = useState<string>('');
  const [activeMentions, setActiveMentions] = useState<MentionTag[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [mentionFilter, setMentionFilter] = useState<string>('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState<number>(0);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [reasoningMode, setReasoningMode] = useState<'fast' | 'deep'>('deep');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  // Filter mentions based on what comes after '@'
  const filteredMentions = AVAILABLE_MENTIONS.filter(
    (m) =>
      !activeMentions.some((active) => active.id === m.id) &&
      (m.label.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        m.description.toLowerCase().includes(mentionFilter.toLowerCase()))
  );

  const addMention = (mention: MentionTag) => {
    if (!activeMentions.some((m) => m.id === mention.id)) {
      setActiveMentions((prev) => [...prev, mention]);
    }
    // Remove the '@mentionFilter' from text
    const atIndex = text.lastIndexOf('@');
    if (atIndex !== -1) {
      setText(text.substring(0, atIndex));
    }
    setShowMentionMenu(false);
    setMentionFilter('');
    textareaRef.current?.focus();
  };

  const removeMention = (id: string) => {
    setActiveMentions((prev) => prev.filter((m) => m.id !== id));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect if user typed '@'
    const atIndex = val.lastIndexOf('@');
    if (atIndex !== -1 && atIndex >= val.length - 15) {
      const query = val.substring(atIndex + 1);
      if (!query.includes(' ')) {
        setMentionFilter(query);
        setShowMentionMenu(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        addMention(filteredMentions[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() && activeMentions.length === 0) return;
    if (isLoading) return;

    let fullPrompt = text.trim();
    if (activeMentions.length > 0) {
      const contextPrefix = `[Context Scope: ${activeMentions.map((m) => `@${m.label}`).join(', ')}] `;
      fullPrompt = `${contextPrefix}${fullPrompt}`;
    }

    onSend(fullPrompt, activeMentions);
    setText('');
    setActiveMentions([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`skiper83-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '20px',
        backgroundColor: 'var(--color-paper-card)',
        border: `1.5px solid ${isFocused ? 'var(--color-accent)' : 'var(--color-rule)'}`,
        boxShadow: isFocused ? '0 8px 32px rgba(122, 50, 227, 0.12), 0 2px 8px rgba(0,0,0,0.04)' : 'var(--shadow-subtle)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'visible',
      }}
    >
      {/* Mention Auto-Complete Popover */}
      <AnimatePresence>
        {showMentionMenu && filteredMentions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '12px',
              right: '12px',
              marginBottom: '10px',
              backgroundColor: 'var(--color-paper-card)',
              border: '1px solid var(--color-rule-focus)',
              borderRadius: '16px',
              boxShadow: '0 16px 36px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                color: 'var(--color-ink-subtle)',
                padding: '6px 10px',
                borderBottom: '1px solid var(--color-rule)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Mention Scope</span>
              <span>↑↓ Navigate · ↵ Select</span>
            </div>
            {filteredMentions.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => addMention(item)}
                onMouseEnter={() => setSelectedMentionIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: selectedMentionIndex === idx ? 'var(--color-paper-subtle)' : 'transparent',
                  border: selectedMentionIndex === idx ? '1px solid var(--color-rule)' : '1px solid transparent',
                  transition: 'background-color 0.12s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--color-ink)' }}>@{item.label}</strong>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-ink-muted)' }}>{item.description}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: '14px 16px 10px' }}>
        {/* Active Context Tags Row */}
        <AnimatePresence>
          {activeMentions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}
            >
              {activeMentions.map((m) => (
                <motion.span
                  key={m.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    backgroundColor: 'var(--color-accent-subtle)',
                    color: 'var(--color-accent)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid rgba(122, 50, 227, 0.2)',
                  }}
                >
                  <span>{m.icon}</span>
                  <span>@{m.label}</span>
                  <button
                    onClick={() => removeMention(m.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-accent)',
                      fontSize: '0.75rem',
                      padding: '0 2px',
                    }}
                  >
                    ✕
                  </button>
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '0.94rem',
            lineHeight: '1.5',
            fontFamily: 'inherit',
            color: 'var(--color-ink)',
            maxHeight: '180px',
            minHeight: '26px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Bottom Action / Control Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 14px 12px',
          borderTop: '1px solid var(--color-rule)',
          backgroundColor: 'var(--color-paper-subtle)',
          borderBottomLeftRadius: '19px',
          borderBottomRightRadius: '19px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Left triggers: Context Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setShowMentionMenu((prev) => !prev);
              setMentionFilter('');
            }}
            title="Scope context (@meetings, @tasks, @decisions)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--color-paper-card)',
              border: '1px solid var(--color-rule)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-ink)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>@</span>
            <span>Add Scope</span>
          </button>

          <button
            type="button"
            onClick={() => setReasoningMode((prev) => (prev === 'deep' ? 'fast' : 'deep'))}
            title={reasoningMode === 'deep' ? 'Deep synthesis with semantic memory citations' : 'Fast sub-second response'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--color-paper-card)',
              border: '1px solid var(--color-rule)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-ink)',
              cursor: 'pointer',
            }}
          >
            <span>{reasoningMode === 'deep' ? '✨ Deep Memory AI' : '⚡ Fast Mode'}</span>
          </button>
        </div>

        {/* Right side: Send CTA with Return icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
            ↵ Enter
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || (!text.trim() && activeMentions.length === 0)}
            style={{
              backgroundColor: text.trim() || activeMentions.length > 0 ? 'var(--color-ink)' : 'var(--color-paper-card)',
              color: text.trim() || activeMentions.length > 0 ? 'var(--color-paper)' : 'var(--color-ink-subtle)',
              border: '1px solid var(--color-rule)',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: text.trim() || activeMentions.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: text.trim() ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {isLoading ? (
              <span>Synthesizing...</span>
            ) : (
              <>
                <span>Ask Vocalis</span>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
