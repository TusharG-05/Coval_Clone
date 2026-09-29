"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Agent, TestSet, Metric, MetricResult, Message } from "@/types";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  RotateCw, 
  Send,
  ShieldCheck,
  User,
  Bot
} from "lucide-react";
import Link from "next/link";

export default function LiveCallPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  // Setup state
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedTestSetId, setSelectedTestSetId] = useState("");
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);

  // Call state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "agent_speaking" | "user_listening" | "agent_thinking" | "ended">("idle");
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [interimSpeech, setInterimSpeech] = useState("");
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Post-call evaluation modal
  const [evalResults, setEvalResults] = useState<Record<string, MetricResult> | null>(null);
  const [finishedSimId, setFinishedSimId] = useState<string | null>(null);

  // Audio & Speech references
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimSpeech]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, tsRes, mRes] = await Promise.all([
          fetch("http://localhost:8000/api/agents"),
          fetch("http://localhost:8000/api/test-sets"),
          fetch("http://localhost:8000/api/metrics")
        ]);
        const aData: Agent[] = await aRes.json();
        const tsData: TestSet[] = await tsRes.json();
        const mData: Metric[] = await mRes.json();

        setAgents(aData);
        setTestSets(tsData);
        setMetrics(mData);

        if (aData.length > 0) setSelectedAgentId(aData[0].id);
        if (tsData.length > 0) setSelectedTestSetId(tsData[0].id);
        setSelectedMetricIds(mData.map(m => m.id));
      } catch (err) {
        console.error("Error loading call data:", err);
      }
    };
    fetchData();
  }, []);

  // Duration timer
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Play audio helper
  const playAgentAudio = useCallback((audioBase64: string, onEnd?: () => void) => {
    if (!audioBase64) {
      if (onEnd) onEnd();
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audioPlayerRef.current = audio;
    setCallStatus("agent_speaking");

    audio.onended = () => {
      setCallStatus("user_listening");
      if (onEnd) onEnd();
    };
    audio.onerror = () => {
      setCallStatus("user_listening");
      if (onEnd) onEnd();
    };

    audio.play().catch(e => {
      console.warn("Audio autoplay blocked or failed:", e);
      setCallStatus("user_listening");
      if (onEnd) onEnd();
    });
  }, []);

  // Speech Recognition Setup
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Browser does not support SpeechRecognition API. Fallback text input enabled.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimSpeech(interim);

        if (final.trim()) {
          setInterimSpeech("");
          handleSendUserMessage(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
      };

      recognition.onend = () => {
        // Restart recognition if call is still active and agent is not speaking
        if (isCalling && !isMuted) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or busy
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Speech recognition initialization notice:", err);
    }
  }, [isCalling, isMuted]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setInterimSpeech("");
  }, []);

  // 1. Start Call
  const handleStartCall = async () => {
    setIsCalling(true);
    setCallStatus("connecting");
    setTranscript([]);
    setEvalResults(null);
    setFinishedSimId(null);

    try {
      const res = await fetch("http://localhost:8000/api/live-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          test_set_id: selectedTestSetId,
          metric_ids: selectedMetricIds
        })
      });

      const data = await res.json();
      const initialGreeting: Message = {
        role: "agent",
        text: data.greeting_text,
        time: "00:00",
        latency_ms: 320
      };

      setTranscript([initialGreeting]);

      // Play agent greeting
      playAgentAudio(data.audio_base64, () => {
        startSpeechRecognition();
      });
    } catch (err) {
      console.error("Failed to start live call:", err);
      alert("Failed to connect to agent backend. Please check server.");
      setIsCalling(false);
      setCallStatus("idle");
    }
  };

  // 2. Handle User Message (from Mic or Text Input)
  const handleSendUserMessage = async (userText: string) => {
    if (!userText.trim() || !isCalling) return;

    // Temporarily stop recognition while agent thinks and speaks
    stopSpeechRecognition();
    setCallStatus("agent_thinking");

    const currentSeconds = callDuration;
    const userMsg: Message = {
      role: "persona",
      text: userText.trim(),
      time: formatTimer(currentSeconds)
    };

    const updatedTranscript = [...transcript, userMsg];
    setTranscript(updatedTranscript);
    setTextInput("");

    try {
      const res = await fetch("http://localhost:8000/api/live-call/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          transcript: updatedTranscript,
          user_text: userText.trim()
        })
      });

      const data = await res.json();
      const agentMsg: Message = {
        role: "agent",
        text: data.agent_reply,
        time: formatTimer(currentSeconds + 2),
        latency_ms: data.latency_ms
      };

      setTranscript(prev => [...prev, agentMsg]);

      // Play Agent spoken reply
      playAgentAudio(data.audio_base64, () => {
        // Resume listening after agent finishes speaking
        if (!isMuted) {
          startSpeechRecognition();
        }
      });
    } catch (err) {
      console.error("Error during call turn:", err);
      setCallStatus("user_listening");
      startSpeechRecognition();
    }
  };

  // 3. End Call & Trigger Live Evaluation
  const handleEndCall = async () => {
    stopSpeechRecognition();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    setIsCalling(false);
    setCallStatus("ended");

    if (transcript.length === 0) return;

    try {
      const res = await fetch("http://localhost:8000/api/live-call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          test_set_id: selectedTestSetId,
          metric_ids: selectedMetricIds,
          transcript: transcript
        })
      });

      const data = await res.json();
      setEvalResults(data.results);
      setFinishedSimId(data.simulation_id);
    } catch (err) {
      console.error("Failed to finish call evaluation:", err);
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedTestSet = testSets.find(t => t.id === selectedTestSetId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Live Voice Call
                <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Microphone Enabled
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Speak directly into your microphone like a real customer. Hear the AI agent talk back, then inspect instant evaluation scorecards.
              </p>
            </div>
          </div>
        </div>

        {isCalling && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
              CALL IN PROGRESS: {formatTimer(callDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Pre-Call Setup Cards */}
      {!isCalling && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Agent Picker */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-500" /> 1. Select Agent to Call
            </label>
            <select
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {(selectedAgent?.connection_config?.system_prompt as string) ? (selectedAgent?.connection_config?.system_prompt as string).slice(0, 110) + "..." : "Standard voice receptionist"}
            </p>
          </div>

          {/* Test Scenario Picker */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" /> 2. Evaluation Scenario
            </label>
            <select
              value={selectedTestSetId}
              onChange={e => setSelectedTestSetId(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {testSets.map(ts => (
                <option key={ts.id} value={ts.id}>{ts.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {selectedTestSet?.test_cases?.[0]?.scenario ? selectedTestSet.test_cases[0].scenario.slice(0, 110) + "..." : "Freeform conversation testing"}
            </p>
          </div>

          {/* Metrics to track */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> 3. Live Metrics ({selectedMetricIds.length})
              </label>
              <button
                type="button"
                onClick={() => setSelectedMetricIds(prev => prev.length === metrics.length ? [] : metrics.map(m => m.id))}
                className="text-xs text-emerald-600 hover:underline"
              >
                {selectedMetricIds.length === metrics.length ? "Deselect" : "Select All"}
              </button>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {metrics.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMetricIds.includes(m.id)}
                    onChange={() => {
                      setSelectedMetricIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]);
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Phone / Call Screen */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[520px]">
        {/* Call Banner */}
        <div className="p-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base">
              {selectedAgent?.name?.charAt(0) || "A"}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                {selectedAgent?.name || "Voice Agent"}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                {isCalling ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {callStatus === "connecting" && "Dialing..."}
                    {callStatus === "agent_speaking" && "Agent Speaking (Playing Audio)..."}
                    {callStatus === "agent_thinking" && "Agent Thinking..."}
                    {callStatus === "user_listening" && "Listening to Your Microphone..."}
                  </>
                ) : (
                  "Ready to connect"
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!isCalling ? (
              <button
                onClick={handleStartCall}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
              >
                <Phone className="w-4 h-4" /> Start Voice Call
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(prev => !prev)}
                  className={`p-2.5 rounded-xl border transition-colors ${isMuted ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'}`}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleEndCall}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-md shadow-red-600/20 transition-all hover:scale-[1.02]"
                >
                  <PhoneOff className="w-4 h-4" /> End Call & Evaluate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Audio Visualizer & Waveform Bar */}
        {isCalling && (
          <div className="py-3 px-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className={`w-4 h-4 ${callStatus === 'agent_speaking' ? 'text-blue-500 animate-bounce' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {callStatus === 'agent_speaking' ? 'Agent Voice Stream Active' : callStatus === 'user_listening' ? 'Microphone Active — Speak Now!' : 'Processing speech...'}
              </span>
            </div>

            {/* Audio Waveform simulation bars */}
            <div className="flex items-center gap-1">
              {[40, 75, 55, 90, 65, 80, 45, 95, 60, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${callStatus === 'agent_speaking' ? 'bg-blue-500' : callStatus === 'user_listening' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                  style={{
                    height: (callStatus === 'agent_speaking' || callStatus === 'user_listening') 
                      ? `${Math.max(8, (h * ((i % 3) + 1) * 0.35))}px` 
                      : '6px'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Live Transcript Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[460px]">
          {transcript.length === 0 && !isCalling && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-gray-400 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                <Mic className="w-8 h-8" />
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 text-base">Click "Start Voice Call" to Begin</p>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Once connected, your microphone will automatically listen as you speak. You can test job screening, hospital appointments, or any custom scenario in real time!
                </p>
              </div>
            </div>
          )}

          {transcript.map((msg, index) => {
            const isAgent = msg.role === "agent";
            return (
              <div
                key={index}
                className={`flex gap-3 max-w-[85%] ${isAgent ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isAgent ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {isAgent ? (selectedAgent?.name || "Agent") : "You (Real Caller)"}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" /> {msg.time || "00:00"}
                    </span>
                    {msg.latency_ms && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 rounded font-mono font-medium">
                        {msg.latency_ms}ms
                      </span>
                    )}
                  </div>

                  <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${isAgent ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm' : 'bg-emerald-600 text-white rounded-tr-sm shadow-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Interim speech recognition feedback */}
          {interimSpeech && (
            <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse animate-pulse">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">
                <Mic className="w-4 h-4" />
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl rounded-tr-sm text-sm italic">
                "{interimSpeech}..."
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Fallback Text Input (if mic permissions are blocked or user prefers typing) */}
        {isCalling && (
          <div className="p-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendUserMessage(textInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Speak into your microphone, or type a response here and press Enter..."
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition-colors"
                title="Send Speech"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Post-Call Evaluation Scorecard Modal / Card */}
      {evalResults && (
        <div className="bg-white dark:bg-gray-900 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Real-World Voice Call Evaluation
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Evaluated live by Groq LLM Judge based on your spoken dialogue with {selectedAgent?.name}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/review"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Inspect in Human Review <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Metric cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(evalResults).map((metric, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${metric.passed ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{metric.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${metric.passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                    {metric.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {metric.passed ? "PASS" : "FAIL"} ({Math.round(metric.score * 100)}%)
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {metric.reasoning}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
