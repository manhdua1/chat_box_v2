import { useState } from 'react';

interface PollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreatePoll: (question: string, options: string[]) => void;
    roomId?: string;
}

export function PollModal({ isOpen, onClose, onCreatePoll }: PollModalProps) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);

    const handleAddOption = () => {
        if (options.length < 10) {
            setOptions([...options, '']);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (question.trim() && validOptions.length >= 2) {
            onCreatePoll(question.trim(), validOptions);
            // Reset form
            setQuestion('');
            setOptions(['', '']);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[var(--bg-tertiary)] rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <line x1="12" y1="20" x2="12" y2="10" />
                                <line x1="18" y1="20" x2="18" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="16" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Create Poll</h3>
                            <p className="text-xs text-slate-400">Ask your question</p>
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Question */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Question
                        </label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="What's your question?"
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-emerald-500"
                            required
                        />
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Options
                        </label>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                        placeholder={`Option ${index + 1}`}
                                        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-emerald-500"
                                        required
                                    />
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(index)}
                                            className="w-10 h-10 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-xl text-red-400 hover:bg-red-500/10 hover:border-red-500/50 cursor-pointer transition-colors"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {options.length < 10 && (
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="mt-2 w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 text-sm hover:bg-slate-700 cursor-pointer transition-colors flex items-center justify-center gap-2"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Add Option
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl border-none cursor-pointer transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm rounded-xl border-none cursor-pointer transition-all"
                        >
                            Create Poll
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
