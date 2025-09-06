
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, Upload, Camera } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';
import { useEmotionAnalyzer, AnalysisResult } from '@/hooks/use-emotion-analyzer';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

export default function TestDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameId = useRef<number>();

  const [activeTab, setActiveTab] = useState('camera');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

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
    if (activeTab === 'camera') {
      startStream();
    } else {
      stopStream();
       if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }
  }, [activeTab, startStream, stopStream]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);

  const drawResults = useCallback((ctx: CanvasRenderingContext2D, sourceElement: HTMLVideoElement | HTMLImageElement, results: AnalysisResult[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      for (const result of results) {
        const { box, isInterested } = result;

        const scaleX = ctx.canvas.width / (sourceElement instanceof HTMLVideoElement ? sourceElement.videoWidth : sourceElement.naturalWidth);
        const scaleY = ctx.canvas.height / (sourceElement instanceof HTMLVideoElement ? sourceElement.videoHeight : sourceElement.naturalHeight);

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
    if (activeTab !== 'camera' || !video || video.readyState < 2 || !modelsLoaded) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const currentAnalysisResults = await analyzeFrame(video);
    const ctx = canvas.getContext('2d');

    if (ctx && currentAnalysisResults) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      drawResults(ctx, video, currentAnalysisResults);
    }

    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [modelsLoaded, analyzeFrame, activeTab, drawResults]);

  const handleVideoPlay = useCallback(() => {
    if (modelsLoaded && activeTab === 'camera') {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
  }, [modelsLoaded, predictWebcam, activeTab]);
  
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setAnalysisResults([]); // Clear previous results
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeUploadedImage = useCallback(async () => {
      const image = imageRef.current;
      const canvas = canvasRef.current;
      if (!image || !canvas || !modelsLoaded || !uploadedImage) return;

      setIsAnalyzingImage(true);
      
      // The hook doesn't have an image analyzer, so we have to be creative.
      // We'll create a temporary video element from the image.
      const video = document.createElement('video');
      video.src = image.src;
      video.width = image.naturalWidth;
      video.height = image.naturalHeight;
      
      // We need to wait for the video to be ready to play
      video.onloadeddata = async () => {
        const results = await analyzeFrame(video);
        setAnalysisResults(results);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = image.clientWidth;
          canvas.height = image.clientHeight;
          drawResults(ctx, image, results);
        }
        setIsAnalyzingImage(false);
      };

  }, [modelsLoaded, uploadedImage, analyzeFrame, drawResults]);
  
  useEffect(() => {
    if (uploadedImage && imageRef.current && modelsLoaded) {
      // Use a timeout to ensure the image has rendered and clientWidth/clientHeight are available
      setTimeout(analyzeUploadedImage, 100);
    }
  }, [uploadedImage, modelsLoaded, analyzeUploadedImage]);


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

  const showCameraLoadingOverlay = activeTab === 'camera' && (isCameraLoading || !modelsLoaded);
  const showImageLoadingOverlay = activeTab === 'image' && (isAnalyzingImage || !modelsLoaded);
  
  let loadingText = "";
  if (isCameraLoading) loadingText = "กำลังเปิดกล้อง...";
  else if (!modelsLoaded) loadingText = "กำลังโหลดโมเดลวิเคราะห์...";
  else if (isAnalyzingImage) loadingText = "กำลังวิเคราะห์รูปภาพ...";

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
            เลือกแหล่งที่มาของภาพเพื่อทดสอบการตรวจจับใบหน้าและอารมณ์ ผลลัพธ์จะไม่ถูกบันทึก
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="camera"><Camera className="mr-2"/>กล้องถ่ายทอดสด</TabsTrigger>
                <TabsTrigger value="image"><Upload className="mr-2"/>อัปโหลดรูปภาพ</TabsTrigger>
              </TabsList>
              <TabsContent value="camera">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center mt-4">
                    <video ref={videoRef} onPlay={handleVideoPlay} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <canvas ref={canvasRef} className="absolute top-0 left-0" />
                    {showCameraLoadingOverlay && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>{loadingText}</p>
                      </div>
                    )}
                  </div>
                   {hasCameraPermission === false && (
                    <Alert variant="destructive" className="w-full mt-4">
                      <AlertTitle>จำเป็นต้องเข้าถึงกล้อง</AlertTitle>
                      <AlertDescription>
                        โปรดอนุญาตให้เข้าถึงกล้องเพื่อใช้คุณสมบัตินี้
                      </AlertDescription>
                    </Alert>
                  )}
              </TabsContent>
               <TabsContent value="image">
                <div className="flex flex-col items-center gap-4 mt-4">
                    <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={!modelsLoaded}>
                       <Upload className="mr-2 h-4 w-4" />
                       เลือกรูปภาพ
                    </Button>
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center">
                      {uploadedImage ? (
                        <img ref={imageRef} src={uploadedImage} alt="Uploaded for analysis" className="max-w-full max-h-full object-contain"/>
                      ) : (
                        <p className="text-muted-foreground">กรุณาเลือกรูปภาพเพื่อเริ่มการวิเคราะห์</p>
                      )}
                      <canvas ref={canvasRef} className="absolute top-0 left-0" />
                      {showImageLoadingOverlay && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>{loadingText}</p>
                          </div>
                      )}
                    </div>
                </div>
              </TabsContent>
            </Tabs>
             <div className="flex items-center justify-end w-full max-w-4xl text-sm text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full mr-2 ${modelsLoaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              MediaPipe & CNN Status
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

    