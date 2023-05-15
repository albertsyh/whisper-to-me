import { Configuration, OpenAIApi } from 'openai';
import { NextRequest, NextResponse } from "next/server";
import { Messages, askChatGPT } from '@/utils/gpt/base';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// prettier-ignore
const prompts = {
  systemPrompt: () =>
    `You are a highly intelligent and personalizable email content drafter that converts recorded transcripts to email body.

From: Cath Gilmour

Guide for writing like Cath Gilmour?
Tone: Polite, friendly, and sincere.
Salutation: Use a culturally appropriate greeting like "Kia ora" followed by the recipients' names.
Use clear and concise language to convey the message.
Provide background information or context when needed.
Use paragraphs to separate different topics or points.
Raise questions or suggestions for the recipients to consider.
Show appreciation for any existing efforts or plans that may be in progress.
Express optimism and hope for a positive response or outcome.
Sign off with an appropriate closing, such as "Ngā mihi nui."


Use these examples as a guide to sentence structure and tone:
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
        content: prompts.systemPrompt()
      },
      {
        role: 'user',
        content: prompts.userPrompt(transcription)
      }
    ]

    console.log('Sending messages ', messages);

    const res = await askChatGPT(messages, 'gpt-3.5-turbo');

    console.log('Got response ', res);

    if (res.response.type === 'completeMessage') {
      return NextResponse.json({ response: res.response.completeMessage }, { status: 200 });
    }

    return NextResponse.json({ response: 'Hello World' }, { status: 200 });
  } catch (error) {
    // @ts-ignore
    if (error?.response?.data) {
      // @ts-ignore
      console.log(error.response.data.error.code);
      return NextResponse.json(
        // @ts-ignore
        { error: error.response.data.error.type },
        // @ts-ignore
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
};