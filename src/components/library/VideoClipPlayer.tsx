// src/components/library/VideoClipPlayer.tsx
// Sequential player for 3 video clips (playlist)

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface VideoClipPlayerProps {
  clips: Array<{
    clipIndex: number;
    clipUrl?: string;
    status: string;
  }>;
  className?: string;
}

export function VideoClipPlayer({ clips, className }: VideoClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [totalDuration] = useState(clips.length * 8); // 8s per clip

  // Get available clips (with URLs)
  const availableClips = clips.filter(c => c.clipUrl && c.status === "done");
  const currentClip = availableClips[currentClipIndex];

  // Update progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const clipOffset = currentClipIndex * 8;
      const currentTime = video.currentTime + clipOffset;
      setProgress((currentTime / totalDuration) * 100);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [currentClipIndex, totalDuration]);

  // Handle clip end -> next clip
  const handleClipEnded = useCallback(() => {
    if (currentClipIndex < availableClips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // All clips played
      setIsPlaying(false);
      setCurrentClipIndex(0);
      setProgress(0);
    }
  }, [currentClipIndex, availableClips.length]);

  // Auto-play next clip
  useEffect(() => {
    const video = videoRef.current;
    if (video && currentClip?.clipUrl && isPlaying) {
      video.src = currentClip.clipUrl;
      video.muted = isMuted;
      video.play().catch(console.error);
    }
  }, [currentClipIndex, currentClip?.clipUrl, isPlaying, isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !currentClip?.clipUrl) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    setCurrentClipIndex(0);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // No clips available
  if (availableClips.length === 0) {
    return (
      <div className={cn(
        "bg-muted rounded-lg flex items-center justify-center aspect-[9/16]",
        className
      )}>
        <div className="text-center text-muted-foreground p-4">
          <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Clips en cours de génération...</p>
          <p className="text-xs mt-1">{clips.filter(c => c.status === "done").length}/{clips.length} prêts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-black", className)}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full aspect-[9/16] object-cover"
        src={currentClip?.clipUrl}
        muted={isMuted}
        playsInline
        onEnded={handleClipEnded}
        onClick={togglePlay}
      />

      {/* Clip indicator */}
      <div className="absolute top-2 left-2 flex gap-1">
        {clips.map((clip, idx) => (
          <div
            key={clip.clipIndex}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              idx < availableClips.length
                ? idx === currentClipIndex
                  ? "bg-primary"
                  : "bg-white/70"
                : "bg-white/30"
            )}
          />
        ))}
      </div>

      {/* Clip number */}
      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        Clip {currentClipIndex + 1}/{availableClips.length}
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        {/* Progress bar */}
        <Progress value={progress} className="h-1 mb-2" />

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={restart}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <span className="text-white text-xs ml-auto">
            {Math.round(progress * totalDuration / 100)}s / {totalDuration}s
          </span>
        </div>
      </div>
    </div>
  );
}
