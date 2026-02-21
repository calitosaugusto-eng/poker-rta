/**
 * Auto Screen Monitor for Poker RTA
 * Monitora a tela continuamente e detecta cartas automaticamente
 */

import { useRef, useCallback, useEffect, useState } from 'react';

export interface AutoMonitorConfig {
  intervalMs: number;
  onDetect: (cards: {
    heroCards: string[];
    board: string[];
    potSize: number;
    imageData: string;
  }) => void;
  onChange: (state: MonitorState) => void;
}

export interface MonitorState {
  isMonitoring: boolean;
  lastCapture: Date | null;
  framesAnalyzed: number;
  cardsDetected: boolean;
  lastCards: string[];
}

export function useAutoMonitor(config: AutoMonitorConfig) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameRef = useRef<string>('');
  const lastCardsRef = useRef<string>('');
  const framesAnalyzedRef = useRef<number>(0);
  
  // Usar refs para callbacks para evitar re-renders
  const onDetectRef = useRef(config.onDetect);
  const onChangeRef = useRef(config.onChange);
  const intervalMsRef = useRef(config.intervalMs);
  
  // Atualizar refs quando config mudar
  useEffect(() => {
    onDetectRef.current = config.onDetect;
    onChangeRef.current = config.onChange;
    intervalMsRef.current = config.intervalMs;
  }, [config]);
  
  const [state, setState] = useState<MonitorState>({
    isMonitoring: false,
    lastCapture: null,
    framesAnalyzed: 0,
    cardsDetected: false,
    lastCards: []
  });

  // Capturar frame atual
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('⚠️ Video ou Canvas não disponível');
      return null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('⚠️ Video dimensions: ', video.videoWidth, 'x', video.videoHeight);
      return null;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  // Analisar frame para detectar cartas
  const analyzeFrame = useCallback(async (imageData: string) => {
    try {
      console.log('🔍 Analisando frame...');
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      console.log('📊 Resultado:', data.success, data.gameState?.heroCards);
      
      if (data.success && data.gameState?.heroCards?.length >= 2) {
        const newCards = data.gameState.heroCards.join(',') + '|' + data.gameState.board.join(',');
        
        // Só notificar se as cartas mudaram
        if (newCards !== lastCardsRef.current) {
          lastCardsRef.current = newCards;
          
          setState(prev => ({
            ...prev,
            cardsDetected: true,
            lastCards: data.gameState.heroCards
          }));
          
          onDetectRef.current({
            heroCards: data.gameState.heroCards,
            board: data.gameState.board || [],
            potSize: data.gameState.potSize || 0,
            imageData
          });
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Frame analysis error:', error);
      return false;
    }
  }, []);

  // Loop de monitoramento - sem dependências problemáticas
  const monitorLoop = useCallback(async () => {
    const frame = captureFrame();
    
    if (!frame) return;
    
    framesAnalyzedRef.current += 1;
    
    setState(prev => ({
      ...prev,
      framesAnalyzed: framesAnalyzedRef.current,
      lastCapture: new Date()
    }));
    
    onChangeRef.current({
      isMonitoring: true,
      lastCapture: new Date(),
      framesAnalyzed: framesAnalyzedRef.current,
      cardsDetected: state.cardsDetected,
      lastCards: state.lastCards
    });
    
    // Sempre analisar (removido hasSignificantChange que estava causando problemas)
    console.log('🔄 Analisando frame...', framesAnalyzedRef.current);
    await analyzeFrame(frame);
  }, [captureFrame, analyzeFrame, state]);

  // Parar monitoramento
  const stopMonitoring = useCallback(() => {
    console.log('⏹️ Parando monitoramento...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    videoRef.current = null;
    canvasRef.current = null;
    lastFrameRef.current = '';
    lastCardsRef.current = '';
    framesAnalyzedRef.current = 0;
    
    setState({
      isMonitoring: false,
      lastCapture: null,
      framesAnalyzed: 0,
      cardsDetected: false,
      lastCards: []
    });
    
    onChangeRef.current({
      isMonitoring: false,
      lastCapture: null,
      framesAnalyzed: 0,
      cardsDetected: false,
      lastCards: []
    });
  }, []);

  // Iniciar monitoramento
  const startMonitoring = useCallback(async () => {
    console.log('▶️ Iniciando monitoramento...');
    
    try {
      // Solicitar acesso à tela
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } as any,
        audio: false
      });
      
      console.log('✅ Stream obtido:', stream.getTracks()[0].label);
      streamRef.current = stream;
      
      // Criar elementos de vídeo e canvas
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      
      // Aguardar vídeo estar pronto
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          console.log('📹 Metadata carregada');
          video.play().then(() => {
            console.log('📹 Video playing');
            resolve();
          }).catch(err => {
            console.error('❌ Error playing video:', err);
            resolve();
          });
        };
        video.onerror = (e) => {
          console.error('❌ Video error:', e);
          resolve();
        };
      });
      
      // Configurar estado
      setState({
        isMonitoring: true,
        lastCapture: null,
        framesAnalyzed: 0,
        cardsDetected: false,
        lastCards: []
      });
      
      onChangeRef.current({
        isMonitoring: true,
        lastCapture: null,
        framesAnalyzed: 0,
        cardsDetected: false,
        lastCards: []
      });
      
      // Iniciar loop de captura
      const interval = intervalMsRef.current;
      console.log('⏱️ Iniciando loop com intervalo de', interval, 'ms');
      
      intervalRef.current = setInterval(() => {
        monitorLoop();
      }, interval);
      
      // Captura inicial após 1 segundo
      setTimeout(() => {
        console.log('🚀 Captura inicial...');
        monitorLoop();
      }, 1000);
      
      // Handler para quando o usuário para de compartilhar
      stream.getVideoTracks()[0].onended = () => {
        console.log('🛑 Stream encerrado pelo usuário');
        stopMonitoring();
      };
      
    } catch (error: any) {
      console.error('❌ Error starting monitor:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      setState({
        isMonitoring: false,
        lastCapture: null,
        framesAnalyzed: 0,
        cardsDetected: false,
        lastCards: []
      });
    }
  }, [monitorLoop, stopMonitoring]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    state,
    startMonitoring,
    stopMonitoring,
    captureFrame
  };
}
