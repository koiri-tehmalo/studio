
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import { useToast } from './use-toast';

// =================================================================
// Interfaces and Types
// =================================================================
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface AnalysisResult {
    box: BoundingBox;
    isInterested: boolean;
    imageDataUrl: string;
}

export interface FaceData {
    image: string;
    interested: boolean;
}

// =================================================================
// Custom Hook
// =================================================================
export function useEmotionAnalyzer() {
    const { toast } = useToast();
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const cnnModelRef = useRef<tf.LayersModel | null>(null);
    const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Effect for loading models
    useEffect(() => {
        // This canvas is used for both upscaling and cropping.
        tempCanvasRef.current = document.createElement('canvas');

        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
                );

                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "GPU",
                    },
                    runningMode: 'VIDEO',
                    numFaces: 10, // Allow detecting multiple faces
                });

                await tf.setBackend('webgl');
                cnnModelRef.current = await tf.loadLayersModel('/model/model.json');

                setModelsLoaded(true);
            } catch (error) {
                console.error("Failed to load AI models:", error);
                toast({
                    variant: 'destructive',
                    title: 'ไม่สามารถโหลดโมเดล AI',
                    description: 'โปรดรีเฟรชหน้าเว็บ หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
                });
            }
        };
        loadModels();

        // Cleanup function
        return () => {
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
            }
            if (cnnModelRef.current) {
                cnnModelRef.current.dispose();
            }
        };
    }, [toast]);

    const calculateBoundingBox = (landmarks: NormalizedLandmark[], imageWidth: number, imageHeight: number): BoundingBox | null => {
        if (!landmarks || landmarks.length === 0) return null;

        let minX = imageWidth, maxX = 0, minY = imageHeight, maxY = 0;

        for (const landmark of landmarks) {
            const px = landmark.x * imageWidth;
            const py = landmark.y * imageHeight;
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
        }
        
        // Add some padding to the bounding box
        const paddingX = (maxX - minX) * 0.1;
        const paddingY = (maxY - minY) * 0.2;
        
        minX = Math.max(0, minX - paddingX);
        maxX = Math.min(imageWidth, maxX + paddingX);
        minY = Math.max(0, minY - paddingY);
        maxY = Math.min(imageHeight, maxY + paddingY);


        if (maxX > minX && maxY > minY) {
             return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return null;
    }

    // Main analysis function
    const analyzeFrame = useCallback(async (videoElement: HTMLVideoElement): Promise<AnalysisResult[]> => {
        const faceLandmarker = faceLandmarkerRef.current;
        const cnnModel = cnnModelRef.current;
        const tempCanvas = tempCanvasRef.current;

        if (!faceLandmarker || !cnnModel || !tempCanvas) {
            return [];
        }

        const scaleFactor = 1.0; // No upscale needed with landmarker, can be adjusted if needed
        const upscaledWidth = videoElement.videoWidth * scaleFactor;
        const upscaledHeight = videoElement.videoHeight * scaleFactor;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!tempCtx) return [];

        tempCanvas.width = upscaledWidth;
        tempCanvas.height = upscaledHeight;
        tempCtx.drawImage(videoElement, 0, 0, upscaledWidth, upscaledHeight);

        const results = faceLandmarker.detectForVideo(tempCanvas, performance.now());
        const analysisResults: AnalysisResult[] = [];
        
        const sourceWidth = videoElement.videoWidth;
        const sourceHeight = videoElement.videoHeight;

        if (results.faceLandmarks) {
             for (const landmarks of results.faceLandmarks) {
                const rawBox = calculateBoundingBox(landmarks, upscaledWidth, upscaledHeight);
                if (!rawBox) continue;

                // Scale the bounding box back to the original video dimensions
                let box: BoundingBox = { 
                    x: Math.max(0, rawBox.x / scaleFactor), 
                    y: Math.max(0, rawBox.y / scaleFactor), 
                    width: rawBox.width / scaleFactor, 
                    height: rawBox.height / scaleFactor 
                };

                // Clamp the box to the original video dimensions
                if (box.x + box.width > sourceWidth) {
                    box.width = sourceWidth - box.x;
                }
                if (box.y + box.height > sourceHeight) {
                    box.height = sourceHeight - box.y;
                }
                
                if (box.width <= 0 || box.height <= 0) continue;

                // --- Post-processing Filter ---
                const MIN_FACE_SIZE_PIXELS = 20;
                const MAX_FACE_SIZE_PIXELS = sourceHeight; // Max face size can be the height of the video
                const MIN_ASPECT_RATIO = 0.7;
                const MAX_ASPECT_RATIO = 1.4; // Slightly more lenient for tilted heads

                if (
                    box.width < MIN_FACE_SIZE_PIXELS || box.height < MIN_FACE_SIZE_PIXELS ||
                    box.width > MAX_FACE_SIZE_PIXELS || box.height > MAX_FACE_SIZE_PIXELS
                ) {
                    continue; 
                }

                const aspectRatio = box.width / box.height;
                if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
                    continue; 
                }
                // --- End of Filter ---

                const isInterested = await tf.tidy(() => {
                    // Crop from the original video element for prediction
                    const faceImage = tf.browser.fromPixels(videoElement)
                        .slice([Math.round(box.y), Math.round(box.x)], [Math.round(box.height), Math.round(box.width)])
                        .resizeBilinear([48, 48])
                        .mean(2)
                        .toFloat()
                        .div(tf.scalar(255.0))
                        .expandDims(0)
                        .expandDims(-1);

                    const prediction = cnnModel.predict(faceImage) as tf.Tensor;
                    const [uninterestedScore, interestedScore] = prediction.dataSync();
                    return interestedScore > uninterestedScore;
                });
                
                let imageDataUrl = '';
                // Use a different canvas or clear and resize for cropping to get data URL
                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                    cropCanvas.width = box.width;
                    cropCanvas.height = box.height;
                    cropCtx.drawImage(videoElement, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
                    imageDataUrl = cropCanvas.toDataURL();
                }

                analysisResults.push({ box, isInterested, imageDataUrl });
            }
        }
        return analysisResults;
    }, []);

    return { modelsLoaded, analyzeFrame };
}
