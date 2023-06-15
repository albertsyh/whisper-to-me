import { generateShortUUID } from './random';

const SHOW_LOGS = process.env.NODE_ENV === 'development';

export async function transcribeWithAPI(
  blob: Blob,
  prompt?: string
): Promise<string | undefined> {
  const id = generateShortUUID();

  const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const headers = { 'Content-Type': 'application/json' };

  if (process.env.NEXT_PUBLIC_HRISHI_WHISPER_AVAILABLE === 'yes') {
    const hrishiBody = JSON.stringify({
      file: base64,
      prompt: prompt,
    });

    if (SHOW_LOGS) console.log('Transcribing with Hrishi...');

    try {
      if (SHOW_LOGS) console.time(`Hrishi Whisper: ${id}`);
      const response = await fetch('/audio/custom', {
        method: 'POST',
        body: hrishiBody,
        headers,
      });
      if (SHOW_LOGS) console.timeEnd(`Hrishi Whisper: ${id}`);

      const res = await response.json();

      if (res.text) {
        return res.text;
      }
    } catch (err) {
      console.error('Error with Hrishis Whisper - ', err);
    }
  }

  if (SHOW_LOGS) console.log('Transcribing with OpenAi...');

  const openAIBody = JSON.stringify({
    file: base64,
    model: 'whisper-1',
    prompt,
  });

  try {
    if (SHOW_LOGS) console.time(`OpenAI Whisper: ${id}`);
    const response = await fetch('/audio', {
      method: 'POST',
      body: openAIBody,
      headers,
    });
    if (SHOW_LOGS) console.timeEnd(`OpenAI Whisper: ${id}`);

    const res = await response.json();

    if (res.text) {
      return res.text;
    }
  } catch (error) {
    console.log('Failed to stream transcribe', error);
  }

  return undefined;
}
