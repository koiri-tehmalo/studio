
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TestTube, Users, Smile, Meh, Upload, Video } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';
import { useEmotionAnalyzer, AnalysisResult, FaceData } from '@/hooks/use-emotion-analyzer';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';

const EMOTION_CLASSES = ['ไม่สนใจ', 'สนใจ'];

export default function TestDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  const uploadedVideoCanvasRef = useRef<HTMLCanvasElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameId = useRef<number>();
  
  const croppedFaces = useRef<FaceData[]>([]);
  const [facesForDisplay, setFacesForDisplay] = useState<FaceData[]>([]);

  // States for live analysis
  const [liveAnalysisResults, setLiveAnalysisResults] = useState<AnalysisResult[]>([]);
  
  // States for image analysis
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageAnalysisResults, setImageAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // States for video analysis
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoAnalysisResults, setVideoAnalysisResults] = useState<AnalysisResult[]>([]);

  const [activeTab, setActiveTab] = useState('camera');
  const [backendStatus, setBackendStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  const { stream, hasCameraPermission, isLoading: isCameraLoading, startStream, stopStream } = useCamera();
  const { modelsLoaded, analyzeFrame, analyzeImage } = useEmotionAnalyzer();
  const { userRole, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && userRole !== 'admin') {
      router.push('/dashboard');
    }
  }, [userRole, isAuthLoading, router]);

  const stopAllMedia = useCallback(() => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = undefined;
    }
    stopStream();
    if (uploadedVideoRef.current) {
      uploadedVideoRef.current.pause();
    }
  }, [stopStream]);

  useEffect(() => {
    stopAllMedia();
    setFacesForDisplay([]);
    croppedFaces.current = [];

    if (activeTab === 'camera') {
      startStream();
    } else if (activeTab === 'uploadVideo' && uploadedVideoRef.current && !uploadedVideoRef.current.paused) {
        animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
    
    return () => {
      stopAllMedia();
    };
  }, [activeTab, startStream, stopAllMedia]);


  useEffect(() => {
    if (stream && videoRef.current && activeTab === 'camera') {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream, activeTab]);

  const drawResults = useCallback((ctx: CanvasRenderingContext2D, sourceElement: HTMLVideoElement | HTMLImageElement, results: AnalysisResult[]) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const isVideo = sourceElement instanceof HTMLVideoElement;
      const sourceWidth = isVideo ? sourceElement.videoWidth : sourceElement.naturalWidth;
      const sourceHeight = isVideo ? sourceElement.videoHeight : sourceElement.naturalHeight;

      if (sourceWidth === 0 || sourceHeight === 0) return;

      for (const result of results) {
        const { box, isInterested } = result;

        const scaleX = ctx.canvas.width / sourceWidth;
        const scaleY = ctx.canvas.height / sourceHeight;

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
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResult[]>> | null = null;

    if (activeTab === 'camera') {
        video = videoRef.current;
        canvas = canvasRef.current;
        setAnalysisResults = setLiveAnalysisResults;
    } else if (activeTab === 'uploadVideo') {
        video = uploadedVideoRef.current;
        canvas = uploadedVideoCanvasRef.current;
        setAnalysisResults = setVideoAnalysisResults;
    }

    if (!video || video.readyState < 2 || !modelsLoaded || video.paused) {
      if (video && !video.paused) animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    if (!canvas || !setAnalysisResults) {
      if (video && !video.paused) animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const { results: currentAnalysisResults, success } = await analyzeFrame(video);
    setBackendStatus(success ? 'connected' : 'error');
    
    if (success) {
        setAnalysisResults(currentAnalysisResults); // Set results for stats cards
        croppedFaces.current = currentAnalysisResults.map(r => ({ image: r.imageDataUrl || 'https://placehold.co/48x48', interested: r.isInterested }));
    }

    const ctx = canvas.getContext('2d');
    if (ctx && currentAnalysisResults) {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      drawResults(ctx, video, currentAnalysisResults);
    }

    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [modelsLoaded, analyzeFrame, drawResults, activeTab]);
  
  useEffect(() => {
    const faceUpdateInterval = setInterval(() => {
      setFacesForDisplay([...croppedFaces.current]);
    }, 5000);

    return () => clearInterval(faceUpdateInterval);
  }, []);


  const handleVideoPlay = useCallback(() => {
    if (modelsLoaded) {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(predictWebcam);
    }
  }, [modelsLoaded, predictWebcam]);
  
  useEffect(() => {
    const liveVideo = videoRef.current;
    if (modelsLoaded && liveVideo && !liveVideo.paused && activeTab === 'camera') {
        handleVideoPlay();
    }
  }, [modelsLoaded, handleVideoPlay, activeTab]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImageSrc(dataUrl);
        setImageAnalysisResults([]); // Clear previous results
        setIsAnalyzingImage(true);
        const { results, success } = await analyzeImage(dataUrl);
        setBackendStatus(success ? 'connected' : 'error');
        if (success) {
          setImageAnalysisResults(results);
          croppedFaces.current = results.map(r => ({ image: r.imageDataUrl || 'https://placehold.co/48x48', interested: r.isInterested }));
          setFacesForDisplay([...croppedFaces.current]);
        }
        setIsAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
        setVideoAnalysisResults([]);
    }
  };

  useEffect(() => {
    const image = imageRef.current;
    const canvas = imageCanvasRef.current;
    if (image && canvas && imageAnalysisResults.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = image.clientWidth;
            canvas.height = image.clientHeight;
            drawResults(ctx, image, imageAnalysisResults);
        }
    }
  }, [imageAnalysisResults, drawResults]);

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
  
  let loadingText = "";
  if (isCameraLoading) loadingText = "กำลังเปิดกล้อง...";
  else if (!modelsLoaded) loadingText = "กำลังโหลดโมเดลวิเคราะห์...";

  let analysisResults: AnalysisResult[] = [];
  if (activeTab === 'camera') analysisResults = liveAnalysisResults;
  else if (activeTab === 'uploadImage') analysisResults = imageAnalysisResults;
  else if (activeTab === 'uploadVideo') analysisResults = videoAnalysisResults;

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
  
  const getFaceDisplayMessage = () => {
      switch (activeTab) {
          case 'camera': return 'รอการตรวจจับใบหน้า...';
          case 'uploadImage': return imageSrc ? 'ผลลัพธ์การวิเคราะห์รูปภาพ' : 'อัปโหลดรูปภาพเพื่อดูผลลัพธ์...';
          case 'uploadVideo': return videoSrc ? 'รอการตรวจจับใบหน้าจากวิดีโอ...' : 'อัปโหลดวิดีโอเพื่อดูผลลัพธ์...';
          default: return '';
      }
  }


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
            ทดสอบการตรวจจับใบหน้าและอารมณ์จากกล้อง, รูปภาพ หรือวิดีโอ ผลลัพธ์จะไม่ถูกบันทึก
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
                    {getFaceDisplayMessage()}
                  </div>
                )}
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="camera">กล้องสด</TabsTrigger>
                  <TabsTrigger value="uploadImage">อัปโหลดรูปภาพ</TabsTrigger>
                  <TabsTrigger value="uploadVideo">อัปโหลดวิดีโอ</TabsTrigger>
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
                </TabsContent>
                <TabsContent value="uploadImage">
                    <Card className="mt-4">
                        <CardContent className="pt-6">
                            <div className="grid w-full items-center gap-2">
                                <Label htmlFor="picture">เลือกรูปภาพ</Label>
                                <Input id="picture" type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" />
                            </div>
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center mt-4">
                                {imageSrc ? (
                                    <>
                                        <img ref={imageRef} src={imageSrc} alt="Upload preview" className="w-full h-full object-contain" />
                                        <canvas ref={imageCanvasRef} className="absolute top-0 left-0" />
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">โปรดเลือกรูปภาพ</p>
                                )}
                                {isAnalyzingImage && (
                                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <p>กำลังวิเคราะห์รูปภาพ...</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="uploadVideo">
                    <Card className="mt-4">
                        <CardContent className="pt-6">
                            <div className="grid w-full items-center gap-2">
                                <Label htmlFor="video-upload">เลือกวิดีโอ</Label>
                                <Input id="video-upload" type="file" ref={videoFileInputRef} onChange={handleVideoFileChange} accept="video/*" />
                            </div>
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex justify-center items-center mt-4">
                                {videoSrc ? (
                                    <>
                                        <video
                                            ref={uploadedVideoRef}
                                            src={videoSrc}
                                            onPlay={handleVideoPlay}
                                            onEnded={() => { if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current) }}
                                            className="w-full h-full object-contain"
                                            controls
                                            muted
                                        />
                                        <canvas ref={uploadedVideoCanvasRef} className="absolute top-0 left-0 pointer-events-none" />
                                    </>
                                ) : (
                                    <p className="text-muted-foreground">โปรดเลือกวิดีโอ</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
              </Tabs>
            </div>
               {hasCameraPermission === false && activeTab === 'camera' && (
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
                    <p className="text-xs text-muted-foreground">จำนวนใบหน้าทั้งหมด</p>
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

    