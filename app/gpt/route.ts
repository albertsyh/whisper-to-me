import { Configuration, OpenAIApi } from 'openai';
import { NextRequest, NextResponse } from "next/server";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export async function POST(request: NextRequest) {
  try {
    const { transcription } = await request.json();

    console.log('Got transcription ', transcription);

    return NextResponse.json({response: 'Hello World'}, {status: 200});
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