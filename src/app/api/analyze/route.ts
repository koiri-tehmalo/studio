
import { NextResponse } from 'next/server';

// This is the URL of your Python backend server.
// Make sure it's running and accessible from the Next.js server environment.
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000/analyze';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Forward the request to the Python backend
    const backendResponse = await fetch(PYTHON_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: image }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      // Forward the error from the Python backend to the client
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: backendResponse.status }
      );
    }
    
    // Get the JSON response from the Python backend
    const data = await backendResponse.json();

    // Send the response back to the client
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in API route:', error);
    // Check if it's a fetch error (e.g., connection refused)
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
        return NextResponse.json({ error: 'Failed to connect to the analysis backend. Is the Python server running?' }, { status: 503 });
    }

    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
