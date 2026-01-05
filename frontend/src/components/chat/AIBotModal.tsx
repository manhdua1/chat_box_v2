import { useState, useRef, useEffect } from 'react';

interface AIBotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSendMessage: (message: string) => void;
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
    loading: boolean;
    onClear: () => void;
}

export function AIBotModal({ isOpen, onClose, onSendMessage, messages, loading, onClear }: AIBotModalProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !loading) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[var(--bg-tertiary)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">AI Assistant</h3>
                            <p className="text-xs text-slate-400">Powered by Gemini</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-400 cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <p className="text-slate-400">Ask me anything!</p>
                            <p className="text-xs text-slate-500 mt-2">I can help with coding, explanations, and more</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant'
                                        ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                        : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                    }`}>
                                    {msg.role === 'assistant' ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                            <path d="M2 17l10 5 10-5" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    )}
                                </div>
                                <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                    <div className={`inline-block p-3 rounded-2xl text-sm ${msg.role === 'assistant'
                                            ? 'bg-slate-800 text-slate-100 rounded-tl-sm'
                                            : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-tr-sm'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                </svg>
                            </div>
                            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {messages.length > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl border-none cursor-pointer transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className={`px-4 py-2 rounded-xl text-white text-sm border-none cursor-pointer transition-all ${input.trim() && !loading
                                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700'
                                    : 'bg-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
