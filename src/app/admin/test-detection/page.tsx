'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, ShieldCheck } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';
import { useEmotionAnalyzer } from '@/hooks/use-emotion-analyzer';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

export default function TestDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  const { stream, hasCameraPermission, isLoading: isCameraLoading, startStream, stopStream } = useCamera();
  const { modelsLoaded, analyzeFrame } = useEmotionAnalyzer();
  const { userRole, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (userRole === 'admin') {
      startStream();
    }
    return () => {
      // Ensure stopStream is called when the component unmounts
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      stopStream();
    };
  }, [userRole, startStream, stopStream]);

  useEffect(() => {
    if (!isAuthLoading && userRole !== 'admin') {
      router.push('/dashboard');
    }
  }, [userRole, isAuthLoading, router]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);

  const predictWebcam = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const analysisResults = await analyzeFrame(video);
    const ctx = canvas.getContext('2d');

    if (ctx && analysisResults) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const result of analysisResults) {
        const { box, isInterested } = result;

        const canvasX = box.x * (canvas.width / video.videoWidth);
        const canvasY = box.y * (canvas.height / video.videoHeight);
        const canvasWidth = box.width * (canvas.width / video.videoWidth);
        const canvasHeight = box.height * (canvas.height / video.videoHeight);
        
        const thaiText = isInterested ? EMOTION_CLASSES[1] : EMOTION_CLASSES[0];
        const color = isInterested ? '#4ade80' : '#f87171';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);
        
        ctx.fillStyle = color;
        const textBackgroundHeight = 24;
        ctx.font = `bold 16px 'Poppins'`;
        const textWidth = ctx.measureText(thaiText).width;
        
        ctx.fillRect(canvasX - 1, canvasY - textBackgroundHeight, textWidth + 12, textBackgroundHeight);
        
        ctx.fillStyle = '#fff';
        ctx.fillText(thaiText, canvasX + 5, canvasY - 6);
      }
    }

    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [modelsLoaded, analyzeFrame]);

  const handleVideoPlay = useCallback(() => {
    if (modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
  }, [modelsLoaded, predictWebcam]);
  
  useEffect(() => {
    const video = videoRef.current;
    if (modelsLoaded && video && !video.paused) {
        handleVideoPlay();
    }
    return () => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
    }
  }, [modelsLoaded, handleVideoPlay]);

  if (isAuthLoading || userRole !== 'admin') {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const showLoadingOverlay = isCameraLoading || !modelsLoaded;
  const loadingText = isCameraLoading ? "กำลังเปิดกล้อง..." : !modelsLoaded ? "กำลังโหลดโมเดลวิเคราะห์..." : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <TestTube className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight font-headline">หน้าทดสอบการตรวจจับ</h1>
          </div>
          <p className="text-muted-foreground">
            หน้านี้สำหรับการทดสอบโมเดลวิเคราะห์ใบหน้าและอารมณ์แบบเรียลไทม์ (สำหรับ Admin เท่านั้น)
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>การวิเคราะห์วิดีโอสด</CardTitle>
          <CardDescription>
            ผลลัพธ์ที่แสดงในหน้านี้จะไม่ถูกบันทึกลงในฐานข้อมูล
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
            <video ref={videoRef} onPlay={handleVideoPlay} className="w-full h-full object-cover" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="absolute top-0 left-0" />
            {showLoadingOverlay && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>{loadingText}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end w-full max-w-4xl text-sm text-muted-foreground">
            <span className={`h-2.5 w-2.5 rounded-full mr-2 ${modelsLoaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            MediaPipe & CNN Status
          </div>
          {hasCameraPermission === false && (
            <Alert variant="destructive" className="w-full max-w-4xl">
              <AlertTitle>จำเป็นต้องเข้าถึงกล้อง</AlertTitle>
              <AlertDescription>
                โปรดอนุญาตให้เข้าถึงกล้องเพื่อใช้คุณสมบัตินี้
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
