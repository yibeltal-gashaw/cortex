import { useState, useEffect, useRef, useCallback } from 'react';
import { ParsedConversationSession } from '../types/index.js';

function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle dual-tone ascending chime
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn('Audio chime playback blocked or unavailable:', err);
  }
}

export function useDesktopNotifications(activeSession: ParsedConversationSession | null) {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('cortex_notifications_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('cortex_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const prevStepCountRef = useRef<number>(activeSession?.steps.length || 0);
  const prevSessionIdRef = useRef<string | null>(activeSession?.id || null);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        setEnabled(true);
        localStorage.setItem('cortex_notifications_enabled', 'true');
        return true;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
    return false;
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cortex_notifications_enabled', String(next));
      if (next && permission !== 'granted') {
        requestPermission();
      }
      return next;
    });
  }, [permission, requestPermission]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cortex_sound_enabled', String(next));
      if (next) playCompletionChime();
      return next;
    });
  }, []);

  // Watch for session completion events
  useEffect(() => {
    if (!activeSession) return;

    // Reset when switching to a different session
    if (prevSessionIdRef.current !== activeSession.id) {
      prevSessionIdRef.current = activeSession.id;
      prevStepCountRef.current = activeSession.steps.length;
      return;
    }

    const currentCount = activeSession.steps.length;
    const prevCount = prevStepCountRef.current;

    // Detect if new steps arrived and the last step represents a completed turn or assistant summary
    if (currentCount > prevCount) {
      const lastStep = activeSession.steps[currentCount - 1];
      const isCompleted =
        (lastStep.type === 'PLANNER_RESPONSE' && (!!lastStep.assistantResponse || (lastStep.toolCalls && lastStep.toolCalls.length > 0))) ||
        lastStep.status === 'DONE';

      // If document is backgrounded or hidden and notifications are enabled
      if (isCompleted && enabled) {
        const isHidden = typeof document !== 'undefined' ? document.hidden : false;

        if (soundEnabled) {
          playCompletionChime();
        }

        if (isHidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const promptText = activeSession.steps[0]?.userPrompt?.requestText || 'Agent task';
          const notification = new Notification('Cortex: Agent Task Finished', {
            body: `"${promptText.slice(0, 60)}..." completed in ${activeSession.durationFormatted}.`,
            icon: '/favicon.ico',
            tag: `cortex-task-${activeSession.id}`
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      }
    }

    prevStepCountRef.current = currentCount;
  }, [activeSession, enabled, soundEnabled]);

  return {
    permission,
    enabled,
    soundEnabled,
    requestPermission,
    toggleEnabled,
    toggleSound,
    testChime: playCompletionChime
  };
}

