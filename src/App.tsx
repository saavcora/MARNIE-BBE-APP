import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  INTERESTS,
  detectTopic,
  stripEmoji,
  DEFAULT_SETTINGS,
  type MarnieSettings,
} from "@/lib/marnie";
import {
  Rocket, PawPrint, Palette, Music, Dumbbell,
  Lock, ArrowLeft, Clock, ShieldCheck, ListChecks, Activity,
  Plus, X, Mic, Search, GraduationCap, Square,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  espacio: Rocket,
  animales: PawPrint,
  arte: Palette,
  musica: Music,
  deportes: Dumbbell,
};

type Mode = "kid" | "gate" | "parent";
type ChatStatus = "idle" | "listening" | "thinking" | "talking";

export default function BuddyApp() {
  const [mode, setMode] = useState<Mode>("kid");
  const [gateAnswer, setGateAnswer] = useState("");
  const [gateError, setGateError] = useState("");
  const [a] = useState(() => Math.floor(Math.random() * 5) + 3);
  const [b] = useState(() => Math.floor(Math.random() * 5) + 2);

  const [settings, setSettings] = useState<MarnieSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("marnie_settings")
        .select("daily_limit, allowed_topics, strict_filter, blocked_words")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("Settings load error:", error);
      } else if (data) {
        setSettings({
          daily_limit: data.daily_limit,
          allowed_topics: data.allowed_topics,
          strict_filter: data.strict_filter,
          blocked_words: data.blocked_words,
        });
      }
      setSettingsLoaded(true);
    })();
  }, []);

  function checkGate() {
    if (Number(gateAnswer) === a + b) {
      setGateError("");
      setGateAnswer("");
      setMode("parent");
    } else {
      setGateError("Esa no es la respuesta. Pregúntale a un adulto.");
    }
  }

  if (!settingsLoaded) {
    return (
      <div style={appShell(mode)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 780 }}>
          <p style={{ color: "#8a8a72", fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={appShell(mode)}>
      <style>{keyframes}</style>

      {mode === "kid" && (
        <KidView
          settings={settings}
          onOpenGate={() => setMode("gate")}
        />
      )}

      {mode === "gate" && (
        <GateView
          a={a} b={b} gateAnswer={gateAnswer} setGateAnswer={setGateAnswer}
          gateError={gateError} checkGate={checkGate}
          onCancel={() => { setGateError(""); setGateAnswer(""); setMode("kid"); }}
        />
      )}

      {mode === "parent" && (
        <ParentView
          settings={settings}
          setSettings={setSettings}
          onExit={() => setMode("kid")}
        />
      )}
    </div>
  );
}

function appShell(mode: Mode): React.CSSProperties {
  return {
    fontFamily: "'Inter', system-ui, sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    minHeight: 780,
    background: mode === "parent" ? "#F7F9FC" : "#FFF8E7",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(35,34,58,0.18)",
    position: "relative",
  };
}

/* ---------- KID VIEW ---------- */

function KidView({ settings, onOpenGate }: {
  settings: MarnieSettings;
  onOpenGate: () => void;
}) {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [bubble, setBubble] = useState("¡Hola! ¿Qué quieres aprender hoy?");
  const [transcript, setTranscript] = useState("");
  const [schoolAnswer, setSchoolAnswer] = useState("");
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolError, setSchoolError] = useState("");
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
      setBubble("¡Te escucho!");
      setTranscript("");
      setSchoolError("");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setTranscript(finalText || interimText);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setSchoolError("Necesito permiso para usar el micrófono.");
      } else {
        setSchoolError("No pude escuchar bien. Intenta hablar otra vez.");
      }
      setStatus("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startListening = useCallback(() => {
    if (status !== "idle") return;
    const recognition = recognitionRef.current;
    if (!recognition) {
      setSchoolError("Tu navegador no permite reconocimiento de voz. Prueba con Chrome.");
      return;
    }
    try { recognition.start(); } catch { /* already started */ }
  }, [status]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (transcript.trim()) {
      askMarnie(transcript);
    } else {
      setStatus("idle");
      setBubble("No te escuché bien. ¿Lo intentamos otra vez?");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  async function askMarnie(question: string) {
    const q = question.trim();
    if (!q) return;

    const lower = q.toLowerCase();
    if (settings.blocked_words.some((w) => lower.includes(w))) {
      setSchoolError("Ese tema está bloqueado. Pregúntale a un adulto.");
      setStatus("idle");
      return;
    }

    setSchoolLoading(true);
    setStatus("thinking");
    setBubble("Mmm... estoy pensando.");
    setSchoolError("");
    setSchoolAnswer("");

    const systemPrompt = `Eres Marnie, una perrita asistente de tareas escolares para niños de 4 a 12 años.
Reglas estrictas:
- SOLO respondes preguntas de tipo escolar o educativo: matemáticas, ciencias, historia, geografía, biografías de personajes históricos o científicos, lengua, o cultura general apta para niños.
- Si la pregunta no es escolar, o es sobre violencia, miedo, temas para adultos, o cualquiera de estos temas prohibidos por los padres [${settings.blocked_words.join(", ") || "ninguno"}], responde con amabilidad que solo puedes ayudar con temas de la escuela, sin dar ningún detalle del tema prohibido.
- Nivel de explicación: ${settings.strict_filter ? "muy simple, para niños de 4 a 8 años" : "simple, para niños de hasta 12 años"}.
- Responde siempre en español, en 2 a 4 oraciones cortas, con un tono cálido, alegre y sencillo, como una perrita amigable.
- No uses emojis ni iconos en el texto, solo palabras.
- Para operaciones matemáticas simples respóndelas directamente sin buscar en la web.
- Usa la búsqueda web solo cuando la pregunta necesite datos reales o verificables (personajes, fechas, hechos).
- Nunca incluyas enlaces.`;

    try {
      const baseUrl = import.meta.env.VITE_ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
      const model = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
      const customHeadersRaw = import.meta.env.VITE_ANTHROPIC_CUSTOM_HEADERS || "";
      const customHeaders: Record<string, string> = {};
      if (customHeadersRaw) {
        for (const pair of customHeadersRaw.split(",")) {
          const [k, ...v] = pair.split(":").map((s: string) => s.trim());
          if (k && v.length) customHeaders[k] = v.join(":").trim();
        }
      }

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...customHeaders,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: "user", content: q },
          ],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();
      const rawAnswer = (data.content || [])
        .map((item: { type: string; text?: string }) => (item.type === "text" ? item.text : ""))
        .filter(Boolean)
        .join(" ")
        .trim();

      const answer = stripEmoji(rawAnswer) || "No encontré una respuesta escolar para eso. ¿Probamos con otra pregunta?";

      setSchoolAnswer(answer);
      setBubble(answer);

      setHistory((prev) => [
        ...prev,
        { role: "user", content: q },
        { role: "assistant", content: answer },
      ].slice(-10));

      // Log activity to Supabase
      const topic = detectTopic(q);
      supabase
        .from("marnie_activity")
        .insert({ question: q, answer, topic })
        .then(({ error }) => {
          if (error) console.error("Activity log error:", error);
        });

      playMarnieVoice(answer);
    } catch (error) {
      console.error(error);
      setSchoolError("Marnie tuvo un pequeño problema. Intentemos otra vez.");
      setStatus("idle");
      setBubble("Ups, algo salió mal.");
    } finally {
      setSchoolLoading(false);
    }
  }

  function playMarnieVoice(text: string) {
    if (!("speechSynthesis" in window)) {
      setStatus("idle");
      return;
    }
    setStatus("talking");
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-MX";
    utter.pitch = 1.25;
    utter.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const niña =
      voices.find((v) => /es/i.test(v.lang) && /google/i.test(v.name)) ||
      voices.find((v) => /es/i.test(v.lang) && /(natural|online)/i.test(v.name)) ||
      voices.find((v) => /es/i.test(v.lang) && /(female|mujer|niñ|paulina|sabina|helena|lucia|monica)/i.test(v.name)) ||
      voices.find((v) => /es/i.test(v.lang));
    if (niña) utter.voice = niña;

    utter.onend = () => {
      setStatus("idle");
      setBubble("¿Qué más quieres aprender?");
    };
    utter.onerror = () => setStatus("idle");

    window.speechSynthesis.speak(utter);
  }

  const micDisabled = status === "thinking" || status === "talking";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 780 }}>
      <div style={{ padding: "20px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="fredoka" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#23223A" }}>
            Marnie
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#8a8a72" }}>Tu perrito curioso</p>
        </div>
        <button
          onClick={onOpenGate}
          aria-label="Modo padres"
          style={{ border: "none", background: "rgba(35,34,58,0.06)", width: 34, height: 34, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b6b80" }}
        >
          <Lock size={16} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 24px 0", flex: 1, justifyContent: "center" }}>
        <div style={bubbleStyle}>
          {bubble}
        </div>

        <ChihuahuaSVG status={status} />

        <button
          onClick={status === "listening" ? stopListening : startListening}
          disabled={micDisabled}
          aria-label={status === "listening" ? "Detener" : "Hablar con Marnie"}
          className={status === "listening" ? "listen-ring" : ""}
          style={{
            marginTop: 22,
            width: 68,
            height: 68,
            borderRadius: "50%",
            border: "none",
            background: micDisabled ? "#E4A431" : "#F4B740",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: micDisabled ? "default" : "pointer",
          }}
        >
          {status === "listening" ? <Square size={22} /> : <Mic size={26} />}
        </button>

        <p style={{ fontSize: 12, color: "#8a8a72", marginTop: 8 }}>
          {status === "idle" && "Toca el micrófono y habla con Marnie"}
          {status === "listening" && "¡Te estoy escuchando! Toca de nuevo para terminar"}
          {status === "thinking" && "Marnie está pensando..."}
          {status === "talking" && "Marnie está hablando..."}
        </p>

        {transcript && status !== "idle" && (
          <div style={{ width: "100%", maxWidth: 320, marginTop: 6, fontSize: 13, color: "#6b6b80", textAlign: "center" }}>
            <strong style={{ color: "#23223A" }}>Escuché: </strong>{transcript}
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 320, marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <GraduationCap size={15} color="#8a8a72" />
            <p className="fredoka" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#23223A" }}>
              Pregunta escolar
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={transcript}
              onChange={(e) => { setTranscript(e.target.value); setSchoolError(""); }}
              onKeyDown={(e) => e.key === "Enter" && askMarnie(transcript)}
              placeholder="¿Cuánto es 2 + 2? ¿Quién fue Aristóteles?"
              disabled={schoolLoading || status === "talking"}
              style={inputStyle}
            />
            <button
              onClick={() => askMarnie(transcript)}
              disabled={schoolLoading || status === "talking"}
              aria-label="Buscar"
              style={{ width: 42, height: 42, borderRadius: 12, border: "none", background: "#7FB069", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <Search size={17} />
            </button>
          </div>
          {schoolError && <p style={{ color: "#D14343", fontSize: 12, margin: "6px 0 0" }}>{schoolError}</p>}
          {schoolAnswer && (
            <div style={{ marginTop: 10, background: "#EFF6E9", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#23223A", lineHeight: 1.4 }}>
              {schoolAnswer}
            </div>
          )}
          <p style={{ fontSize: 11, color: "#8a8a72", marginTop: 6 }}>
            Marnie solo busca información de tareas y temas escolares.
          </p>
        </div>
      </div>
    </div>
  );
}

const bubbleStyle: React.CSSProperties = {
  minHeight: 56,
  maxWidth: 300,
  background: "#fff",
  borderRadius: 18,
  padding: "12px 16px",
  fontSize: 14,
  color: "#23223A",
  textAlign: "center",
  boxShadow: "0 4px 14px rgba(35,34,58,0.08)",
  marginBottom: 18,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid rgba(35,34,58,0.15)",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  background: "#fff",
};

/* ---------- CHIHUAHUA ---------- */

function ChihuahuaSVG({ status }: { status: ChatStatus }) {
  const talking = status === "talking";
  const listening = status === "listening" || status === "thinking";
  return (
    <svg
      viewBox="0 0 220 210"
      width="230"
      height="220"
      className={talking ? "dog-talk" : "dog-idle"}
      role="img"
      aria-label="Marnie el perrito"
    >
      <ellipse cx="110" cy="180" rx="46" ry="10" fill="#F4B740" opacity={0.18} />
      <path
        d="M 160 128 Q 190 110 188 80 Q 186 66 174 70 Q 180 92 158 118 Z"
        fill="#E8A947"
        className={talking ? "tail-talk" : "tail-idle"}
      />
      <ellipse cx="110" cy="150" rx="58" ry="46" fill="#F4B740" />
      <ellipse cx="110" cy="164" rx="34" ry="26" fill="#FFFDF6" />
      <ellipse cx="78" cy="196" rx="12" ry="8" fill="#F4B740" />
      <ellipse cx="142" cy="196" rx="12" ry="8" fill="#F4B740" />
      <circle cx="110" cy="82" r="50" fill="#F4B740" />
      <ellipse cx="110" cy="100" rx="26" ry="20" fill="#FFFDF6" />
      <g className={listening ? "ear-perk" : "ear-rest"} style={{ transformOrigin: "70px 55px" }}>
        <path d="M 62 50 Q 30 20 42 66 Q 55 74 70 62 Z" fill="#E8A947" />
        <path d="M 60 52 Q 42 34 48 60 Q 56 64 64 58 Z" fill="#F7C98A" />
      </g>
      <g className={listening ? "ear-perk" : "ear-rest"} style={{ transformOrigin: "150px 55px" }}>
        <path d="M 158 50 Q 190 20 178 66 Q 165 74 150 62 Z" fill="#E8A947" />
        <path d="M 160 52 Q 178 34 172 60 Q 164 64 156 58 Z" fill="#F7C98A" />
      </g>
      <g className="eye-blink">
        <circle cx="94" cy="80" r="7" fill="#2B2A2E" />
        <circle cx="96" cy="77" r="2" fill="#fff" />
      </g>
      <g className="eye-blink">
        <circle cx="126" cy="80" r="7" fill="#2B2A2E" />
        <circle cx="128" cy="77" r="2" fill="#fff" />
      </g>
      <ellipse cx="110" cy="98" rx="6" ry="4.5" fill="#2B2A2E" />
      <path
        d={talking ? "M 100 110 Q 110 122 120 110" : "M 100 108 Q 110 114 120 108"}
        stroke="#B5541A"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        className={talking ? "mouth-talk" : ""}
      />
      {talking && <ellipse cx="110" cy="113" rx="6" ry="4" fill="#F28FA0" />}
      <circle cx="80" cy="98" r="6" fill="#FFC9A8" opacity="0.55" />
      <circle cx="140" cy="98" r="6" fill="#FFC9A8" opacity="0.55" />
    </svg>
  );
}

/* ---------- GATE VIEW ---------- */

function GateView({ a, b, gateAnswer, setGateAnswer, gateError, checkGate, onCancel }: {
  a: number; b: number;
  gateAnswer: string; setGateAnswer: (v: string) => void;
  gateError: string; checkGate: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ height: 780, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#23223A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Lock size={24} color="#fff" />
      </div>
      <p className="fredoka" style={{ fontSize: 19, fontWeight: 600, color: "#23223A", margin: "0 0 6px" }}>
        Zona de adultos
      </p>
      <p style={{ fontSize: 13, color: "#6b6b80", margin: "0 0 24px", maxWidth: 260 }}>
        Resuelve esta cuenta para entrar al panel de padres.
      </p>
      <p className="fredoka" style={{ fontSize: 26, color: "#23223A", margin: "0 0 16px" }}>
        {a} + {b} = ?
      </p>
      <input
        value={gateAnswer}
        onChange={(e) => setGateAnswer(e.target.value)}
        type="number"
        style={{ width: 100, textAlign: "center", fontSize: 18, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(35,34,58,0.15)", marginBottom: 8, outline: "none" }}
      />
      {gateError && <p style={{ color: "#D14343", fontSize: 12, margin: "4px 0 0" }}>{gateError}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} style={{ border: "1px solid rgba(35,34,58,0.15)", background: "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 13, cursor: "pointer", color: "#23223A" }}>
          Cancelar
        </button>
        <button onClick={checkGate} style={{ border: "none", background: "#23223A", color: "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 13, cursor: "pointer" }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

/* ---------- PARENT VIEW ---------- */

function ParentView({ settings, setSettings, onExit }: {
  settings: MarnieSettings;
  setSettings: React.Dispatch<React.SetStateAction<MarnieSettings>>;
  onExit: () => void;
}) {
  const [newWord, setNewWord] = useState("");
  const [activity, setActivity] = useState<{
    id: string;
    question: string;
    topic: string | null;
    created_at: string;
  }[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("marnie_activity")
        .select("id, question, topic, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Activity load error:", error);
      } else if (data) {
        setActivity(data as any);
      }
      setActivityLoaded(true);
    })();
  }, []);

  function persistSettings(patch: Partial<MarnieSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    supabase
      .from("marnie_settings")
      .upsert({
        id: 1,
        daily_limit: next.daily_limit,
        allowed_topics: next.allowed_topics,
        strict_filter: next.strict_filter,
        blocked_words: next.blocked_words,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Settings save error:", error);
      });
  }

  function addBlockedWord() {
    const w = newWord.trim().toLowerCase();
    if (w && !settings.blocked_words.includes(w)) {
      persistSettings({ blocked_words: [...settings.blocked_words, w] });
    }
    setNewWord("");
  }

  return (
    <div style={{ height: 780, overflowY: "auto", padding: "20px 20px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={onExit} aria-label="Volver" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#23223A" }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#23223A" }}>Panel de padres</p>
          <p style={{ margin: 0, fontSize: 12, color: "#8a8a9c" }}>Controla lo que Marnie puede hacer</p>
        </div>
      </div>

      <Section icon={Clock} title="Tiempo de uso diario">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="range" min={15} max={120} step={15}
            value={settings.daily_limit}
            onChange={(e) => persistSettings({ daily_limit: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#23223A", minWidth: 60, textAlign: "right" }}>
            {settings.daily_limit} min
          </span>
        </div>
      </Section>

      <Section icon={ListChecks} title="Temas permitidos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INTERESTS.map((it) => {
            const Icon = ICON_MAP[it.id];
            const on = settings.allowed_topics[it.id] ?? true;
            return (
              <button
                key={it.id}
                onClick={() =>
                  persistSettings({
                    allowed_topics: { ...settings.allowed_topics, [it.id]: !on },
                  })
                }
                className="chip"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: on ? `1px solid ${it.color}` : "1px solid rgba(35,34,58,0.12)",
                  background: on ? it.bg : "#fff",
                  color: "#23223A", borderRadius: 10, padding: "8px 12px",
                  fontSize: 13, cursor: "pointer", opacity: on ? 1 : 0.5,
                }}
              >
                {Icon && <Icon size={14} color={it.color} />}
                {it.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Filtro de contenido">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#23223A" }}>
              {settings.strict_filter ? "Estricto" : "Moderado"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8a8a9c" }}>
              {settings.strict_filter
                ? "Solo respuestas revisadas para menores de 8 años"
                : "Respuestas adecuadas hasta 12 años"}
            </p>
          </div>
          <Toggle
            checked={settings.strict_filter}
            onChange={() => persistSettings({ strict_filter: !settings.strict_filter })}
          />
        </div>
      </Section>

      <Section title="Palabras bloqueadas">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {settings.blocked_words.map((w) => (
            <span key={w} style={{ display: "flex", alignItems: "center", gap: 4, background: "#FFEDEA", color: "#993C1D", borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>
              {w}
              <X
                size={12}
                style={{ cursor: "pointer" }}
                onClick={() => persistSettings({ blocked_words: settings.blocked_words.filter((x) => x !== w) })}
              />
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlockedWord()}
            placeholder="Agregar palabra o tema"
            style={{ flex: 1, border: "1px solid rgba(35,34,58,0.12)", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }}
          />
          <button onClick={addBlockedWord} style={{ border: "none", background: "#23223A", color: "#fff", borderRadius: 8, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Plus size={16} />
          </button>
        </div>
      </Section>

      <Section icon={Activity} title="Actividad reciente">
        {activityLoaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activity.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8a8a9c", margin: 0 }}>
                Aún no hay preguntas registradas.
              </p>
            ) : (
              activity.map((log) => {
                const it = INTERESTS.find((i) => i.id === log.topic);
                const Icon = log.topic ? ICON_MAP[log.topic] : null;
                return (
                  <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: it?.bg ?? "#F0F0F5",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {Icon && <Icon size={14} color={it!.color} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#23223A" }}>{log.question}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#8a8a9c" }}>
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#8a8a9c", margin: 0 }}>Cargando actividad...</p>
        )}
      </Section>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoy, ${time}`;
  if (isYesterday) return `Ayer, ${time}`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) + `, ${time}`;
}

/* ---------- SHARED COMPONENTS ---------- */

function Section({ icon: Icon, title, children }: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(35,34,58,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {Icon && <Icon size={15} color="#6b6b80" />}
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#23223A" }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: 42, height: 24, borderRadius: 999, border: "none", background: checked ? "#23223A" : "rgba(35,34,58,0.15)", position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s ease" }} />
    </button>
  );
}

/* ---------- STYLES & ANIMATIONS ---------- */

const keyframes = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .fredoka { font-family: 'Fredoka', sans-serif; }
  .chip { transition: transform 0.15s ease; }
  .chip:active { transform: scale(0.96); }
  @keyframes breathe { 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.015); } }
  @keyframes bounce { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-10px); } }
  @keyframes wagSlow { 0%,100%{ transform: rotate(-10deg); } 50%{ transform: rotate(10deg); } }
  @keyframes wagFast { 0%,100%{ transform: rotate(-26deg); } 50%{ transform: rotate(26deg); } }
  @keyframes blink { 0%,94%,100%{ transform: scaleY(1); } 97%{ transform: scaleY(0.1); } }
  @keyframes mouthTalk { 0%,100%{ transform: scaleY(1); } 50%{ transform: scaleY(1.8); } }
  @keyframes ring { 0%{ box-shadow: 0 0 0 0 rgba(244,183,64,0.45); } 100%{ box-shadow: 0 0 0 26px rgba(244,183,64,0); } }
  .dog-idle { animation: breathe 3.4s ease-in-out infinite; }
  .dog-talk { animation: bounce 0.5s ease-in-out infinite; }
  .tail-idle { animation: wagSlow 1.6s ease-in-out infinite; transform-origin: 155px 130px; }
  .tail-talk { animation: wagFast 0.35s ease-in-out infinite; transform-origin: 155px 130px; }
  .ear-perk { transform: rotate(-12deg) translateY(-4px); transition: transform 0.25s ease; }
  .ear-rest { transform: rotate(0deg); transition: transform 0.25s ease; }
  .eye-blink { animation: blink 4.5s ease-in-out infinite; transform-origin: center; }
  .mouth-talk { animation: mouthTalk 0.4s ease-in-out infinite; transform-origin: center; }
  .listen-ring { animation: ring 1.2s ease-out infinite; }
`;
