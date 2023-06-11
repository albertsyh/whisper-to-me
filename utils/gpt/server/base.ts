import { isAxiosError } from 'axios';
import fs from 'fs';
import GPT3Tokenizer from 'gpt3-tokenizer';
import {
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from 'openai';
import path from 'path';
const tokenizer = new GPT3Tokenizer({ type: 'gpt3' });
import { Porro } from 'porro';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const DEBUG = process.env.COPILOT_IS_DEBUG === 'true';

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GptRateLimitError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = 'GptRateLimitError';
  }
}

export type Message = {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string;
};
export type Messages = Message[];

export type StreamToken = {
  type: 'token';
  token: string;
};
export type StreamResult = {
  type: 'completeMessage';
  completeMessage: string;
};
export type StreamStatistic =
  | {
      type: 'promptTokenCount';
      tokenCount: number;
    }
  | {
      type: 'responseTokenCount';
      tokenCount: number;
    };

export type GPTStatistics = {
  modelName: AcceptedModels;
  promptTokens: number;
  responseTokens: number;
};

export type GPTChainStatistics = (GPTStatistics & { callDesc: string })[];

export type GPTResponseToken = StreamToken | StreamResult | StreamError | StreamStatistic;

type RetryError =
  | 'UNEXPECTED_END'
  | 'RATE_LIMIT'
  | 'WAIT_LENGTH_EXCEEDED'
  | 'ENGINE_OVERLOADED'
  | 'OPENAI_SCREWUP';
type UnrecoverableError =
  | 'AUTH_ERROR'
  | 'LAST_MESSAGE_TOO_LARGE'
  | 'QUOTA_EXCEEDED'
  | 'UNKNOWN'
  | 'MANUAL_ABORT'
  | 'TOKEN_LIMIT';

export type StreamError = {
  type: 'error';
  errorType: RetryError | UnrecoverableError;
  partialMessage: string;
};

export type AcceptedModels = 'gpt-3.5-turbo' | 'gpt-4';

export const modelProperties: {
  [key in AcceptedModels]: {
    readableName: string;
    // Total tokens accepted by the model
    tokenLimit: number;
    // How many tokens in the prompt leave too little room for the response?
    defaultPromptTokenRatio: number;
    // Cost per thousand tokens in USD for prompt and response
    costPerMille: {
      prompt: number;
      response: number;
    };
    // TPM limit as determined by OpenAI (https://platform.openai.com/docs/guides/rate-limits/overview)
    tpm: number;
    // RPM limit as determined by OpenAI (https://platform.openai.com/docs/guides/rate-limits/overview)
    rpm: number;
  };
} = {
  'gpt-3.5-turbo': {
    readableName: 'GPT-3.5',
    tokenLimit: 4096,
    defaultPromptTokenRatio: 0.75,
    costPerMille: {
      prompt: 0.002,
      response: 0.002,
    },
    tpm: 90000,
    rpm: 3500,
  },
  'gpt-4': {
    readableName: 'GPT-4.0',
    tokenLimit: 8192,
    defaultPromptTokenRatio: 0.8,
    costPerMille: {
      prompt: 0.03,
      response: 0.06,
    },
    tpm: 40000,
    rpm: 200,
  },
};

const BUCKET_REFILL_INTERVAL = 1000; // 1s
const davinciChatTokenBucket = new Porro({
  bucketSize: modelProperties['gpt-3.5-turbo'].tpm,
  interval: BUCKET_REFILL_INTERVAL,
  tokensPerInterval: Math.floor(modelProperties['gpt-3.5-turbo'].tpm / 60), // Tokens per second
});
const davinciChatReqBucket = new Porro({
  bucketSize: modelProperties['gpt-3.5-turbo'].rpm,
  interval: BUCKET_REFILL_INTERVAL,
  tokensPerInterval: Math.floor(modelProperties['gpt-3.5-turbo'].rpm / 60), // Tokens per second
});

const gpt4TokenBucket = new Porro({
  bucketSize: modelProperties['gpt-4'].tpm,
  interval: BUCKET_REFILL_INTERVAL,
  tokensPerInterval: Math.floor(modelProperties['gpt-4'].tpm / 60), // Tokens per second
});
const gpt4ReqBucket = new Porro({
  bucketSize: modelProperties['gpt-4'].rpm,
  interval: BUCKET_REFILL_INTERVAL,
  tokensPerInterval: Math.floor(modelProperties['gpt-4'].rpm / 60), // Tokens per second
});

const QUEUE_MAX_DURATION_IN_SEC = 60;
function peekWaitDurationInSec(bucket: Porro, quantity: number) {
  if (bucket.tokens > quantity) {
    return 0;
  } else {
    const numTokensRefilledPerSecond =
      (bucket.tokensPerInterval / bucket.interval) * 1000;
    return (quantity - bucket.tokens) / numTokensRefilledPerSecond;
  }
}

/**
 * Trims a set of GPT Messages to fit a token size
 * @param messages Input GPT Messages
 * @param maxTokens Number of tokens to trim the messages down to.
 * @param keepSystemMessage Whether to try and keep the latest system message in the trimmed list, at the cost of user/assistant messages. False by default.
 * @returns
 */

export function fitMessagesToTokenLimit(
  messages: Messages,
  maxTokens: number,
  keepSystemMessage: boolean
) {
  let messageCount = 1;

  while (
    getMessagesTokenCount(messages.slice(-messageCount)) < maxTokens &&
    messageCount <= messages.length
  ) {
    messageCount++;
  }

  messageCount--;

  const messagesSlice = messageCount ? messages.slice(-messageCount) : [];

  if (
    keepSystemMessage &&
    !messagesSlice.some((message) => message.role === 'system')
  ) {
    // there are no system messages present, now we've got to find one and add it while staying in the token limit
    const lastSystemMessage = messages
      .filter((message) => message.role === 'system')
      .slice(-1);

    const lastSystemMessageTokenCount =
      getMessagesTokenCount(lastSystemMessage);

    if (lastSystemMessage.length && lastSystemMessageTokenCount < maxTokens) {
      // ok we found at least one that can fit in.

      let newMessageCount = 1;

      while (
        getMessagesTokenCount(messagesSlice.slice(-newMessageCount)) <
          maxTokens - lastSystemMessageTokenCount &&
        newMessageCount <= messagesSlice.length
      )
        newMessageCount++;

      newMessageCount--;

      const newMessagesSlice = newMessageCount
        ? messagesSlice.slice(-newMessageCount)
        : [];
      const newMessagesSliceTokenCount =
        getMessagesTokenCount(newMessagesSlice);

      if (
        newMessagesSliceTokenCount + lastSystemMessageTokenCount <
        maxTokens
      ) {
        return [...lastSystemMessage, ...newMessagesSlice];
      } else {
        return messagesSlice;
      }
    }
  }

  return messagesSlice;
}

function getTextFromMessages(messages: Messages) {
  return messages.map((message) => message.content).join('\n');
}

export function getMessagesTokenCount(messages: Messages) {
  const encoded = tokenizer.encode(getTextFromMessages(messages));
  return encoded.bpe.length;
}


/**
 * Function to return a promise instead of a stream when sending GPT messages, wraps streamChatGPT. Useful when the response doesn't go out to the user, so streaming isn't very useful.
 * @param messages Messages to pass GPT.
 * @param modelName Model to use, like gpt-3.5-turbo.
 * @param caseId caseId to use for logging, to connect GPT messages to originating conversation
 * @param abortSignal Use to stop streaming or responses in the middle. Useful for running multiple agents, to race them.
 * @param promptTokenRatio Each model has a maximum number of tokens. This ratio defines the maximum number of prompt tokens, to leave room for the response. Beyond this number, automated trimming is attempted to fit into the token limit.
 * @param temperature Affectes how deterministic/non-random the output is. OpenAI parameter.
 * @returns promise that resolves to a valid result from GPT or an error, and the statistics on number of tokens used for response and prompt.
 */
export async function askChatGPT(
  messages: Messages,
  modelName: AcceptedModels,
  caseId?: string,
  abortSignal?: AbortSignal,
  promptTokenRatio?: number,
  temperature?: number,
): Promise<{
  response: StreamResult | StreamError;
  statistics: GPTStatistics;
}> {
  const streamedRes = streamChatGPT(
    messages,
    modelName,
    caseId,
    abortSignal,
    promptTokenRatio,
    false,
    temperature,
  );

  const gptStats: GPTStatistics = {
    modelName,
    promptTokens: 0,
    responseTokens: 0,
  };

  try {
    for await (const response of streamedRes) {
      if (response.type === 'promptTokenCount')
        gptStats.promptTokens = response.tokenCount;
      else if (response.type === 'responseTokenCount')
        gptStats.responseTokens = response.tokenCount;

      if (response.type === 'error' || response.type === 'completeMessage')
        return {
          response,
          statistics: gptStats,
        };
    }
  } catch (err) {
    console.error(
      { err },
      'Error processing stream response from chatgpt - '
    );
  }

  return {
    response: {
      type: 'error',
      errorType: 'UNKNOWN',
      partialMessage: '',
    },
    statistics: gptStats,
  };
}

/**
 * Stream GPT responses as tokens, for performance and responsiveness. Returns statistics, GPT tokens, errors and other values as StreamX types.
 * @param messages Messages to pass GPT.
 * @param modelName Model to use, like gpt-3.5-turbo.
 * @param caseId caseId to use for logging, to connect GPT messages to originating conversation
 * @param abortSignal Use to stop streaming or responses in the middle. Useful for running multiple agents, to race them.
 * @param promptTokenRatio Each model has a maximum number of tokens. This ratio defines the maximum number of prompt tokens, to leave room for the response. Beyond this number, automated trimming is attempted to fit into the token limit.
 * @param dontTrimPromptToTokenRatio If set to false, this stops any trimming and just returns a failure. Designed for upstream callers that want to do task-specific message trimming on their own.
 * @param temperature Affectes how deterministic/non-random the output is. OpenAI parameter.
 * @returns
 */
export async function* streamChatGPT(
  messages: Messages,
  modelName: AcceptedModels,
  caseId?: string,
  abortSignal?: AbortSignal,
  promptTokenRatio?: number,
  dontTrimPromptToTokenRatio?: boolean, // Doing this because we don't want to break upstream calls by changing parameter order
  temperature?: number,
): AsyncGenerator<
  GPTResponseToken,
  void,
  undefined
> {
  let completeMessage: string = '';

  const TOKEN_MARGIN: number = 100; // Margin so if our token calc doesn't match openais the API doesn't freak out.

  try {
    let tokenCount = getMessagesTokenCount(messages);

    let responseTokenCount = Math.floor(
      modelProperties[modelName].tokenLimit - tokenCount - TOKEN_MARGIN
    );

    if (!promptTokenRatio)
      promptTokenRatio = modelProperties[modelName].defaultPromptTokenRatio;

    let promptRatioTokensExceeded =
      promptTokenRatio * modelProperties[modelName].tokenLimit < tokenCount;

    if (DEBUG) {
      console.log(
        `Calling ${modelName}: Messages weigh about ${tokenCount} tokens, limit is ${
          modelProperties[modelName].tokenLimit
        }. Response tokens - ${responseTokenCount}, allowed prompt tokens - ${
          promptTokenRatio * modelProperties[modelName].tokenLimit
        }, exceeded? ${promptRatioTokensExceeded ? 'Yes' : 'No'}`
      );
    }

    if (promptRatioTokensExceeded) {
      if (!dontTrimPromptToTokenRatio) {
        console.log(
          'Trimming messages to fit token limit, old size is ',
          tokenCount
        );
        messages = fitMessagesToTokenLimit(
          messages,
          Math.floor(promptTokenRatio * modelProperties[modelName].tokenLimit),
          true
        );
        console.log('Trimmed messages - ', messages);

        tokenCount = getMessagesTokenCount(messages);

        console.log('Trimmed token count - ', tokenCount);

        responseTokenCount = Math.floor(
          modelProperties[modelName].tokenLimit - tokenCount - TOKEN_MARGIN
        );

        promptRatioTokensExceeded =
          tokenCount > promptTokenRatio * modelProperties[modelName].tokenLimit;

        console.log(
          `Second try Calling ${modelName}: Messages weigh about ${tokenCount} tokens, limit is ${
            modelProperties[modelName].tokenLimit
          }. Response tokens - ${responseTokenCount}, allowed prompt tokens - ${
            promptTokenRatio * modelProperties[modelName].tokenLimit
          }, exceeded? ${promptRatioTokensExceeded ? 'Yes' : 'No'}`
        );
      }

      if (promptRatioTokensExceeded) {
        yield { type: 'error', errorType: 'TOKEN_LIMIT', partialMessage: '' };
        return;
      } else if (!messages.length) {
        yield {
          type: 'error',
          errorType: 'LAST_MESSAGE_TOO_LARGE',
          partialMessage: '',
        };
        return;
      }
    }

    switch (modelName) {
      case 'gpt-3.5-turbo':
        if (
          peekWaitDurationInSec(davinciChatReqBucket, 1) >
            QUEUE_MAX_DURATION_IN_SEC ||
          peekWaitDurationInSec(davinciChatTokenBucket, tokenCount) >
            QUEUE_MAX_DURATION_IN_SEC
        ) {
          throw new GptRateLimitError('GPT Rate Limit exceeded');
        }
        const reqBucketWaitMs = davinciChatReqBucket.request();
        const tokenBucketWaitMs = davinciChatTokenBucket.request(tokenCount);
        const waitMs = Math.max(reqBucketWaitMs, tokenBucketWaitMs);

        if (waitMs > 0) {
          await sleep(waitMs);
        }
        break;
      case 'gpt-4':
        if (
          peekWaitDurationInSec(gpt4ReqBucket, 1) > QUEUE_MAX_DURATION_IN_SEC ||
          peekWaitDurationInSec(gpt4TokenBucket, tokenCount) >
            QUEUE_MAX_DURATION_IN_SEC
        ) {
          throw new GptRateLimitError('GPT Rate Limit exceeded');
        }
        await gpt4ReqBucket.throttle();
        await gpt4TokenBucket.throttle(tokenCount);
        break;
      default:
        throw new Error('model not supported');
    }

    if (
      process.env.COPILOT_DATA_DIRECTORY &&
      process.env.COPILOT_GPT_LOG &&
      fs.existsSync(
        path.join(
          process.env.COPILOT_DATA_DIRECTORY,
          process.env.COPILOT_GPT_LOG
        )
      )
    ) {
      fs.appendFileSync(
        path.join(
          process.env.COPILOT_DATA_DIRECTORY,
          process.env.COPILOT_GPT_LOG
        ),
        JSON.stringify(
          { caseId, type: 'Messages Sent', messages, modelName, tokenCount },
          null,
          2
        ) + '\n'
      );
    }
    const response = await openai.createChatCompletion(
      {
        model: modelName,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: temperature || 0,
        top_p: 1,
        max_tokens: responseTokenCount,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true,
      },
      {
        responseType: 'stream',
        signal: abortSignal,
      }
    );

    yield {
      type: 'promptTokenCount',
      tokenCount,
    };

    const dataStream = response.data as unknown as AsyncIterable<Buffer>;

    let doneReceived: boolean = false;

    for await (const chunk of dataStream) {
      if (doneReceived) break;

      if (abortSignal && abortSignal.aborted) {
        yield {
          type: 'error',
          errorType: 'MANUAL_ABORT',
          partialMessage: completeMessage,
        };
        break;
      }

      const lines = chunk
        .toString('utf8')
        .split('\n')
        .filter((line) => line.trim().startsWith('data: '));

      for (const line of lines) {
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
          doneReceived = true;
          break;
        }

        const json = JSON.parse(message);
        const token = json.choices[0].delta.content;

        if (token) {
          completeMessage += token;
          yield { type: 'token', token };
        }
      }
    }

    if (doneReceived) {
      if (
        process.env.COPILOT_DATA_DIRECTORY &&
        process.env.COPILOT_GPT_LOG &&
        fs.existsSync(
          path.join(
            process.env.COPILOT_DATA_DIRECTORY,
            process.env.COPILOT_GPT_LOG
          )
        )
      ) {
        fs.appendFileSync(
          path.join(
            process.env.COPILOT_DATA_DIRECTORY,
            process.env.COPILOT_GPT_LOG
          ),
          JSON.stringify(
            {
              caseId,
              type: 'Successful Response',
              messages,
              response: completeMessage,
              modelName,
              tokenCount,
            },
            null,
            2
          ) + '\n'
        );
      }
      yield {
        type: 'responseTokenCount',
        tokenCount: getMessagesTokenCount([
          { role: 'assistant', content: completeMessage },
        ]),
      };
      yield { type: 'completeMessage', completeMessage };
      return;
    } else {
      yield {
        type: 'error',
        errorType: 'UNEXPECTED_END',
        partialMessage: completeMessage,
      };
      return;
    }
  } catch (err) {
    // TODO: Turn this into proper logging
    console.error({ err }, 'Error processing for chatgpt');
    let errorType: RetryError | UnrecoverableError = 'UNKNOWN';
    if (err instanceof GptRateLimitError) {
      yield {
        type: 'error',
        errorType: 'WAIT_LENGTH_EXCEEDED',
        partialMessage: '',
      };
    } else if (isAxiosError(err) && err.response) {
      if (err.response.status === 401) {
        errorType = 'AUTH_ERROR';
      } else if (err.response.status === 429) {
        // This is actually multiple errors, one of which is unrecoverable. From https://platform.openai.com/docs/guides/error-codes/api-errors I couldn't figure out how to tell.
        // TODO: 5 points to anyone who can! Please? Hendy? Albert?
        errorType = 'RATE_LIMIT';
      } else if (err.response.status === 500) {
        errorType = 'OPENAI_SCREWUP';
      }
      yield { type: 'error', errorType, partialMessage: completeMessage };
    } else {
      yield { type: 'error', errorType, partialMessage: completeMessage };
    }
  }
}
