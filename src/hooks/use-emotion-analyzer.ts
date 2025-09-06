
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
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
    const faceDetectorRef = useRef<FaceDetector | null>(null);
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

                faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                        delegate: "GPU",
                    },
                    runningMode: 'VIDEO',
                    minDetectionConfidence: 0.5, // Lowered to detect smaller faces
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
            if (faceDetectorRef.current) {
                faceDetectorRef.current.close();
            }
            if (cnnModelRef.current) {
                cnnModelRef.current.dispose();
            }
        };
    }, [toast]);

    // Main analysis function
    const analyzeFrame = useCallback(async (videoElement: HTMLVideoElement): Promise<AnalysisResult[]> => {
        const faceDetector = faceDetectorRef.current;
        const cnnModel = cnnModelRef.current;
        const tempCanvas = tempCanvasRef.current;

        if (!faceDetector || !cnnModel || !tempCanvas) {
            return [];
        }

        const scaleFactor = 1.5;
        const upscaledWidth = videoElement.videoWidth * scaleFactor;
        const upscaledHeight = videoElement.videoHeight * scaleFactor;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!tempCtx) return [];

        tempCanvas.width = upscaledWidth;
        tempCanvas.height = upscaledHeight;
        tempCtx.drawImage(videoElement, 0, 0, upscaledWidth, upscaledHeight);

        const results = faceDetector.detectForVideo(tempCanvas, performance.now());
        const analysisResults: AnalysisResult[] = [];
        
        // Original dimensions for cropping and bounding box scaling
        const sourceWidth = videoElement.videoWidth;
        const sourceHeight = videoElement.videoHeight;

        if (results.detections) {
             for (const detection of results.detections) {
                if (!detection.boundingBox) continue;

                const { originX, originY, width, height } = detection.boundingBox;
                
                // Scale the bounding box back to the original video dimensions
                let box: BoundingBox = { 
                    x: Math.max(0, originX / scaleFactor), 
                    y: Math.max(0, originY / scaleFactor), 
                    width: width / scaleFactor, 
                    height: height / scaleFactor 
                };

                // Clamp the box to the original video dimensions
                if (box.x + box.width > sourceWidth) {
                    box.width = sourceWidth - box.x;
                }
                if (box.y + box.height > sourceHeight) {
                    box.height = sourceHeight - box.y;
                }
                
                if (box.width <= 0 || box.height <= 0) continue;

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
                    // Crop from the original video element
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
