export async function transcribeWithAPI(
  blob: Blob,
  prompt?: string
): Promise<string | undefined> {
  const base64 = await new Promise<string | ArrayBuffer | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const body = JSON.stringify({
    file: base64,
    model: 'whisper-1',
    prompt,
  });
  const headers = { 'Content-Type': 'application/json' };
  try {
    const response = await fetch('/audio', {
      method: 'POST',
      body,
      headers,
    });

    const res = await response.json();

    if (res.text) {
      console.log('Successful transcription - ', res.text);
      return res.text;
    }
  } catch (error) {
    console.log('Failed to stream transcribe', error);
  }

  return undefined;
}
