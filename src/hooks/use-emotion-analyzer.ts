
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =================================================================
// Interfaces and Types
// =================================================================
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// The backend is expected to return an array of objects with this shape.
// imageDataUrl is now optional as the backend might not return it.
export interface AnalysisResult {
    box: BoundingBox;
    isInterested: boolean;
    imageDataUrl?: string;
}

export interface FaceData {
    image: string;
    interested: boolean;
}

// =================================================================
// Custom Hook
// =================================================================
export function useEmotionAnalyzer() {
    const [modelsLoaded, setModelsLoaded] = useState(true); // No models to load on client anymore
    const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    useEffect(() => {
        // This canvas is used for capturing the frame to send to the backend.
        tempCanvasRef.current = document.createElement('canvas');
    }, []);


    // Main analysis function
    const analyzeFrame = useCallback(async (videoElement: HTMLVideoElement): Promise<AnalysisResult[]> => {
        const tempCanvas = tempCanvasRef.current;
        if (!tempCanvas) {
            console.error("Temp canvas not available");
            return [];
        }
        
        // 1. Capture frame from video element
        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
             console.error("Could not get 2D context from temp canvas");
             return [];
        }
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageDataUrl = tempCanvas.toDataURL('image/jpeg');

        try {
            // 2. Send frame to our Next.js API route
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageDataUrl }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error from backend: ${response.status} ${errorText}`);
                return [];
            }
            
            // 3. Return the analysis result from the backend
            const results: AnalysisResult[] = await response.json();

            // The backend must return the cropped image data URL if we want to display it
            // For now, we'll generate a placeholder if it's missing.
            return results.map(r => ({
                ...r,
                imageDataUrl: r.imageDataUrl || 'https://placehold.co/48x48' 
            }));

        } catch (error) {
            console.error("Failed to send frame for analysis:", error);
            return [];
        }

    }, []);

    return { modelsLoaded, analyzeFrame };
}
