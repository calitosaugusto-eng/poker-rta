/**
 * Auto Screen Monitor for Poker RTA
 */
import { useRef, useEffect, useState, useCallback } from 'react';

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

// Helper para verificar suporte a Screen Capture API
function checkScreenCaptureSupport(): { supported: boolean; reason: string } {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Renderização no servidor' };
  }
  
  if (!window.navigator) {
    return { supported: false, reason: 'Navigator não disponível' };
  }
  
  if (!window.navigator.mediaDevices) {
    return { supported: false, reason: 'mediaDevices não disponível - use HTTPS' };
  }
  
  if (typeof window.navigator.mediaDevices.getDisplayMedia !== 'function') {
    return { supported: false, reason: 'getDisplayMedia não suportado neste navegador' };
  }
  
  return { supported: true, reason: '' };
}

export function useAutoMonitor(config: AutoMonitorConfig) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCardsRef = useRef<string>('');
  const framesCountRef = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const configRef = useRef(config);
  
  const [state, setState] = useState<MonitorState>({
    isMonitoring: false,
    lastCapture: null,
    framesAnalyzed: 0,
    cardsDetected: false,
    lastCards: []
  });
  
  // Usar initial state ao invés de useEffect
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return checkScreenCaptureSupport().supported;
  });
  
  const [supportReason, setSupportReason] = useState(() => {
    if (typeof window === 'undefined') return 'Renderização no servidor';
    return checkScreenCaptureSupport().reason;
  });
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const analyzeFrame = useCallback(async (imageData: string) => {
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
          setState(prev => ({ ...prev, cardsDetected: true, lastCards: data.gameState.heroCards }));
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
  }, []);

  const runMonitorLoop = useCallback(() => {
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
    setState(prev => ({ ...prev, framesAnalyzed: framesCountRef.current, lastCapture: new Date() }));
    
    analyzeFrame(imageData);
  }, [analyzeFrame]);

  const stopMonitoring = useCallback(() => {
    isMonitoringRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    
    videoRef.current = null;
    canvasRef.current = null;
    streamRef.current = null;
    intervalRef.current = null;
    lastCardsRef.current = '';
    framesCountRef.current = 0;
    
    setState({ isMonitoring: false, lastCapture: null, framesAnalyzed: 0, cardsDetected: false, lastCards: [] });
  }, []);

  const startMonitoring = useCallback(async () => {
    setError(null);
    
    // Verificação de suporte
    const { supported, reason } = checkScreenCaptureSupport();
    if (!supported) {
      setError(`Não suportado: ${reason}`);
      return;
    }
    
    try {
      // Chamar a API com o contexto correto
      const getDisplayMedia = window.navigator.mediaDevices.getDisplayMedia.bind(
        window.navigator.mediaDevices
      );
      
      const stream = await getDisplayMedia({ 
        video: { displaySurface: 'monitor' } as any, 
        audio: false 
      });
      
      streamRef.current = stream;
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      
      videoRef.current = video;
      canvasRef.current = document.createElement('canvas');
      
      isMonitoringRef.current = true;
      framesCountRef.current = 0;
      
      setState({ isMonitoring: true, lastCapture: null, framesAnalyzed: 0, cardsDetected: false, lastCards: [] });
      
      intervalRef.current = setInterval(runMonitorLoop, configRef.current.intervalMs);
      setTimeout(runMonitorLoop, 1000);
      
      stream.getVideoTracks()[0].onended = stopMonitoring;
      
    } catch (error: any) {
      console.error('Screen capture error:', error);
      
      if (error.name === 'NotAllowedError') {
        setError('Permissão negada. Permita o compartilhamento de tela.');
      } else if (error.name === 'NotSupportedError') {
        setError('Screen capture não suportado.');
      } else if (error.name === 'AbortError') {
        setError('Captura cancelada.');
      } else {
        setError('Erro: ' + error.message);
      }
    }
  }, [runMonitorLoop, stopMonitoring]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);

  return { 
    state, 
    startMonitoring, 
    stopMonitoring, 
    isSupported, 
    supportReason, 
    error 
  };
}
