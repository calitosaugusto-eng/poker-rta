/**
 * Auto Screen Monitor for Poker RTA
 * Com verificação de compatibilidade
 */

import { useRef, useEffect, useState } from 'react';

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

// Verificar se a API está disponível
const isScreenCaptureSupported = () => {
  return typeof navigator !== 'undefined' && 
         navigator.mediaDevices && 
         typeof navigator.mediaDevices.getDisplayMedia === 'function';
};

export function useAutoMonitor(config: AutoMonitorConfig) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCardsRef = useRef<string>('');
  const framesCountRef = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const configRef = useRef(config);
  
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  
  const [state, setState] = useState<MonitorState>({
    isMonitoring: false,
    lastCapture: null,
    framesAnalyzed: 0,
    cardsDetected: false,
    lastCards: []
  });

  const updateState = (updates: Partial<MonitorState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const analyzeFrame = async (imageData: string) => {
    try {
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      
      if (data.success && data.gameState?.heroCards?.length >= 2) {
        const newCards = data.gameState.heroCards.join(',') + '|' + (data.gameState.board || []).join(',');
        
        if (newCards !== lastCardsRef.current) {
          lastCardsRef.current = newCards;
          
          updateState({
            cardsDetected: true,
            lastCards: data.gameState.heroCards
          });
          
          configRef.current.onDetect({
            heroCards: data.gameState.heroCards,
            board: data.gameState.board || [],
            potSize: data.gameState.potSize || 0,
            imageData
          });
        }
      }
    } catch (error) {
      console.error('Frame analysis error:', error);
    }
  };

  const runMonitorLoop = () => {
    if (!videoRef.current || !canvasRef.current || !isMonitoringRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.6);
    
    framesCountRef.current += 1;
    
    updateState({
      framesAnalyzed: framesCountRef.current,
      lastCapture: new Date()
    });
    
    configRef.current.onChange({
      isMonitoring: true,
      lastCapture: new Date(),
      framesAnalyzed: framesCountRef.current,
      cardsDetected: state.cardsDetected,
      lastCards: state.lastCards
    });
    
    analyzeFrame(imageData);
  };

  const stopMonitoring = () => {
    console.log('⏹️ Parando monitoramento...');
    
    isMonitoringRef.current = false;
    
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
    lastCardsRef.current = '';
    framesCountRef.current = 0;
    
    const finalState: MonitorState = {
      isMonitoring: false,
      lastCapture: null,
      framesAnalyzed: 0,
      cardsDetected: false,
      lastCards: []
    };
    
    updateState(finalState);
    configRef.current.onChange(finalState);
  };

  const startMonitoring = async () => {
    console.log('▶️ Iniciando monitoramento...');
    
    // Verificar suporte
    if (!isScreenCaptureSupported()) {
      const errorMsg = 'Seu navegador não suporta captura de tela. Use Chrome, Edge ou Firefox atualizado em HTTPS.';
      console.error('❌', errorMsg);
      alert(errorMsg);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      console.log('✅ Stream obtido com sucesso');
      streamRef.current = stream;
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      await video.play();
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      
      isMonitoringRef.current = true;
      framesCountRef.current = 0;
      
      const initialState: MonitorState = {
        isMonitoring: true,
        lastCapture: null,
        framesAnalyzed: 0,
        cardsDetected: false,
        lastCards: []
      };
      
      updateState(initialState);
      configRef.current.onChange(initialState);
      
      intervalRef.current = setInterval(runMonitorLoop, configRef.current.intervalMs);
      
      setTimeout(runMonitorLoop, 1000);
      
      stream.getVideoTracks()[0].onended = () => {
        console.log('🛑 Stream encerrado pelo usuário');
        stopMonitoring();
      };
      
      console.log('✅ Monitoramento iniciado com sucesso');
      
    } catch (error: any) {
      console.error('❌ Erro ao iniciar monitoramento:', error.message);
      alert('Erro ao iniciar monitoramento: ' + error.message);
      isMonitoringRef.current = false;
      updateState({ isMonitoring: false });
    }
  };

  useEffect(() => {
    return () => {
      isMonitoringRef.current = false;
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
    isSupported: isScreenCaptureSupported()
  };
}
