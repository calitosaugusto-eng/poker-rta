/**
 * Auto Screen Monitor for Poker RTA
 * Monitora a tela continuamente e detecta cartas automaticamente
 */

import { useRef, useCallback, useEffect, useState } from 'react';

export interface AutoMonitorConfig {
  intervalMs: number;        // Intervalo entre capturas (padrão: 2000ms)
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
  
  const [state, setState] = useState<MonitorState>({
    isMonitoring: false,
    lastCapture: null,
    framesAnalyzed: 0,
    cardsDetected: false,
    lastCards: []
  });

  // Capturar frame atual
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7); // JPEG para menor tamanho
  }, []);

  // Detectar se houve mudança significativa na tela
  const hasSignificantChange = useCallback((newFrame: string): boolean => {
    if (!lastFrameRef.current) {
      lastFrameRef.current = newFrame;
      return true;
    }
    
    // Comparação simples: se o tamanho mudou muito, houve mudança
    const sizeDiff = Math.abs(newFrame.length - lastFrameRef.current.length);
    const threshold = lastFrameRef.current.length * 0.05; // 5% de mudança
    
    if (sizeDiff > threshold) {
      lastFrameRef.current = newFrame;
      return true;
    }
    
    return false;
  }, []);

  // Analisar frame para detectar cartas
  const analyzeFrame = useCallback(async (imageData: string) => {
    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      
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
          
          config.onDetect({
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
      console.error('Frame analysis error:', error);
      return false;
    }
  }, [config]);

  // Loop de monitoramento
  const monitorLoop = useCallback(async () => {
    const frame = captureFrame();
    
    if (!frame) return;
    
    setState(prev => ({
      ...prev,
      framesAnalyzed: prev.framesAnalyzed + 1,
      lastCapture: new Date()
    }));
    
    config.onChange({
      isMonitoring: true,
      lastCapture: new Date(),
      framesAnalyzed: state.framesAnalyzed + 1,
      cardsDetected: state.cardsDetected,
      lastCards: state.lastCards
    });
    
    // Verificar se houve mudança
    if (hasSignificantChange(frame)) {
      console.log('🔄 Mudança detectada, analisando...');
      await analyzeFrame(frame);
    }
  }, [captureFrame, hasSignificantChange, analyzeFrame, config, state]);

  // Parar monitoramento (declarado antes de startMonitoring para evitar erro de referência)
  const stopMonitoring = useCallback(() => {
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
    
    setState(prev => ({
      ...prev,
      isMonitoring: false,
      cardsDetected: false
    }));
    
    config.onChange({
      isMonitoring: false,
      lastCapture: null,
      framesAnalyzed: 0,
      cardsDetected: false,
      lastCards: []
    });
  }, [config]);

  // Iniciar monitoramento
  const startMonitoring = useCallback(async () => {
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
      
      streamRef.current = stream;
      
      // Criar elementos de vídeo e canvas
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      
      // Configurar estado
      setState(prev => ({
        ...prev,
        isMonitoring: true,
        framesAnalyzed: 0,
        cardsDetected: false
      }));
      
      config.onChange({
        isMonitoring: true,
        lastCapture: null,
        framesAnalyzed: 0,
        cardsDetected: false,
        lastCards: []
      });
      
      // Aguardar vídeo estar pronto
      await new Promise(resolve => {
        video.onloadedmetadata = resolve;
      });
      
      // Iniciar loop de captura
      intervalRef.current = setInterval(monitorLoop, config.intervalMs);
      
      // Captura inicial
      setTimeout(() => monitorLoop(), 500);
      
      // Handler para quando o usuário para de compartilhar
      stream.getVideoTracks()[0].onended = () => {
        stopMonitoring();
      };
      
    } catch (error: any) {
      console.error('Error starting monitor:', error);
      setState(prev => ({ ...prev, isMonitoring: false }));
    }
  }, [config, monitorLoop, stopMonitoring]);

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
