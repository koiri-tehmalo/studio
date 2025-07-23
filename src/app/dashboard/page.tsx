'use client';

import { useState } from 'react';
import { SessionInfo } from './types';
import StartSessionForm from '@/components/dashboard/start-session-form';
import SessionDashboard from '@/components/dashboard/session-dashboard';


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
