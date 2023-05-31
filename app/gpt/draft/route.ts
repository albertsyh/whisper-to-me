import { NextRequest, NextResponse } from 'next/server';
import { GPTResponseToken, Messages, streamChatGPT } from '@/utils/gpt/base';
import { emailPrompts } from '@/utils/gpt/prompts';

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt } = await request.json();

    console.log('Got parameters ', systemPrompt, userPrompt);

    const messages: Messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    console.log('Sending messages ', messages);

    const gptRes = await streamChatGPT(messages, 'gpt-3.5-turbo');

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function onParse(token: GPTResponseToken) {
          if (token.type === 'token') {
            controller.enqueue(encoder.encode(token.token));
          } else if (token.type === 'error') {
            controller.error(token.errorType);
          } else if (token.type === 'completeMessage') {
            controller.close();
          } else {
            // Process any other tokens we want to here - maybe to save statistics?
          }
        }

        for await (const token of gptRes) {
          onParse(token);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
