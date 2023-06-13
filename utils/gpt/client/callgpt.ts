import { Messages } from '../server/base';

export type GPTResponsePacket =
  | {
      type: 'error';
      errorMessage: string;
    }
  | {
      type: 'fullMessage';
      message: string;
    }
  | {
      type: 'partialMessage';
      partialMessage: string;
    };

export async function* streamFromChatGPT(
  transcription: string,
  previousEmail?: string
): AsyncGenerator<GPTResponsePacket, void, undefined> {
  const response = await fetch('/gpt/draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcription,
      previousEmail,
    }),
  });

  if (!response.ok) {
    console.error('Error talking to chatgpt server - ', response.statusText);

    yield {
      type: 'error',
      errorMessage: response.statusText,
    };
    return;
  }

  const data = response.body;

  if (!data) {
    console.error('No data returned');

    yield {
      type: 'error',
      errorMessage: 'No data returned',
    };
    return;
  }

  const reader = data.getReader();
  const decoder = new TextDecoder();

  let done = false;

  let fullText = '';
  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;

    const token = decoder.decode(value);

    fullText += token;

    yield {
      type: 'partialMessage', // Cleaner and less chances of state issues than sending tokens
      partialMessage: fullText,
    };
  }

  yield {
    type: 'fullMessage',
    message: fullText,
  };
}
