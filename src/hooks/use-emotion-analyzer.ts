'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
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
        tempCanvasRef.current = document.createElement('canvas');

        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
                );
                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU",
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 20,
                    minFaceDetectionConfidence: 0.3,
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

    // Main analysis function
    const analyzeFrame = useCallback(async (video: HTMLVideoElement): Promise<AnalysisResult[]> => {
        const faceLandmarker = faceLandmarkerRef.current;
        const cnnModel = cnnModelRef.current;
        const tempCanvas = tempCanvasRef.current;

        if (!faceLandmarker || !cnnModel || !tempCanvas) {
            return [];
        }

        const results = faceLandmarker.detectForVideo(video, performance.now());
        const analysisResults: AnalysisResult[] = [];

        if (results.faceLandmarks) {
             for (const landmarks of results.faceLandmarks) {
                let minX = video.videoWidth, minY = video.videoHeight, maxX = 0, maxY = 0;
                for (const landmark of landmarks) {
                    minX = Math.min(minX, landmark.x * video.videoWidth);
                    maxX = Math.max(maxX, landmark.x * video.videoWidth);
                    minY = Math.min(minY, landmark.y * video.videoHeight);
                    maxY = Math.max(maxY, landmark.y * video.videoHeight);
                }
                const padding = 20;
                const x = Math.max(0, minX - padding);
                const y = Math.max(0, minY - padding);
                const width = Math.min(video.videoWidth - x, (maxX - minX) + (padding * 2));
                const height = Math.min(video.videoHeight - y, (maxY - minY) + (padding * 2));

                const box: BoundingBox = { x, y, width, height };

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
