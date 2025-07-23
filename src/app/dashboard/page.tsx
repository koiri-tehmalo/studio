'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SessionInfo } from './types';
import StartSessionForm from '@/components/dashboard/start-session-form';
import { Loader2 } from 'lucide-react';

// Dynamically import the SessionDashboard component with SSR turned off
// This ensures it only runs on the client-side, where browser APIs are available.
const SessionDashboard = dynamic(() => import('@/components/dashboard/SessionDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-full">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
      <p className="ml-4 text-muted-foreground">กำลังโหลดแดชบอร์ดการวิเคราะห์...</p>
    </div>
  ),
});


// =================================================================
// Main Page Component - Renders both the form and the dashboard
// but toggles visibility to preserve the dashboard's state.
// =================================================================
export default function DashboardPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  return (
    <div className="h-full">
      {/* The StartSessionForm is always rendered but hidden when a session is active */}
      <div style={{ display: sessionInfo ? 'none' : 'flex' }} className="h-full items-center justify-center">
        <StartSessionForm onSessionStart={setSessionInfo} />
      </div>

      {/* The SessionDashboard is always rendered but hidden until a session starts. 
          This prevents re-mounting and re-loading of AI models. */}
      <div style={{ display: sessionInfo ? 'block' : 'none' }} className="h-full">
        {sessionInfo && <SessionDashboard sessionInfo={sessionInfo} />}
      </div>
    </div>
  );
}
