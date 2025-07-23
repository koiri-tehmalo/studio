export interface FaceData {
  image: string;
  interested: boolean;
}

export interface HistoricalData {
    timestamp: string;
    personCount: number;
    interested: string;
    uninterested: string;
}

export interface SessionInfo {
    name: string;
    subject: string;
    date: string;
    id: string;
}
