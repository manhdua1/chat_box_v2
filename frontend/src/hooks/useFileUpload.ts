import { useState, useCallback } from 'react';
import type { FilePreview } from '@/types/chat.types';
import { ChunkedUploader } from '@/services/ChunkedUploader';

const MAX_SMALL_FILE_SIZE = 10 * 1024 * 1024; // 10MB - use simple upload
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB - absolute max

export function useFileUpload(websocket?: WebSocket, roomId?: string) {
    const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log('📁 File selected:', file?.name, file?.size);
        if (!file) return;

        // Check max file size
        if (file.size > MAX_FILE_SIZE) {
            alert(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
            return;
        }

        // Create preview URL
        const url = URL.createObjectURL(file);
        console.log('📁 File preview created:', url);
        setFilePreview({ file, url });
        setUploadError(null);
    }, []);

    const cancelPreview = useCallback(() => {
        if (filePreview) {
            URL.revokeObjectURL(filePreview.url);
        }
        setFilePreview(null);
        setUploadProgress(0);
        setUploadError(null);
    }, [filePreview]);

    const uploadFile = useCallback(async (
        onSendMessage: (content: string, metadata?: any) => void
    ): Promise<void> => {
        console.log('🚀 uploadFile called, filePreview:', filePreview?.file?.name);
        if (!filePreview) {
            console.log('❌ No filePreview, returning');
            return;
        }

        console.log('✅ Starting upload for:', filePreview.file.name);
        setIsUploading(true);
        setUploadError(null);

        try {
            const file = filePreview.file;

            // Check if this is a voice message
            const isVoiceMessage = file.type.startsWith('audio/');

            // Use chunked upload for large files
            if (file.size > MAX_SMALL_FILE_SIZE && websocket) {
                const uploader = new ChunkedUploader(websocket, {
                    roomId: roomId || 'global',
                    onProgress: (progress) => {
                        setUploadProgress(progress.percentage);
                    },
                    onComplete: (fileUrl) => {
                        if (isVoiceMessage) {
                            // Send voice message
                            onSendMessage('🎤 Voice Message', {
                                type: 'voice',
                                url: fileUrl,
                                duration: 0, // Will be set by recorder
                                fileName: file.name
                            });
                        } else {
                            // Send file message
                            onSendMessage(`📎 ${file.name}`, {
                                type: 'file',
                                url: fileUrl,
                                fileName: file.name,
                                fileSize: file.size,
                                mimeType: file.type
                            });
                        }
                        cancelPreview();
                    },
                    onError: (error) => {
                        setUploadError(error.message);
                        console.error('Chunked upload failed:', error);
                    }
                });

                await uploader.upload(file);
            } else {
                // Real HTTP upload for small files
                setUploadProgress(10);

                try {
                    console.log('📤 Uploading file:', file.name, 'Size:', file.size);
                    
                    const response = await fetch('http://192.168.1.8:8080/upload', {
                        method: 'POST',
                        headers: {
                            'X-Filename': encodeURIComponent(file.name)
                        },
                        body: file
                    });

                    setUploadProgress(80);

                    console.log('📥 Upload response:', response.status);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Upload failed:', response.status, errorText);
                        throw new Error(`Upload failed: ${response.statusText || response.status}`);
                    }

                    const result = await response.json();
                    console.log('✅ Upload result:', result);
                    const fileUrl = result.url;

                    setUploadProgress(100);

                    // Determine type based on mimeType
                    let messageType: 'file' | 'image' | 'voice' = 'file';
                    if (file.type.startsWith('image/')) {
                        messageType = 'image';
                    } else if (file.type.startsWith('audio/')) {
                        messageType = 'voice';
                    }

                    if (isVoiceMessage) {
                        onSendMessage('🎤 Voice Message', {
                            type: 'voice',
                            url: fileUrl,
                            fileName: file.name,
                            mimeType: file.type
                        });
                    } else if (messageType === 'image') {
                        onSendMessage('📷 Image', {
                            type: 'image',
                            url: fileUrl,
                            fileName: file.name,
                            fileSize: file.size,
                            mimeType: file.type
                        });
                    } else {
                        onSendMessage(`📎 ${file.name}`, {
                            type: 'file',
                            url: fileUrl,
                            fileName: file.name,
                            fileSize: file.size,
                            mimeType: file.type
                        });
                    }

                    cancelPreview();
                } catch (uploadError) {
                    console.error('HTTP upload failed:', uploadError);
                    throw uploadError;
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Upload failed';
            setUploadError(errorMsg);
            console.error('File upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    }, [filePreview, websocket, cancelPreview]);

    return {
        filePreview,
        uploadProgress,
        isUploading,
        uploadError,
        handleFileSelect,
        cancelPreview,
        uploadFile
    };
}
