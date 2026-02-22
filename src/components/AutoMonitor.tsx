'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface AutoMonitorProps {
  onDetect: (cards: {
    heroCards: string[];
    board: string[];
    potSize: number;
  }) => void;
}

export default function AutoMonitor({ onDetect }: AutoMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const analyzeFrame = async () => {
    if (!streamRef.current) return;
    
    const video = document.createElement('video');
    video.srcObject = streamRef.current;
    video.muted = true;
    
    try {
      await video.play();
      
      const canvas = document.createElement('canvas');
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
    } finally {
      video.pause();
      video.srcObject = null;
    }
  };
  
  const startMonitoring = async () => {
    setError(null);
    
    try {
      // @ts-ignore
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: false 
      });
      
      streamRef.current = stream;
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
      setError(err.message);
    }
  };
  
  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsMonitoring(false);
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);
  
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-4">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}
      
      <div className="flex gap-4">
        {!isMonitoring ? (
          <Button 
            onClick={startMonitoring}
            className="bg-green-600 hover:bg-green-500 text-xl py-8 px-10 font-bold rounded-xl shadow-xl"
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
