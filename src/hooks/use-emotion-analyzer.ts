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
        tempCanvasRef.current = document.createElement('canvas');

        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
                );
                faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 
                        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    minDetectionConfidence: 0.4,
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
    const analyzeFrame = useCallback(async (video: HTMLVideoElement): Promise<AnalysisResult[]> => {
        const faceDetector = faceDetectorRef.current;
        const cnnModel = cnnModelRef.current;
        const tempCanvas = tempCanvasRef.current;

        if (!faceDetector || !cnnModel || !tempCanvas) {
            return [];
        }

        const results = faceDetector.detectForVideo(video, performance.now());
        const analysisResults: AnalysisResult[] = [];

        if (results.detections) {
             for (const detection of results.detections) {
                if (!detection.boundingBox) continue;

                // Directly use the boundingBox from the detector
                const { originX, originY, width, height } = detection.boundingBox;
                
                let box: BoundingBox = { 
                    x: Math.max(0, originX), 
                    y: Math.max(0, originY), 
                    width, 
                    height 
                };

                // Clamp width and height to be within video boundaries
                if (box.x + box.width > video.videoWidth) {
                    box.width = video.videoWidth - box.x;
                }
                if (box.y + box.height > video.videoHeight) {
                    box.height = video.videoHeight - box.y;
                }
                
                if (box.width <= 0 || box.height <= 0) continue;

                const isInterested = await tf.tidy(() => {
                    const faceImage = tf.browser.fromPixels(video)
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
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCanvas.width = box.width;
                    tempCanvas.height = box.height;
                    tempCtx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
                    imageDataUrl = tempCanvas.toDataURL();
                }

                analysisResults.push({ box, isInterested, imageDataUrl });
            }
        }
        return analysisResults;
    }, []);

    return { modelsLoaded, analyzeFrame };
}
