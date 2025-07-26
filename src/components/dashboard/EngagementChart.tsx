'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { History } from 'lucide-react';

interface EngagementData {
    timestamp: string;
    interestedCount: number;
    uninterestedCount: number;
}

interface EngagementChartProps {
    data: EngagementData[];
}

export default function EngagementChart({ data }: EngagementChartProps) {
    if (data.length === 0) {
        return null; // Don't render the chart if there is no data
    }
    
    // Reverse the data for correct chronological order in the chart
    const chartData = [...data].reverse();

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    <CardTitle>กราฟแนวโน้มการมีส่วนร่วม</CardTitle>
                </div>
                <CardDescription>แสดงจำนวนนักเรียนที่สนใจและไม่สนใจตลอดช่วงเวลาการสังเกตการณ์</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                            contentStyle={{
                                background: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                            }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="interestedCount" name="สนใจ" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="uninterestedCount" name="ไม่สนใจ" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6}/>
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
