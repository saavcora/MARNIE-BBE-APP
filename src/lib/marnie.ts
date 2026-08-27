export interface Interest {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export const INTERESTS = [
  { id: "espacio", label: "Espacio", color: "#4FB8E8", bg: "#EAF6FC" },
  { id: "animales", label: "Animales", color: "#7FB069", bg: "#EFF6E9" },
  { id: "arte", label: "Arte", color: "#FF6F59", bg: "#FFEDEA" },
  { id: "musica", label: "Música", color: "#B98CE0", bg: "#F3EAFB" },
  { id: "deportes", label: "Deportes", color: "#FFC857", bg: "#FFF6E2" },
] as const;

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  espacio: ["espacio", "planeta", "estrella", "luna", "sol", "galaxia", "saturno", "marte", "universo", "cohete", "astronauta", "tierra", "orbita"],
  animales: ["animal", "perro", "gato", "pulpo", "leon", "elefante", "pez", "ave", "insecto", "vaca", "caballo", "ballena", "conejo", "serpiente"],
  arte: ["arte", "color", "pintar", "dibujar", "pintura", "mezclar", "cuadro", "museo", "escultura", "pincel"],
  musica: ["musica", "cancion", "instrumento", "nota", "ritmo", "guitarra", "piano", "violin", "tambor", "orquesta"],
  deportes: ["deporte", "futbol", "baloncesto", "partido", "correr", "saltar", "natacion", "tenis", "equipo", "pelota", "gol", "marcador"],
};

export function detectTopic(question: string): string | null {
  const lower = question.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return topic;
    }
  }
  return null;
}

export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface MarnieSettings {
  daily_limit: number;
  allowed_topics: Record<string, boolean>;
  strict_filter: boolean;
  blocked_words: string[];
}

export const DEFAULT_SETTINGS: MarnieSettings = {
  daily_limit: 45,
  allowed_topics: Object.fromEntries(INTERESTS.map((i) => [i.id, true])),
  strict_filter: true,
  blocked_words: ["miedo", "susto"],
};
