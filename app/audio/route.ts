import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { file, model = 'whisper-1', prompt } = body;
    // Create the buffer from the base64 string
    const base64split = file.split(';base64,');
    const fileType = base64split[0].split('/')[1];
    const base64 = base64split[1];
    const buffer = Buffer.from(base64, 'base64');

    // This is the hacky way to get the file type to be passed to the openai api
    const audioReadStream = Readable.from(buffer);
    // @ts-ignore
    audioReadStream.path = `audio.${fileType}`;
    const { data } = await openai.createTranscription(
      // @ts-ignore
      audioReadStream,
      model,
      prompt || undefined,
      'json',
      0,
      'en'
    );
    console.log('Received data', data);
    return NextResponse.json({ text: data.text }, { status: 200 });
  } catch (error) {
    console.error('Error processing API response - ', error);

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
}
