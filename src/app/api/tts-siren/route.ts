import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getEnv } from '@/lib/utils';

type DetectedAudioFormat = 'wav' | 'mp3' | 'ogg' | 'unknown';

function detectAudioFormat(u8: Uint8Array): { format: DetectedAudioFormat; wavSampleRate?: number; wavChannels?: number; wavBitsPerSample?: number } {
  const startsWith = (s: string) => {
    if (u8.length < s.length) return false;
    for (let i = 0; i < s.length; i++) {
      if (u8[i] !== s.charCodeAt(i)) return false;
    }
    return true;
  };

  // WAV: "RIFF" .... "WAVE"
  if (u8.length >= 12 && startsWith('RIFF') && String.fromCharCode(...u8.slice(8, 12)) === 'WAVE') {
    // sampleRate at byte 24-27 (little-endian) for PCM header
    if (u8.length >= 36) {
      const sampleRate = (u8[24] | (u8[25] << 8) | (u8[26] << 16) | (u8[27] << 24)) >>> 0;
      const channels = (u8[22] | (u8[23] << 8)) >>> 0;
      const bitsPerSample = (u8[34] | (u8[35] << 8)) >>> 0;
      return { format: 'wav', wavSampleRate: sampleRate, wavChannels: channels, wavBitsPerSample: bitsPerSample };
    }
    return { format: 'wav' };
  }

  // MP3: "ID3" or frame sync 0xFFE?
  if (u8.length >= 3 && startsWith('ID3')) return { format: 'mp3' };
  if (u8.length >= 2 && u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return { format: 'mp3' };

  // OGG: "OggS"
  if (u8.length >= 4 && startsWith('OggS')) return { format: 'ogg' };

  return { format: 'unknown' };
}

// Siren TTS API 설정 
// NOTE:
// - 현재 기본값은 stage 엔드포인트(public-stage-siren-gw)로 유지하되,
//   운영/스테이징 전환이 가능하도록 env로 오버라이드할 수 있게 함.
const SIREN_GW_BASE_URL = getEnv('SIREN_GW_BASE_URL', 'https://public-siren-gw.io.naver.com');
const SIREN_GW_PATH = getEnv('SIREN_GW_PATH', '/tts/makeTTS');
const X_NAVER_SVCID = getEnv('SIREN_X_NAVER_SVCID', 'coex');
const X_CONSUMER_ID = getEnv('SIREN_X_CONSUMER_ID', 'siren-gw.coex');
// TODO(security): 가능하면 하드코딩 값을 제거하고 배포 환경변수로만 주입하세요.
const HMAC_KEY = getEnv('SIREN_HMAC_KEY', 'OZKCBgilLC0dXQcbtXfWdQnEvkh3BrgUO2pEMq2sBCQrePSQWRE3AhbgrldHBdbl');
const DEFAULT_SPEAKER = getEnv('SIREN_DEFAULT_SPEAKER', 'xsori');

/**
 * HMAC SHA1 생성 함수
 * @param secretKey HMAC 키
 * @param data 서명할 데이터
 * @returns Base64로 인코딩된 HMAC 값
 */
function generateHmac(secretKey: string, data: string): string {
  const hmac = createHmac('sha1', secretKey);
  hmac.update(data);
  return hmac.digest('base64');
}

/**
 * Siren TTS API 인증 헤더 생성
 * @returns 인증 헤더 객체
 */
function generateAuthHeaders(): Record<string, string> {
  const msgpad = Date.now().toString();
  const hmacUrl = SIREN_GW_BASE_URL + SIREN_GW_PATH;
  // hmacUrl을 최대 255자로 제한
  const hmacUrlLimited = hmacUrl.substring(0, 255);
  const dataToSign = hmacUrlLimited + msgpad;
  const md = generateHmac(HMAC_KEY, dataToSign);

  // 디버깅 로그 (민감정보 노출 방지: HMAC/서명 값은 출력하지 않음)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Siren TTS] Auth Debug:', {
      hmacUrl,
      hmacUrlLimited,
      msgpad,
      dataToSignLength: dataToSign.length,
      hmacKeyLength: HMAC_KEY.length,
    });
  }

  // PDF의 curl 예제를 보면 x-naver-svcid를 사용하지만, 표에서는 x-naversvcid로 되어 있음
  // curl 예제를 따라 x-naver-svcid 사용
  return {
    'x-naver-svcid': X_NAVER_SVCID,
    'x-consumer-id': X_CONSUMER_ID,
    'x-hmac-msgpad': msgpad,
    'x-hmac-md': `v0:${md}`,
  };
}

/**
 * Siren TTS API 호출
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      speaker = DEFAULT_SPEAKER,
      speed = 0,
      volume = 0,
      alpha = 0,
      format = 'mp3',
      samplingRate,
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'text parameter is required' },
        { status: 400 }
      );
    }

    // 인증 헤더 생성
    const authHeaders = generateAuthHeaders();
    
    // 디버깅: 헤더 확인
    console.log('Auth Headers:', authHeaders);

    const apiUrl = `${SIREN_GW_BASE_URL}${SIREN_GW_PATH}`;

    const callSiren = async (samplingRateOverride?: number | null) => {
      // 요청 파라미터 구성
      const formData = new URLSearchParams();
      formData.append('speaker', speaker);
      formData.append('text', text);
      if (speed !== undefined) formData.append('speed', speed.toString());
      if (volume !== undefined) formData.append('volume', volume.toString());
      if (alpha !== undefined) formData.append('alpha', alpha.toString());
      if (format !== undefined) formData.append('format', format);

      // WAV일 때 샘플레이트 지정 (prod 기본값이 낮으면 음질 저하처럼 들릴 수 있음)
      const sr = samplingRateOverride ?? (typeof samplingRate === 'number' ? samplingRate : null);
      if (format === 'wav' && sr && Number.isFinite(sr)) {
        // CLOVA Voice 문서 기준 파라미터명과 동일하게 'sampling-rate' 사용
        formData.append('sampling-rate', Math.floor(sr).toString());
      }

      return fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...authHeaders,
        },
        body: formData,
      });
    };

    const requestStartTime = Date.now();
    console.log('[Siren TTS] API request started:', { 
      textLength: text.length,
      speaker,
      speed,
      volume,
      alpha,
      format,
      samplingRate,
      baseUrl: SIREN_GW_BASE_URL,
      path: SIREN_GW_PATH,
    });

    let response = await callSiren(null);
    
    const requestElapsedTime = Date.now() - requestStartTime;
    console.log('[Siren TTS] API response received:', { 
      status: response.status,
      elapsedTime: `${requestElapsedTime}ms`
    });

    if (!response.ok) {
      // 샘플레이트 파라미터로 인한 실패 가능성이 있어, WAV 요청일 때는 샘플레이트 없이 1회 재시도
      if (format === 'wav' && typeof samplingRate === 'number') {
        console.warn('[Siren TTS] non-ok response; retrying without sampling-rate');
        response = await callSiren(0);
      }

      if (response.ok) {
        // fallthrough
      } else {
      const errorText = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.error('Siren TTS API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        responseHeaders,
        requestHeaders: authHeaders,
      });
      return NextResponse.json(
        {
          error: `Siren TTS API failed: ${response.status} ${errorText}`,
        },
        { status: response.status }
      );
      }
    }

    // 오디오 데이터를 Buffer로 변환
    const bufferStartTime = Date.now();
    const audioBuffer = await response.arrayBuffer();
    const bufferElapsedTime = Date.now() - bufferStartTime;
    const totalElapsedTime = Date.now() - requestStartTime;
    
    console.log('[Siren TTS] Audio buffer received:', {
      bufferSize: audioBuffer.byteLength,
      bufferTime: `${bufferElapsedTime}ms`,
      totalTime: `${totalElapsedTime}ms`
    });

    // Content-Type 결정 (format에 따라)
    const contentType =
      format === 'wav' ? 'audio/wav' : 'audio/mpeg';

    // 응답 헤더 설정
    const headers = new Headers();
    const upstreamContentType = response.headers.get('content-type');
    const detected = detectAudioFormat(new Uint8Array(audioBuffer));
    headers.set('Content-Type', upstreamContentType || contentType);
    headers.set('Content-Length', audioBuffer.byteLength.toString());
    headers.set('Cache-Control', 'no-cache');
    headers.set('X-Coex-Audio-Detected-Format', detected.format);
    if (detected.format === 'wav' && detected.wavSampleRate) {
      headers.set('X-Coex-Audio-Sample-Rate', detected.wavSampleRate.toString());
      if (detected.wavChannels) headers.set('X-Coex-Audio-Channels', detected.wavChannels.toString());
      if (detected.wavBitsPerSample) headers.set('X-Coex-Audio-Bits-Per-Sample', detected.wavBitsPerSample.toString());
    }
    if (upstreamContentType) headers.set('X-Coex-Upstream-Content-Type', upstreamContentType);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Siren TTS API error:', error);
    return NextResponse.json(
      {
        error: `TTS processing failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청으로 TTS 테스트
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const text =
    url.searchParams.get('text') || '안녕하세요! COEX 이벤트 안내 AI입니다.';

  try {
    const response = await POST(
      new NextRequest(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: `TTS test failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      },
      { status: 500 }
    );
  }
}
