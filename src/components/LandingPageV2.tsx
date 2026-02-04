'use client';

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import Image from 'next/image';
import Typewriter from './ui/Typewriter';
import VerticalCarouselText from './ui/VerticalCarouselText';
import { SplitText } from './ui';
import { useSoundManager } from '@/hooks/useSoundManager';
import { getSoundManager } from '@/lib/soundManager';

// 무거운 컴포넌트들을 동적 import로 지연 로드
const BlobBackgroundV2 = lazy(() => import('./ui/BlobBackgroundV2'));
const ThinkingBlob = lazy(() => import('./ui/ThinkingBlob'));

interface LandingPageV2Props {
  onComplete: (selectedOption: string) => void;
  showBlob?: boolean;
  onSelectOption?: (selectedOption: string) => void;
}

const BUTTON_OPTIONS = [
  '연인과 둘이',
  '친구랑 같이',
  '가족과 함께',
  '혼자서 자유롭게',
];

const BUTTON_IMAGE_SRCS = [
  '/landing_btn_images/01.png',
  '/landing_btn_images/02.png',
  '/landing_btn_images/03.png',
  '/landing_btn_images/04.png',
];

export default function LandingPageV2({ onComplete, showBlob = true, onSelectOption }: LandingPageV2Props) {
  const [showSori, setShowSori] = useState(false);
  const [moveToBottom, setMoveToBottom] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [isOpeningVideoEnabled, setIsOpeningVideoEnabled] = useState(true);
  const [showBlobBackground, setShowBlobBackground] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);
  const [titleOpacity, setTitleOpacity] = useState(1);
  const [showIntroCard, setShowIntroCard] = useState(false);
  const [introCardOpacity, setIntroCardOpacity] = useState(0);
  const [showNewText, setShowNewText] = useState(false);
  const [newTextOpacity, setNewTextOpacity] = useState(0);
  const [showButtons, setShowButtons] = useState(false);
  const [buttonOpacity, setButtonOpacity] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showThinkingBlob, setShowThinkingBlob] = useState(false);
  const [thinkingOpacity, setThinkingOpacity] = useState(0);
  const [showSelectedMessage, setShowSelectedMessage] = useState(false);
  const [blobAnimating, setBlobAnimating] = useState(false);
  const [questionTextOpacity, setQuestionTextOpacity] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const optionAudioRef = useRef<HTMLAudioElement | null>(null);
  const arriveTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const thinkingFadeTimerRef = useRef<number | null>(null);
  const introCardTimerRef = useRef<number | null>(null);
  const introCardCleanupTimerRef = useRef<number | null>(null);
  // 사전 로드 제거: 필요할 때만 로드 (지연 로드)
  const { playSound } = useSoundManager();

  // v2: 'Sori at COEX' 애니메이션 후 이동 처리
  useEffect(() => {
    if (!showSori) {
      return;
    }

    // 'Sori at COEX'는 12글자, stagger 180ms
    // 텍스트가 충분히 표시된 후 (약 1.5초) 하단으로 이동
    const moveTimer = window.setTimeout(() => {
      setMoveToBottom(true);
    }, 1500);

    return () => {
      window.clearTimeout(moveTimer);
    };
  }, [showSori]);

  // opening 비디오 토글 상태 로드/저장 (새로고침 유지)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('coex_opening_video_enabled');
      if (raw === null) return;
      setIsOpeningVideoEnabled(raw === 'true');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('coex_opening_video_enabled', String(isOpeningVideoEnabled));
    } catch {
      // ignore
    }
  }, [isOpeningVideoEnabled]);

  // 토글 OFF: 비디오 즉시 중단/숨김. 토글 ON: 비디오를 처음부터 다시 재생.
  useEffect(() => {
    const video = videoRef.current;
    if (!isOpeningVideoEnabled) {
      if (video) {
        try {
          video.pause();
          video.currentTime = 0;
        } catch {
          // ignore
        }
      }
      setShowVideo(false);
      setVideoOpacity(0);
      setShowBlobBackground(true);
      return;
    }

    // ON이면 (다시 보고 싶을 수 있으니) 항상 초기화해서 재생 시도
    setShowVideo(true);
    setVideoOpacity(1);
    if (video) {
      try {
        video.currentTime = 0;
        video.play().catch(() => {
          // autoplay 정책 등으로 실패해도 무시
        });
      } catch {
        // ignore
      }
    }
  }, [isOpeningVideoEnabled]);

  // moveToBottom이 true가 된 후 1초 뒤에 title fade-out 시작
  useEffect(() => {
    if (!moveToBottom) {
      return;
    }

    const fadeOutTimer = window.setTimeout(() => {
      setTitleOpacity(0);
    }, 2000);

    return () => {
      window.clearTimeout(fadeOutTimer);
    };
  }, [moveToBottom]);

  // title fade-out 완료 후 (0.5초 transition) 새 텍스트 표시 및 fade-in
  useEffect(() => {
    if (titleOpacity === 0) {
      // 1) 안내 카드(glass morphism) 등장
      const showIntroTimer = window.setTimeout(() => {
        setShowIntroCard(true);
        setIntroCardOpacity(0);
        window.requestAnimationFrame(() => setIntroCardOpacity(1));
      }, 500); // fade-out transition 완료 대기

      // 2) 안내 카드가 충분히 보인 뒤(2초) 카드 fade-out + 질문/버튼 동시에 fade-in
      // fade-in(0.8s) 이후 2초 유지 → 총 2.8s 뒤 전환 시작
      if (introCardTimerRef.current) window.clearTimeout(introCardTimerRef.current);
      introCardTimerRef.current = window.setTimeout(() => {
        setIntroCardOpacity(0);

        // 질문 텍스트 + 버튼을 동시에 표시/페이드인
        setShowNewText(true);
        setShowButtons(true);
        setNewTextOpacity(0);
        setButtonOpacity(0);
        window.setTimeout(() => {
          setNewTextOpacity(1);
          setButtonOpacity(1);
        }, 50);

        // 카드 DOM 정리 (fade-out 완료 후)
        if (introCardCleanupTimerRef.current) window.clearTimeout(introCardCleanupTimerRef.current);
        introCardCleanupTimerRef.current = window.setTimeout(() => {
          setShowIntroCard(false);
        }, 900);
      }, 500 + 800 + 2000);

      return () => {
        window.clearTimeout(showIntroTimer);
        if (introCardTimerRef.current) {
          window.clearTimeout(introCardTimerRef.current);
          introCardTimerRef.current = null;
        }
        if (introCardCleanupTimerRef.current) {
          window.clearTimeout(introCardCleanupTimerRef.current);
          introCardCleanupTimerRef.current = null;
        }
      };
    }
  }, [titleOpacity]);

  // 버튼 옵션과 wav 파일 매핑
  const getWavFileForOption = (option: string): string | null => {
    const mapping: Record<string, string> = {
      '가족과 함께': '1-1.wav',
      '연인과 둘이': '2-1.wav',
      '친구랑 같이': '3-1.wav',
      '혼자서 자유롭게': '4-1.wav',
    };
    return mapping[option] || null;
  };

  // wav 파일 재생 함수
  const playWavFile = useCallback((filename: string) => {
    const audio = new Audio(`/pre-recordings/${filename}`);
    audio.volume = 1.0;
    audio.play().catch((error) => {
      console.error('WAV 재생 실패:', error);
    });
    return audio;
  }, []);

  // blob transition이 끝난 뒤에 thinking + 메시지 노출 (원하는 순서)
  const handleBlobArrived = useCallback(() => {
    setShowThinkingBlob(true);
    // fade-in
    window.requestAnimationFrame(() => setThinkingOpacity(1));
    setShowSelectedMessage(true);
  }, []);

  const finishToMainWhenReady = useCallback((option: string) => {
    const finish = () => {
      setIsTransitioning(true);
      onComplete(option);
    };

    const audio = optionAudioRef.current;
    if (!audio || audio.ended || audio.paused) {
      finish();
      return;
    }

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      audio.removeEventListener('ended', onEnded);
      window.clearTimeout(safetyTimer);
    };
    const onEnded = () => {
      cleanup();
      finish();
    };
    audio.addEventListener('ended', onEnded, { once: true });

    // 안전장치: 너무 오래 끌지 않도록
    const safetyTimer = window.setTimeout(() => {
      cleanup();
      try {
        audio.pause();
      } catch {}
      finish();
    }, 6000);
  }, [onComplete]);

  // 버튼 선택 시 처리
  const handleButtonClick = useCallback((option: string) => {
    if (selectedOption) return;

    // 3. 버튼 클릭 시 클릭 사운드 재생
    playSound('CLICK_1', {
      onError: () => {
        // 재생 실패해도 조용히 처리
      },
    }).catch(() => {
      // 재생 실패해도 조용히 처리
    });
    
    setSelectedOption(option);
    // crossfade 준비: thinking을 먼저 깔아두고(투명), blob이 올라오는 동안 서서히 등장시키기
    setShowThinkingBlob(true);
    setThinkingOpacity(0);
    setShowSelectedMessage(false);
    setBlobAnimating(true);
    // 기존 텍스트 fade-out
    setQuestionTextOpacity(0);
    onSelectOption?.(option);

    // blob이 올라오는 동안 thinking을 부드럽게 페이드인 (끊김 방지)
    // BlobBackground: transitioning 2000ms + settle 900ms + callback 200ms ≈ 3100ms
    if (thinkingFadeTimerRef.current) window.clearTimeout(thinkingFadeTimerRef.current);
    thinkingFadeTimerRef.current = window.setTimeout(() => {
      setThinkingOpacity(1);
    }, 2400);

    // 문구는 blob이 위에서 "정착"한 직후에 등장
    if (arriveTimerRef.current) window.clearTimeout(arriveTimerRef.current);
    arriveTimerRef.current = window.setTimeout(() => {
      handleBlobArrived();
    }, 3100);

    // 메시지 노출(도착) 이후 충분히 보여준 뒤 메인으로 전환
    // 3100ms(도착) + 1500ms(문구 애니 완료) + 3500ms(여유) ≈ 8100ms
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current);
    }
    completeTimerRef.current = window.setTimeout(() => {
      finishToMainWhenReady(option);
    }, 8100);
    
    // 선택된 옵션에 해당하는 wav 파일 재생 (0.8초 지연)
    const wavFile = getWavFileForOption(option);
    if (wavFile) {
      setTimeout(() => {
        optionAudioRef.current = playWavFile(wavFile);
      }, 800);
    }
  }, [finishToMainWhenReady, handleBlobArrived, onSelectOption, playSound, playWavFile, selectedOption]);

  useEffect(() => {
    return () => {
      if (arriveTimerRef.current) {
        window.clearTimeout(arriveTimerRef.current);
        arriveTimerRef.current = null;
      }
      if (thinkingFadeTimerRef.current) {
        window.clearTimeout(thinkingFadeTimerRef.current);
        thinkingFadeTimerRef.current = null;
      }
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
      if (introCardTimerRef.current) {
        window.clearTimeout(introCardTimerRef.current);
        introCardTimerRef.current = null;
      }
      if (introCardCleanupTimerRef.current) {
        window.clearTimeout(introCardCleanupTimerRef.current);
        introCardCleanupTimerRef.current = null;
      }
    };
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.style.width = '100%';
      videoRef.current.style.height = '100%';
      setShowBlobBackground(true);
    }
  }, []);


  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      
      if (duration && !isNaN(duration)) {
        const fadeStartTime = 3.5;
        const fadeEndTime = duration;
        
        if (currentTime >= fadeStartTime) {
          const fadeDuration = fadeEndTime - fadeStartTime;
          const progress = Math.min((currentTime - fadeStartTime) / fadeDuration, 1);
          const opacity = 1 - progress;
          setVideoOpacity(opacity);
        } else {
          setVideoOpacity(1);
        }
      }
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setShowVideo(false);
    setVideoOpacity(0);
  }, []);

  return (
    <div 
      className="h-screen flex flex-col safe-area-inset overscroll-none relative overflow-hidden bg-transparent"
      style={{ position: 'relative', pointerEvents: isTransitioning ? 'none' : 'auto' }}
    >
      {/* 우측 상단: opening 비디오 토글 */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 90,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          aria-pressed={isOpeningVideoEnabled}
          onClick={() => setIsOpeningVideoEnabled((v) => !v)}
          className="touch-manipulation"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.55)',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.38) 45%, rgba(255, 255, 255, 0.16) 100%)',
            boxShadow: '0 10px 22px rgba(36, 82, 94, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px) saturate(1.35)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.35)',
            color: '#000',
            fontFamily: 'Pretendard Variable',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '-0.24px',
          }}
        >
          <span style={{ opacity: 0.8, whiteSpace: 'nowrap' }}>오프닝</span>
          <span
            aria-hidden="true"
            style={{
              width: '34px',
              height: '18px',
              borderRadius: '999px',
              background: isOpeningVideoEnabled ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.25)',
              position: 'relative',
              transition: 'background 160ms ease',
              flex: '0 0 auto',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: isOpeningVideoEnabled ? '18px' : '2px',
                width: '14px',
                height: '14px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                transition: 'left 160ms ease',
              }}
            />
          </span>
        </button>
      </div>
      {/* ThinkingBlob - 선택 후에만 표시 */}
      {showThinkingBlob && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 55,
            opacity: thinkingOpacity,
            transition: 'opacity 600ms ease-in-out',
            pointerEvents: 'none',
          }}
        >
          <Suspense fallback={null}>
            <ThinkingBlob isActive={true} />
          </Suspense>
        </div>
      )}
      {/* 초기 비디오 재생 */}
      {isOpeningVideoEnabled && showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            zIndex: 50,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            minWidth: '100%',
            minHeight: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            willChange: 'transform, opacity',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            opacity: videoOpacity,
            transition: 'opacity 0.1s linear',
          }}
          preload="auto"
          autoPlay
          muted
          playsInline
          onLoadedMetadata={handleVideoLoadedMetadata}
          onTimeUpdate={handleVideoTimeUpdate}
          onEnded={handleVideoEnded}
        >
          <source src="/260120_opening_v3.mp4" type="video/mp4" />
        </video>
      )}
      
      {showBlob && showBlobBackground && (
        <Suspense fallback={null}>
          <BlobBackgroundV2
            isAnimating={blobAnimating}
            onAnimationComplete={handleBlobArrived}
          />
        </Suspense>
      )}

      <div 
        className="relative flex-1 flex flex-col justify-start px-6 transition-all duration-[3000ms] ease-in-out"
        style={{
          zIndex: 60,
          paddingTop: moveToBottom ? '20px' : 'clamp(120px, 20vh, 180px)',
          paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px) + 60px)',
          transform: moveToBottom ? 'translateY(calc(100vh - 260px - env(safe-area-inset-bottom, 0px) - 60px))' : 'translateY(0)',
        }}
      >
        {/* 타이틀 영역 컨테이너 (기존 타이틀과 새 텍스트가 같은 위치에 나타남) */}
        <div 
          className="text-left"
          style={{
            position: 'relative',
            minHeight: showSori ? 'auto' : '60px',
          }}
        >
          {/* 기존 타이틀 텍스트 (Welcome To, Sori at COEX) */}
          <div 
            style={{
              opacity: titleOpacity,
              transition: 'opacity 0.5s ease-in-out',
            }}
          >
            <div className="text-gray-800 mb-[12px]" style={{ fontFamily: 'Pretendard Variable', fontWeight: 600, lineHeight: '90%', letterSpacing: '-0.44px', fontSize: '22px' }}>
              <Typewriter
                text="Welcome To"
                speed={80}
                delay={0}
                onIndexReach={(index) => {
                  if (index === 7 && !showSori) {
                    setShowSori(true);
                  }
                }}
                onComplete={() => {}}
              />
            </div>
            
            {showSori && (
              <div className="landing-title-v2" style={{ fontFamily: 'Pretendard Variable', fontWeight: 400, lineHeight: '90%', letterSpacing: '-1.8px', fontSize: '40.5pt', marginBottom: '16px' }}>
                <div
                  className="v2-title-container"
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    // 너무 타이트하면 글자 하단이 잘릴 수 있어 여유를 둠
                    lineHeight: '1.05em',
                  }}
                >
                  <div style={{ height: '1.05em', overflow: 'visible', lineHeight: '1.05em', display: 'inline-flex', alignItems: 'flex-end' }}>
                    <VerticalCarouselText
                      text="Sori"
                      duration={4500}
                      stagger={180}
                      enableColorAnimation={true}
                      characterClassName="vertical-carousel-v2-char"
                      className="vertical-carousel-v2"
                      style={{ 
                        fontFamily: 'Pretendard Variable', 
                        fontWeight: 400, 
                        lineHeight: '90%', 
                        letterSpacing: '-1.8px', 
                        fontSize: '40.5pt'
                      }}
                    />
                    <VerticalCarouselText
                      text="at"
                      duration={4500}
                      stagger={180}
                      enableColorAnimation={false}
                      characterClassName="vertical-carousel-v2-char"
                      className="vertical-carousel-v2"
                      style={{ 
                        fontFamily: 'Pretendard Variable', 
                        fontWeight: 400, 
                        lineHeight: '90%', 
                        letterSpacing: '-1.8px', 
                        fontSize: '40.5pt',
                        color: '#000000'
                      }}
                    />
                  </div>
                  <div style={{ height: '1.05em', overflow: 'visible', lineHeight: '1.05em', display: 'inline-flex', alignItems: 'flex-end' }}>
                    <VerticalCarouselText
                      text="Gangnam"
                      duration={4500}
                      stagger={180}
                      enableColorAnimation={false}
                      characterClassName="vertical-carousel-v2-char"
                      className="vertical-carousel-v2"
                      style={{ 
                        fontFamily: 'Pretendard Variable', 
                        fontWeight: 400, 
                        lineHeight: '90%', 
                        letterSpacing: '-1.8px', 
                        fontSize: '40.5pt',
                        color: '#000000'
                      }}
                    />
                  </div>
                  <div style={{ height: '1.05em', overflow: 'visible', lineHeight: '1.05em', display: 'inline-flex', alignItems: 'flex-end' }}>
                    <VerticalCarouselText
                      text="Eyes"
                      duration={4500}
                      stagger={180}
                      enableColorAnimation={false}
                      characterClassName="vertical-carousel-v2-char"
                      className="vertical-carousel-v2"
                      style={{ 
                        fontFamily: 'Pretendard Variable', 
                        fontWeight: 400, 
                        lineHeight: '90%', 
                        letterSpacing: '-1.8px', 
                        fontSize: '40.5pt',
                        color: '#000000'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 새 텍스트 (안녕하세요, 이솔입니다. / 오늘 누구와 코엑스에 방문하셨나요?) - 기존 타이틀과 같은 위치 */}
          {showNewText && !selectedOption && (
            <div 
              className="text-left"
              style={{
                position: 'absolute',
                top: 24,
                left: 0,
                right: 0,
                opacity: newTextOpacity * questionTextOpacity,
                transition: 'opacity 0.5s ease-in-out',
                color: 'black',
                fontSize: '24px',
                fontFamily: 'Pretendard Variable',
                fontWeight: 400,
                textTransform: 'capitalize',
                lineHeight: '140%',
                wordWrap: 'break-word',
                letterSpacing: '-0.96px',
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                오늘은 누구와 강남아이즈에<br />방문하셨나요?
              </div>
            </div>
          )}

          {/* 선택 후 텍스트 (blob→thinking 전환 이후에만 표시) */}
          {selectedOption && showSelectedMessage && (
            <div 
              className="text-left"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                opacity: 1,
                color: 'black',
                fontSize: '24px',
                fontFamily: 'Pretendard Variable',
                fontWeight: 400,
                textTransform: 'capitalize',
                lineHeight: '140%',
                wordWrap: 'break-word',
                letterSpacing: '-0.96px',
                whiteSpace: 'pre-line',
              }}
            >
              <SplitText 
                text={`${selectedOption} 방문하셨군요.\n맞춤형 안내를 생성할게요.`} 
                delay={0} 
                duration={0.8} 
                stagger={0.05} 
                animation="fadeIn" 
              />
            </div>
          )}

          {/* 타이틀 이후 안내 카드 (glass morphism) */}
          {showIntroCard && !selectedOption && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-150%',
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: 'min(500px, 92vw)',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                opacity: introCardOpacity,
                transition: 'opacity 0.8s ease-in-out',
                pointerEvents: 'none',
                zIndex: 70,
              }}
            >
              {/* 버튼 그리드와 동일한 크기를 만들기 위한 invisible placeholders */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '30px',
                    visibility: 'hidden',
                  }}
                />
              ))}

              {/* 실제 glass 카드 레이어 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '30px',
                  background:
                    'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 30%, rgba(255, 255, 255, 0.78) 90%), linear-gradient(135deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.28) 55%, rgba(255, 255, 255, 0.14) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                  boxShadow:
                    '0 18px 36px rgba(36, 82, 94, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.86)',
                  backdropFilter: 'blur(22px) saturate(1.35)',
                  WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  color: '#000',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Pretendard Variable',
                    fontWeight: 400,
                    lineHeight: '150%',
                    letterSpacing: '-0.6px',
                    fontSize: '18px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {'강남구 무역센터 옥외광고 거리의 새 이름\nGANGNAM EYES\n\n대한민국 최초의 디지털 사이니지 거리\n강남아이즈에 오신 걸 환영합니다'}
                </div>
              </div>
            </div>
          )}

          {/* 버튼 영역 (텍스트보다 30px 위에 배치) */}
          {showButtons && !selectedOption && (
            <div
              style={{
                position: 'absolute',
                // NOTE: top 퍼센트는 "부모(타이틀 영역) 높이" 기준이라,
                // 타이틀 줄 수 변화로 버튼 위치가 크게 흔들릴 수 있음.
                // (Gangnam/Eyes를 2줄로 고정하면서 부모 높이가 커져 기존 -200%가 과하게 적용됨)
                top: '-150%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                maxWidth: 'min(500px, 92vw)',
                width: '100%',
                opacity: buttonOpacity,
                transition: 'opacity 0.8s ease-in-out',
                zIndex: 70,
              }}
            >
              {BUTTON_OPTIONS.map((option, idx) => (
                <button
                  key={option}
                  onClick={() => handleButtonClick(option)}
                  aria-label={option}
                  className="touch-manipulation active:scale-95"
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    borderRadius: '30px',
                    background:
                      // 아래로 갈수록 white가 진해지는 레이어 + 기존 글래스 그라디언트
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 30%, rgba(255, 255, 255, 0.8) 90%), linear-gradient(135deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.28) 55%, rgba(255, 255, 255, 0.14) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                    boxShadow:
                      '0 18px 36px rgba(36, 82, 94, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.86)',
                    backdropFilter: 'blur(22px) saturate(1.35)',
                    WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
                    color: '#000',
                    cursor: 'pointer',
                    transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
                    textAlign: 'center',
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow =
                      '0 24px 46px rgba(36, 82, 94, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.92)';
                    e.currentTarget.style.background =
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 0%, rgba(255, 255, 255, 0.62) 100%), linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.34) 55%, rgba(255, 255, 255, 0.18) 100%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow =
                      '0 18px 36px rgba(36, 82, 94, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.86)';
                    e.currentTarget.style.background =
                      'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 0%, rgba(255, 255, 255, 0.55) 100%), linear-gradient(135deg, rgba(255, 255, 255, 0.62) 0%, rgba(255, 255, 255, 0.28) 55%, rgba(255, 255, 255, 0.14) 100%)';
                  }}
                >
                  {/* 1:1 이미지 div */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '10px',
                      borderRadius: '26px',
                      background: 'rgba(255, 255, 255, 0.30)',
                      border: '1px solid rgba(255, 255, 255, 0.40)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
                      zIndex: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      src={BUTTON_IMAGE_SRCS[idx] ?? BUTTON_IMAGE_SRCS[0]}
                      alt={option}
                      fill
                      sizes="(max-width: 640px) 44vw, 220px"
                      style={{ objectFit: 'contain' }}
                      priority={idx === 0}
                    />
                    {/* 상단은 선명, 하단은 뿌옇게: white 0% -> white 100% */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 37.89%, #FFF 100%)',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>

                  {/* 버튼 텍스트 (이미지/그라디언트에 영향 없이 상단 레이어) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '14px',
                      zIndex: 2,
                      color: '#000',
                      textAlign: 'center',
                      fontFamily: 'Pretendard Variable',
                      fontSize: '15px',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      lineHeight: '142%',
                      letterSpacing: '-0.75px',
                      pointerEvents: 'none',
                    }}
                  >
                    {option}
                  </div>
                </button>
              ))}
          </div>
        )}
        </div>
      </div>

      <style jsx>{`
        /* 320px 이하 디바이스에서 제목 텍스트 크기 조정 */
        @media (max-width: 320px) {
          .landing-title-v2 {
            font-size: 28pt !important;
          }
          .landing-title-v2 :global(.vertical-carousel-v2) {
            font-size: 28pt !important;
          }
        }
        .vertical-carousel-v2 :global(.vertical-carousel-v2-char:not(:last-child)) {
          margin-right: -1.8px;
        }
        .v2-title-container :global(.vertical-carousel-v2:not(:last-child)) {
          margin-right: 0.2em;
        }
      `}</style>
    </div>
  );
}

