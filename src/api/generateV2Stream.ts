import type { APISettingsInput } from '../index';
import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { V2ApiOptions } from './apiCommon';
import APISettingsStore from './APISettingsStore';

export default async function generateV2Stream(
  text: string,
  voice: string,
  outputStream: NodeJS.WritableStream,
  options?: V2ApiOptions,
): Promise<void> {
  const { apiKey, userId } = APISettingsStore.getSettings();
  const streamOptions: AxiosRequestConfig = {
    method: 'POST',
    url: 'https://play.ht/api/v2/tts/stream',
    headers: {
      accept: 'audio/mpeg',
      'content-type': 'application/json',
      AUTHORIZATION: apiKey,
      'X-USER-ID': userId,
    },
    responseType: 'stream',
    data: {
      text,
      voice,
      quality: options?.quality || 'medium',
      output_format: options?.outputFormat || 'mp3',
      speed: options?.speed || 1,
      sample_rate: options?.sampleRate || 24000,
      seed: options?.seed,
      temperature: options?.temperature,
    },
  };

  const response = await axios(streamOptions).catch((error: any) => {
    throw new Error(error);
  });

  response.data.pipe(outputStream);
}
