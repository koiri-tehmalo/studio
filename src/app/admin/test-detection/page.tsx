
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, Users, Smile, Meh } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';
import { useEmotionAnalyzer, AnalysisResult, FaceData } from '@/hooks/use-emotion-analyzer';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

export default function TestDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const liveCroppedFaces = useRef<FaceData[]>([]);
  const [facesForDisplay, setFacesForDisplay] = useState<FaceData[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [backendStatus, setBackendStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  const { stream, hasCameraPermission, isLoading: isCameraLoading, startStream, stopStream } = useCamera();
  const { modelsLoaded, analyzeFrame } = useEmotionAnalyzer();
  const { userRole, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && userRole !== 'admin') {
      router.push('/dashboard');
    }
  }, [userRole, isAuthLoading, router]);

  useEffect(() => {
    startStream();
    // Cleanup effect
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      stopStream();
    };
  }, [startStream, stopStream]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);

  const drawResults = useCallback((ctx: CanvasRenderingContext2D, sourceElement: HTMLVideoElement, results: AnalysisResult[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      for (const result of results) {
        const { box, isInterested } = result;

        const scaleX = ctx.canvas.width / sourceElement.videoWidth;
        const scaleY = ctx.canvas.height / sourceElement.videoHeight;

        const canvasX = box.x * scaleX;
        const canvasY = box.y * scaleY;
        const canvasWidth = box.width * scaleX;
        const canvasHeight = box.height * scaleY;
        
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
  }, []);

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

    const { results: currentAnalysisResults, success } = await analyzeFrame(video);
    setBackendStatus(success ? 'connected' : 'error');
    
    if (success) {
        setAnalysisResults(currentAnalysisResults); // Set results for stats cards
        liveCroppedFaces.current = currentAnalysisResults.map(r => ({ image: r.imageDataUrl || 'https://placehold.co/48x48', interested: r.isInterested }));
    }


    const ctx = canvas.getContext('2d');

    if (ctx && currentAnalysisResults) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      drawResults(ctx, video, currentAnalysisResults);
    }

    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [modelsLoaded, analyzeFrame, drawResults]);
  
   // Effect to update the displayed faces every few seconds
  useEffect(() => {
    const faceUpdateInterval = setInterval(() => {
      setFacesForDisplay([...liveCroppedFaces.current]);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(faceUpdateInterval);
  }, []);


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


  if (isAuthLoading || !userRole) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
   if (userRole !== 'admin') {
     return null;
   }

  const showLoadingOverlay = isCameraLoading || !modelsLoaded;
  
  let loadingText = "";
  if (isCameraLoading) loadingText = "กำลังเปิดกล้อง...";
  else if (!modelsLoaded) loadingText = "กำลังโหลดโมเดลวิเคราะห์...";

  const totalFaces = analysisResults.length;
  const interestedFaces = analysisResults.filter(r => r.isInterested).length;
  const uninterestedFaces = totalFaces - interestedFaces;
  
  const getStatusColor = () => {
    switch (backendStatus) {
        case 'connected': return 'bg-green-500 animate-pulse';
        case 'error': return 'bg-red-500';
        default: return 'bg-yellow-500';
    }
  };


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
          <CardTitle>เครื่องมือทดสอบโมเดล</CardTitle>
          <CardDescription>
            ทดสอบการตรวจจับใบหน้าและอารมณ์จากกล้อง ผลลัพธ์จะไม่ถูกบันทึก
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
            <div className="w-full max-w-4xl mt-4 flex flex-col gap-4">
              <div className="w-full bg-muted rounded-lg p-2 h-24 overflow-x-auto whitespace-nowrap">
                {facesForDisplay.length > 0 ? (
                  facesForDisplay.map((faceData, index) => (
                    <img
                      key={index}
                      src={faceData.image}
                      alt={`Cropped face ${index + 1}`}
                      className={`inline-block h-full w-auto rounded-md mr-2 border-4 ${
                        faceData.interested ? 'border-green-400' : 'border-red-400'
                      }`}
                    />
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    รอการตรวจจับใบหน้า...
                  </div>
                )}
              </div>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
                <video ref={videoRef} onPlay={handleVideoPlay} className="w-full h-full object-cover" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="absolute top-0 left-0" />
                {showLoadingOverlay && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>{loadingText}</p>
                  </div>
                )}
              </div>
            </div>
               {hasCameraPermission === false && (
                <Alert variant="destructive" className="w-full mt-4">
                  <AlertTitle>จำเป็นต้องเข้าถึงกล้อง</AlertTitle>
                  <AlertDescription>
                    โปรดอนุญาตให้เข้าถึงกล้องเพื่อใช้คุณสมบัตินี้
                  </AlertDescription>
                </Alert>
              )}
            
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ใบหน้าที่ตรวจพบ</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalFaces}</div>
                    <p className="text-xs text-muted-foreground">จำนวนใบหน้าทั้งหมดในเฟรม</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">สนใจ</CardTitle>
                    <Smile className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{interestedFaces}</div>
                    <p className="text-xs text-muted-foreground">จำนวนคนที่แสดงความสนใจ</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ไม่สนใจ</CardTitle>
                    <Meh className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{uninterestedFaces}</div>
                    <p className="text-xs text-muted-foreground">จำนวนคนที่ไม่แสดงความสนใจ</p>
                  </CardContent>
                </Card>
            </div>


             <div className="flex items-center justify-end w-full max-w-4xl text-sm text-muted-foreground mt-2">
              <span className={`h-2.5 w-2.5 rounded-full mr-2 ${getStatusColor()}`}></span>
              Backend Connection
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
