import { NextRequest, NextResponse } from 'next/server';
import { GPTResponseToken, Messages, streamChatGPT } from '@/utils/gpt/base';

// prettier-ignore
const prompts = {
  systemPrompt: () =>
`You are a highly intelligent and personalizable email content drafter that converts recorded transcripts to email body.

From: Cath Gilmour

Guide for writing like Cath Gilmour:
Tone: Polite, friendly, and sincere.
Salutation: Use a culturally appropriate greeting like "Kia ora" followed by the recipients' names.
Use clear and concise language to convey the message.
Provide background information or context when needed.
Use paragraphs to separate different topics or points.
Raise questions or suggestions for the recipients to consider.
Show appreciation for any existing efforts or plans that may be in progress.
Express optimism and hope for a positive response or outcome.
Sign off with an appropriate closing, such as "Ngā mihi nui."


Use these examples as a guide to sentence structure and tone. Don't use them directly in the email:
"I hope you all had a good weekend."
"In the past, I think Lions Club members have helped with such projects."
"There might be others who could also help? Or a community working bee?"
"I look forward to hearing from you – hopefully in the positive!"
"You might already have a plan in train, would be even better - I just didn't want to hear after the fact that it had been wasted."`,
  userPrompt: (transcription: string) =>
    `TRANSCRIPTION:
\`\`\`
${transcription}
\`\`\`

TRANSCRIPTION contains information about the email that Cath Gilmour intends to write, as well as instructions about the content. Make any edits to punctuation and content as necessary, and provide an updated, formatted email content (no subject) from TRANSCRIPTION alone. If you don't know who the email is for, don't mention it.`
}

export async function POST(request: NextRequest) {
  try {
    const { transcription } = await request.json();

    console.log('Got transcription ', transcription);

    const messages: Messages = [
      {
        role: 'system',
        content: prompts.systemPrompt(),
      },
      {
        role: 'user',
        content: prompts.userPrompt(transcription),
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

// A simpler function we can use if the top one borks
// export async function GET() {
//   const sleep = (ms: number) =>
//     new Promise((resolve) => setTimeout(resolve, ms));

//   let responseStream = new TransformStream();

//   const writer = responseStream.writable.getWriter();

//   const encoder = new TextEncoder();

//   writer.write(encoder.encode('This is the first message...'));

//   (async function process() {
//     for (let i = 0; i < 10; i++) {
//       console.log('Writing token ', i);
//       writer.write(encoder.encode(`This is token number ${i}`));
//       await sleep(500);
//     }
//     writer.close();
//   })();

//   return new Response(responseStream.readable, {
//     headers: {
//       'Content-Type': 'text/event-stream;charset=utf-8',
//       'Cache-Control': 'no-cache, no-transform',
//       Connection: 'keep-alive',
//       'X-Accel-Buffering': 'no',
//     },
//   });
// }
