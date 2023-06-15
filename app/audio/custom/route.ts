import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, model = process.env.HRISHI_WHISPER_MODEL } = body;

    console.log('Env variables: ', process.env.HRISHI_WHISPER_URL, model);

    // Create the buffer from the base64 string
    const base64split = file.split(';base64,');
    const fileType = base64split[0].split('/')[1];
    const base64 = base64split[1];
    const buffer = Buffer.from(base64, 'base64');

    // Create a Blob object from the buffer
    const blob = new Blob([buffer], { type: `audio/${fileType}` });

    const formData = new FormData();
    formData.append('language', 'eng');
    formData.append('model_size', model);
    formData.append('audio_data', blob, 'temp_recording');

    const hrishiURL = process.env.HRISHI_WHISPER_URL!;

    const response = await fetch(hrishiURL, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const transcription = await response.text();
      return NextResponse.json({ text: transcription }, { status: 200 });
    } else {
      return NextResponse.json(
        { error: (await response.text()) || 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
