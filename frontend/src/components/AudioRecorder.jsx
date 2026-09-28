import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Play, Pause, AlertCircle, Circle } from 'lucide-react';

export const AudioRecorder = ({ onRecordingComplete, onRecordingReset, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());

        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, recordingSeconds);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access error:', err);
      setError('Microphone access was denied. Please allow microphone permission or upload an audio file.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingSeconds(0);
    setIsRecording(false);
    setIsPlaying(false);
    setError(null);
    if (onRecordingReset) {
      onRecordingReset();
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className={`voice-record-card ${isRecording ? 'recording' : ''}`} style={{ textAlign: 'center', padding: '1.25rem' }}>
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            width: '100%',
            marginBottom: '0.75rem',
            textAlign: 'left',
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* STATE A: ACTIVE RECORDING */}
      {isRecording ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 700, fontSize: '0.9375rem' }}>
            <span className="record-pulsing-dot" />
            <span>🔴 Recording</span>
          </div>

          <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-main)', fontFamily: 'monospace' }}>
            {formatTimer(recordingSeconds)}
          </div>

          <button
            type="button"
            className="btn btn-danger"
            onClick={stopRecording}
            style={{ minWidth: 160, padding: '0.625rem 1.25rem' }}
          >
            <Square size={16} fill="currentColor" />
            <span>Stop Recording</span>
          </button>
        </div>
      ) : audioUrl ? (
        /* STATE B: RECORDING FINISHED / PREVIEW */
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.875rem' }}>
            <span>Voice Note Ready ({formatTimer(recordingSeconds)})</span>
          </div>

          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            style={{ width: '100%', maxHeight: 38 }}
            controls
          />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetRecording}
              disabled={disabled}
            >
              <Trash2 size={14} color="var(--danger)" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : (
        /* STATE C: IDLE / READY TO RECORD */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.25rem',
            }}
          >
            <Mic size={26} />
          </div>

          <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-main)', fontFamily: 'monospace' }}>
            00:00
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={startRecording}
            disabled={disabled}
            style={{ minWidth: 160, padding: '0.625rem 1.25rem', marginTop: '0.25rem' }}
          >
            <Mic size={16} />
            <span>Start Recording</span>
          </button>
        </div>
      )}
    </div>
  );
};
