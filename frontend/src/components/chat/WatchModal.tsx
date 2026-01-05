import { useState, useRef, useEffect } from 'react';

interface WatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateSession: (videoUrl: string) => void;
    onEndSession?: () => void;
    sessionActive: boolean;
    currentVideoUrl?: string;
    viewerCount?: number;
    onSyncAction?: (action: 'play' | 'pause' | 'seek', time?: number) => void;
}

// Convert YouTube URL to embed URL
function getEmbedUrl(url: string): string {
    if (!url) return '';
    
    // Get current origin for YouTube API
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        // Add origin parameter to fix Error 153 and enable JS API
        return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(origin)}&rel=0&modestbranding=1`;
    }
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }
    
    return url;
}

export function WatchModal({ 
    isOpen, 
    onClose, 
    onCreateSession, 
    onEndSession,
    sessionActive, 
    currentVideoUrl, 
    viewerCount,
    onSyncAction 
}: WatchModalProps) {
    const [videoUrl, setVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    const embedUrl = getEmbedUrl(currentVideoUrl || '');
    const isDirectVideo = currentVideoUrl?.match(/\.(mp4|webm|ogg)$/i);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen && !sessionActive) {
            setVideoUrl('');
        }
    }, [isOpen, sessionActive]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (videoUrl.trim()) {
            onCreateSession(videoUrl.trim());
            setVideoUrl('');
        }
    };

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                onSyncAction?.('pause', videoRef.current.currentTime);
            } else {
                videoRef.current.play();
                onSyncAction?.('play', videoRef.current.currentTime);
            }
            setIsPlaying(!isPlaying);
        } else {
            onSyncAction?.(isPlaying ? 'pause' : 'play');
            setIsPlaying(!isPlaying);
        }
    };

    const handleSeek = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
        onSyncAction?.('seek', time);
        setCurrentTime(time);
    };

    const handleEndSession = () => {
        onEndSession?.();
        onClose();
    };

    // Sample video suggestions (verified embeddable videos)
    const videoSuggestions = [
        { title: 'Big Buck Bunny (Blender)', url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4', thumbnail: '🐰' },
        { title: 'Sintel (Blender)', url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', thumbnail: '🐉' },
        { title: 'Tears of Steel', url: 'https://www.youtube.com/watch?v=R6MlUcmOul8', thumbnail: '🤖' },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-[var(--bg-tertiary)] rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                                <polyline points="17 2 12 7 7 2" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Watch Together</h3>
                            <p className="text-xs text-slate-400">
                                {sessionActive ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
                                        Live • {viewerCount || 1} watching
                                    </span>
                                ) : 'Start a synchronized watch session'}
                            </p>
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

                <div className="p-4">
                    {sessionActive && currentVideoUrl ? (
                        /* Active Session */
                        <div className="space-y-4">
                            {/* Video Player */}
                            <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                                {isDirectVideo ? (
                                    <video
                                        ref={videoRef}
                                        src={currentVideoUrl}
                                        className="w-full h-full"
                                        autoPlay
                                        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                    />
                                ) : (
                                    <iframe
                                        src={embedUrl}
                                        className="w-full h-full"
                                        allowFullScreen
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        referrerPolicy="strict-origin-when-cross-origin"
                                        title="Watch Together Video"
                                    />
                                )}
                            </div>

                            {/* Video Controls */}
                            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                                {/* Progress bar for direct video */}
                                {isDirectVideo && videoRef.current && (
                                    <div className="w-full">
                                        <input
                                            type="range"
                                            min={0}
                                            max={videoRef.current.duration || 100}
                                            value={currentTime}
                                            onChange={(e) => handleSeek(Number(e.target.value))}
                                            className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Play/Pause */}
                                        <button
                                            onClick={handlePlayPause}
                                            className="w-10 h-10 flex items-center justify-center bg-pink-500 hover:bg-pink-600 text-white rounded-full border-none cursor-pointer transition-colors"
                                        >
                                            {isPlaying ? (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <rect x="6" y="4" width="4" height="16" />
                                                    <rect x="14" y="4" width="4" height="16" />
                                                </svg>
                                            ) : (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Sync buttons */}
                                        <button
                                            onClick={() => onSyncAction?.('seek', 0)}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg border-none cursor-pointer transition-colors flex items-center gap-1"
                                            title="Restart"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="1 4 1 10 7 10" />
                                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                            </svg>
                                            Restart
                                        </button>

                                        <button
                                            onClick={() => handleSeek(currentTime - 10)}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg border-none cursor-pointer transition-colors"
                                        >
                                            -10s
                                        </button>

                                        <button
                                            onClick={() => handleSeek(currentTime + 10)}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg border-none cursor-pointer transition-colors"
                                        >
                                            +10s
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Viewers */}
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                <circle cx="9" cy="7" r="4" />
                                            </svg>
                                            {viewerCount || 1}
                                        </div>

                                        {/* End Session */}
                                        <button
                                            onClick={handleEndSession}
                                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg border border-red-500/30 cursor-pointer transition-colors flex items-center gap-2"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            </svg>
                                            End Session
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* URL Display */}
                            <div className="flex items-center gap-2 p-2 bg-black/30 rounded-lg">
                                <span className="text-slate-500 text-xs">Now Playing:</span>
                                <code className="text-pink-400 text-xs truncate flex-1">{currentVideoUrl}</code>
                            </div>
                        </div>
                    ) : (
                        /* Create Session */
                        <div className="space-y-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Video URL
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={videoUrl}
                                            onChange={(e) => setVideoUrl(e.target.value)}
                                            placeholder="Paste YouTube, Vimeo, or direct video URL..."
                                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-pink-500 pr-12"
                                            required
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                                        <span>Supported:</span>
                                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">YouTube</span>
                                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">Vimeo</span>
                                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">MP4/WebM</span>
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl border-none cursor-pointer transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!videoUrl.trim()}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-xl border-none cursor-pointer transition-all flex items-center justify-center gap-2"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                        Start Watch Party
                                    </button>
                                </div>
                            </form>

                            {/* Sample Videos */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Start with Sample Videos</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {videoSuggestions.map((video, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setVideoUrl(video.url)}
                                            className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-pink-500/50 rounded-xl transition-all cursor-pointer text-left group"
                                        >
                                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{video.thumbnail}</div>
                                            <p className="text-white text-sm font-medium">{video.title}</p>
                                            <p className="text-slate-500 text-xs">Free to watch</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* How it works */}
                            <div className="p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl">
                                <h4 className="text-pink-400 font-medium text-sm mb-2 flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                    How Watch Together Works
                                </h4>
                                <ul className="text-slate-400 text-xs space-y-1">
                                    <li>• Start a session with any video URL</li>
                                    <li>• Everyone in the room watches together in sync</li>
                                    <li>• Play, pause, and seek are synchronized for all viewers</li>
                                    <li>• Chat while watching to discuss the content!</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
