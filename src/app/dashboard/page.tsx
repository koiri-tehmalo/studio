'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SessionInfo } from './types';
import StartSessionForm from '@/components/dashboard/start-session-form';
import { Loader2 } from 'lucide-react';
import { useCamera } from '@/providers/camera-provider';

// Dynamically import the SessionDashboard component with SSR turned off
const SessionDashboard = dynamic(() => import('@/components/dashboard/SessionDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col justify-center items-center h-full">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="ml-4 text-muted-foreground mt-4">กำลังโหลดแดชบอร์ดการวิเคราะห์...</p>
    </div>
  ),
});

export default function DashboardPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { stream, startStream, stopStream } = useCamera();

  const handleSessionStart = async (info: SessionInfo) => {
    setIsStarting(true);
    await startStream(); // Tell the provider to start the camera
    setSessionInfo(info);
  };
  
  const handleSessionEnd = () => {
    stopStream();
    setSessionInfo(null);
  };

  useEffect(() => {
    // This effect listens for the stream to become available.
    // Once it is, we know we are ready to show the dashboard.
    if (stream && isStarting) {
      setIsStarting(false);
    }
  }, [stream, isStarting]);

  const showDashboard = sessionInfo && !isStarting && stream;
  const showForm = !sessionInfo && !isStarting;
  const showLoading = isStarting;

  return (
    <div className="h-full">
      {showForm && (
        <div className="h-full flex items-center justify-center">
          <StartSessionForm onSessionStart={handleSessionStart} />
        </div>
      )}

      {showLoading && (
        <div className="flex flex-col justify-center items-center h-full">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground mt-4">กำลังเปิดกล้องและเริ่มเซสชัน...</p>
        </div>
      )}

      {showDashboard && (
          <SessionDashboard sessionInfo={sessionInfo!} onSessionEnd={handleSessionEnd} />
      )}
    </div>
  );
}
