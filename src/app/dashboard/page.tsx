import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, Smile, Meh, Users } from 'lucide-react';
import Image from 'next/image';

const historicalData = [
  { timestamp: '10:15 AM', interested: '85%', uninterested: '15%', total: 20 },
  { timestamp: '10:14 AM', interested: '80%', uninterested: '20%', total: 20 },
  { timestamp: '10:13 AM', interested: '90%', uninterested: '10%', total: 20 },
  { timestamp: '10:12 AM', interested: '75%', uninterested: '25%', total: 20 },
  { timestamp: '10:11 AM', interested: '88%', uninterested: '12%', total: 20 },
];

const BoundingBox = ({ x, y, width, height, isInterested }: { x: string, y: string, width: string, height: string, isInterested: boolean }) => {
  const borderColor = isInterested ? 'border-green-500' : 'border-red-500';
  const shadowColor = isInterested ? 'shadow-[0_0_15px_rgba(74,222,128,0.8)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.8)]';
  return (
    <div
      className={`absolute ${borderColor} ${shadowColor} border-2 rounded-md transition-all duration-300`}
      style={{ top: y, left: x, width: width, height: height }}
    ></div>
  );
};


export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      <div className="flex items-center justify-between">
        <div className="grid gap-2">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
            <p className="text-muted-foreground">Real-time classroom engagement analysis.</p>
        </div>
        <Button variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20</div>
            <p className="text-xs text-muted-foreground">Currently in classroom</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interested</CardTitle>
            <Smile className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">+5% from last minute</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uninterested</CardTitle>
            <Meh className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15%</div>
            <p className="text-xs text-muted-foreground">-5% from last minute</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Live Video Analysis</CardTitle>
              <CardDescription>Facial expressions are analyzed in real-time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <Image 
                  src="https://placehold.co/800x600.png"
                  alt="Live classroom feed"
                  data-ai-hint="classroom students"
                  fill
                  style={{ objectFit: 'cover' }}
                />
                <BoundingBox x="15%" y="30%" width="15%" height="25%" isInterested={true} />
                <BoundingBox x="40%" y="45%" width="18%" height="30%" isInterested={true} />
                <BoundingBox x="70%" y="35%" width="16%" height="28%" isInterested={false} />
                <BoundingBox x="5%" y="60%" width="15%" height="25%" isInterested={true} />
                <BoundingBox x="80%" y="65%" width="14%" height="22%" isInterested={true} />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Historical Data</CardTitle>
              <CardDescription>Engagement snapshots from the last 5 minutes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-center text-green-600">Interested</TableHead>
                    <TableHead className="text-center text-red-600">Uninterested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalData.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{entry.timestamp}</TableCell>
                      <TableCell className="text-center">{entry.interested}</TableCell>
                      <TableCell className="text-center">{entry.uninterested}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
