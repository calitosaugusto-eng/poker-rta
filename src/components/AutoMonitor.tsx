'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface AutoMonitorProps {
  onDetect: (cards: {
    heroCards: string[];
    board: string[];
    potSize: number;
  }) => void;
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

export default function AutoMonitor({ onDetect }: AutoMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return checkScreenCaptureSupport().supported;
  });
  const [supportReason, setSupportReason] = useState(() => {
    if (typeof window === 'undefined') return 'Renderização no servidor';
    return checkScreenCaptureSupport().reason;
  });
  
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMonitoringRef = useRef<boolean>(false);
  
  const analyzeFrame = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;
    
    try {
      // Criar vídeo se não existir
      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      
      const video = videoRef.current;
      
      // Só configurar srcObject se mudou
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        await video.play();
      }
      
      // Aguardar frame estar pronto
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('Vídeo não está pronto');
        return;
      }
      
      // Criar canvas se não existir
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.6);
      
      // Enviar para análise
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      });
      
      const data = await response.json();
      
      if (data.success && data.gameState?.heroCards?.length >= 2) {
        onDetect({
          heroCards: data.gameState.heroCards,
          board: data.gameState.board || [],
          potSize: data.gameState.potSize || 0
        });
      }
      
      setFramesAnalyzed(prev => prev + 1);
      
    } catch (err) {
      console.error('Frame analysis error:', err);
    }
  }, [onDetect]);
  
  // Definir stopMonitoring primeiro para evitar referência antes de declaração
  const stopMonitoring = useCallback(() => {
    isMonitoringRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Limpar vídeo
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    
    setIsMonitoring(false);
  }, []);
  
  const startMonitoring = useCallback(async () => {
    setError(null);
    
    // Verificação dupla antes de tentar
    const { supported, reason } = checkScreenCaptureSupport();
    if (!supported) {
      setError(`Não suportado: ${reason}. Use Chrome/Edge em HTTPS.`);
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
      isMonitoringRef.current = true;
      setIsMonitoring(true);
      setFramesAnalyzed(0);
      
      // Loop de análise
      intervalRef.current = setInterval(analyzeFrame, 3000);
      
      // Primeira análise após 1 segundo
      setTimeout(analyzeFrame, 1000);
      
      // Parar quando stream terminar
      stream.getVideoTracks()[0].onended = () => {
        stopMonitoring();
      };
      
    } catch (err: any) {
      console.error('Screen capture error:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Permissão negada. Permita o compartilhamento de tela.');
      } else if (err.name === 'NotSupportedError') {
        setError('Screen capture não suportado neste navegador.');
      } else if (err.name === 'AbortError') {
        setError('Captura cancelada pelo usuário.');
      } else {
        setError(`Erro: ${err.message || 'Desconhecido'}`);
      }
    }
  }, [analyzeFrame, stopMonitoring]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Aviso de suporte */}
      {!isSupported && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-300">
            ⚠️ Screen Capture não disponível: {supportReason}
          </p>
          <p className="text-yellow-200 text-sm mt-2">
            Use Chrome, Edge ou Firefox com HTTPS.
          </p>
        </div>
      )}
      
      {/* Erros */}
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}
      
      <div className="flex gap-4">
        {!isMonitoring ? (
          <Button 
            onClick={startMonitoring}
            disabled={!isSupported}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-xl py-8 px-10 font-bold rounded-xl shadow-xl"
          >
            ▶️ Iniciar Monitoramento Automático
          </Button>
        ) : (
          <Button 
            onClick={stopMonitoring}
            variant="destructive"
            className="text-xl py-8 px-10 font-bold rounded-xl"
          >
            ⏹️ Parar Monitoramento
          </Button>
        )}
      </div>
      
      {isMonitoring && (
        <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-300 font-medium">Monitorando...</span>
            <span className="text-gray-400">{framesAnalyzed} frames analisados</span>
          </div>
        </div>
      )}
    </div>
  );
}
