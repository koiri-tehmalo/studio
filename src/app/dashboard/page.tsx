'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SessionInfo } from './types';
import StartSessionForm from '@/components/dashboard/start-session-form';
import { Loader2 } from 'lucide-react';

// Dynamically import the SessionDashboard component with SSR turned off
// This ensures it only runs on the client-side, where browser APIs are available.
const SessionDashboard = dynamic(() => import('@/components/dashboard/session-dashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-full">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="ml-4 text-muted-foreground">กำลังโหลดแดชบอร์ดการวิเคราะห์...</p>
    </div>
  ),
});


// =================================================================
// Main Page Component - Renders either the form or the dashboard
// =================================================================
export default function DashboardPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  if (!sessionInfo) {
    return <StartSessionForm onSessionStart={setSessionInfo} />;
  }
  
  return <SessionDashboard sessionInfo={sessionInfo} />;
}
