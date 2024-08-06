import type { V2ApiOptions } from '../apiCommon';
import https from 'https';
import axios, { type AxiosRequestConfig } from 'axios';
import { APISettingsStore } from '../APISettingsStore';

const TOKEN_EXPIRATION_SECONDS = 300;

const convertError = (error: any) => {
  console.log(JSON.stringify(error.response.data, null, 2));
  return {
    message: error.response?.data?.error_message || error.message,
    code: error.code,
    statusCode: error.response?.statusCode,
    statusMessage: error.response?.statusMessage,
    body: error.response?.data,
  }
};

type TokenEntry = {
  token: string;
  expiresAt: number;
};

const streamingHttpsAgent = new https.Agent({
  keepAlive: true,
});

const jwtStore: Record<string, TokenEntry> = {};

type TokenRequestPayload = {
  user_id: string;
  token_expiration: number;
};

async function createJwtToken(): Promise<string> {
  const { userId, apiKey } = APISettingsStore.getSettings();
  const requestOptions: AxiosRequestConfig = {
    method: 'POST',
    // url: 'https://fal-playht-demo-app.vercel.app/api/playht/authorize',
    url: 'http://localhost:3000/api/playht/authorize',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    responseType: 'json',
    data: {
      user_id: userId,
      token_expiration: TOKEN_EXPIRATION_SECONDS,
    } satisfies TokenRequestPayload,
  };
  const response = await axios(requestOptions).catch((error: any) => {
    throw convertError(error);
  });
  return response.data;
}

async function ensureJwtToken(): Promise<string> {
  const { userId } = APISettingsStore.getSettings();
  let jwtToken = jwtStore[userId];
  if (!jwtToken || jwtToken.expiresAt < Date.now()) {
    jwtToken = {
      token: await createJwtToken(),
      expiresAt: Date.now() + TOKEN_EXPIRATION_SECONDS * 1000,
    };
    jwtStore[userId] = jwtToken;
    setTimeout(() => {
      delete jwtStore[userId];
    }, TOKEN_EXPIRATION_SECONDS * 990);
  }
  return jwtToken.token;
}

export async function generateFalStream(
  text: string,
  voice: string,
  options?: V2ApiOptions,
): Promise<NodeJS.ReadableStream> {
  const outputFormat = options?.outputFormat || 'mp3';
  const accept = outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/basic';

  const token = await ensureJwtToken();

  const streamOptions: AxiosRequestConfig = {
    method: 'POST',
    url: `https://fal.run/fal-ai/playht-tts/stream?fal_jwt_token=${token}`,
    headers: {
      accept,
      'content-type': 'application/json',
    },
    responseType: 'stream',
    data: {
      text,
      // voice,
      quality: options?.quality || 'medium',
      output_format: outputFormat,
      speed: options?.speed || 1,
      sample_rate: options?.sampleRate || 24000,
      seed: options?.seed,
      temperature: options?.temperature,
      voice_engine: options?.voiceEngine,
      emotion: options?.emotion,
      voice_guidance: options?.voiceGuidance,
      text_guidance: options?.textGuidance,
      style_guidance: options?.styleGuidance,
    },
    httpsAgent: streamingHttpsAgent,
  };

  const response = await axios(streamOptions).catch((error: any) => {
    throw convertError(error);
  });
  return response.data;
}

export async function generateFalSpeech(
  text: string,
  voice: string,
  options?: V2ApiOptions,
): Promise<any> {
  const token = await ensureJwtToken();
  const requestOptions: AxiosRequestConfig = {
    method: 'POST',
    url: `https://fal.run/fal-ai/playht-tts?fal_jwt_token=${token}`,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    responseType: 'json',
    data: {
      text,
      // voice,
      quality: options?.quality || 'medium',
      speed: options?.speed || 1,
      sample_rate: options?.sampleRate || 24000,
      seed: options?.seed,
      temperature: options?.temperature,
      voice_engine: options?.voiceEngine,
      emotion: options?.emotion,
      voice_guidance: options?.voiceGuidance,
      text_guidance: options?.textGuidance,
      style_guidance: options?.styleGuidance,
      output_format: options?.outputFormat || 'mp3',
    },
  };

  const response = await axios(requestOptions).catch((error: any) => {
    throw convertError(error);
  });
  const data = response.data;
  return {
    audioUrl: data.audio.url,
    generationId: response.headers['x-fal-request-id'],
  };
}
