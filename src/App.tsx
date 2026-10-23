import { useEffect, useRef, useState } from 'react';
import {
  AudioLines, BookOpen, CircleHelp, Globe2, Mic, MicOff, Settings2,
  Volume2, VolumeX, Search, ExternalLink, ShieldCheck, Accessibility, Languages
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import './styles.css';

type Language = 'te-IN' | 'en-IN';
type Result = { title: string; extract: string; url: string; source: string };
type Message = { id: number; role: 'assistant' | 'user'; text: string; result?: Result };

const welcome = 'నమస్కారం! నేను SAI Voice OS. మాట్లాడటానికి మైక్ బటన్ నొక్కండి. మీకు కావాల్సిన సమాచారం తెలుగులో చెబుతాను.';
const WELCOME_EN = 'Hello! I am SAI Voice OS. Press the microphone button and ask me anything. I will speak the answer aloud.';
const isNative = Capacitor.isNativePlatform();

function getRecognitionConstructor(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

function speakBrowser(text: string, lang: Language) {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

async function speak(text: string, lang: Language, enabled: boolean) {
  if (!enabled) return;
  try {
    if (isNative) {
      await TextToSpeech.speak({ text, lang, rate: 0.9, pitch: 1, volume: 1 });
      return;
    }
  } catch (error) {
    console.warn('Native speech unavailable; trying browser speech.', error);
  }
  await speakBrowser(text, lang);
}

async function searchWeb(query: string, lang: Language): Promise<Result[]> {
  const endpoint = new URL('https://en.wikipedia.org/w/api.php');
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('generator', 'search');
  endpoint.searchParams.set('gsrsearch', query);
  endpoint.searchParams.set('gsrlimit', '4');
  endpoint.searchParams.set('gsrnamespace', '0');
  endpoint.searchParams.set('prop', 'extracts|info');
  endpoint.searchParams.set('exintro', '1');
  endpoint.searchParams.set('explaintext', '1');
  endpoint.searchParams.set('exchars', '1100');
  endpoint.searchParams.set('inprop', 'url');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('origin', '*');
  const response = await fetch(endpoint.toString());
  if (!response.ok) throw new Error('Online search request failed');
  const json = await response.json();
  const pages = Object.values(json?.query?.pages || {}) as any[];
  return pages.map((page) => ({
    title: page.title || 'Untitled result',
    extract: page.extract || '',
    url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title || '').replaceAll(' ', '_'))}`,
    source: lang === 'te-IN' ? 'వికీపీడియా' : 'Wikipedia',
  })).filter((item) => item.extract.trim());
}

function helloText(lang: Language) {
  return lang === 'te-IN' ? welcome : WELCOME_EN;
}

function localIntent(query: string, lang: Language): string | null {
  const q = query.toLowerCase();
  const telugu = lang === 'te-IN';
  if (/\b(time|what time|current time)\b/.test(q) || /సమయం|టైమ్/.test(q)) {
    const now = new Date().toLocaleTimeString(lang === 'te-IN' ? 'te-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
    return telugu ? `ఇప్పుడు సమయం ${now}.` : `The current time is ${now}.`;
  }
  if (/\b(date|today's date|what day)\b/.test(q) || /తేదీ|ఈ రోజు ఏ రోజు/.test(q)) {
    const now = new Date().toLocaleDateString(lang === 'te-IN' ? 'te-IN' : 'en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return telugu ? `ఈ రోజు ${now}.` : `Today is ${now}.`;
  }
  if (/\b(stop|be quiet|stop speaking|silence)\b/.test(q) || /ఆపు|మాట్లాడకు/.test(q)) {
    window.speechSynthesis?.cancel();
    return telugu ? 'సరే, ఆపేశాను.' : 'Okay, I have stopped.';
  }
  if (/\b(help|what can you do|commands)\b/.test(q) || /సహాయం|ఏం చేయగలవు/.test(q)) {
    return telugu
      ? 'సమయం, తేదీ అడగండి. ఇంటర్నెట్‌లో విషయాలు వెతకమని చెప్పండి. వార్తలు లేదా ఒక విషయం గురించి అడగండి. Googleలో వెతకమని కూడా చెప్పవచ్చు.'
      : 'Ask me for the time or date, ask about a topic, or tell me to search the internet. You can also ask me to open Google search.';
  }
  return null;
}


function isWeatherQuestion(text: string) {
  return /\b(weather|temperature|forecast|rain|raining|humidity)\b/i.test(text) || /వాతావరణం|ఉష్ణోగ్రత|వర్షం|వాన పడ/.test(text);
}
function extractWeatherLocation(text: string) {
  const match = text.match(/\b(?:weather|temperature|forecast|rain|raining|humidity)\s+(?:in|at|for|near)\s+(.+?)\s*$/i)
    || text.match(/\b(?:in|at|for|near)\s+([a-z][a-z .'-]{1,50})\s*$/i);
  return match?.[1]?.trim().replace(/[?.!,]+$/, '') || '';
}
function weatherDescription(code: number, lang: Language) {
  const en: Record<number, string> = {0:'clear sky',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'fog',48:'freezing fog',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',75:'heavy snow',80:'rain showers',81:'showers',82:'heavy showers',95:'thunderstorm',96:'thunderstorm with hail',99:'heavy thunderstorm with hail'};
  const te: Record<number, string> = {0:'ఆకాశం నిర్మలంగా ఉంది',1:'ఎక్కువగా నిర్మలంగా ఉంది',2:'కొంత మేఘావృతం',3:'మేఘావృతం',45:'పొగమంచు ఉంది',48:'చల్లని పొగమంచు ఉంది',51:'తేలికపాటి చిరుజల్లులు',53:'చిరుజల్లులు',55:'భారీ చిరుజల్లులు',61:'తేలికపాటి వర్షం',63:'వర్షం పడుతోంది',65:'భారీ వర్షం',71:'తేలికపాటి మంచు',73:'మంచు పడుతోంది',75:'భారీ మంచు',80:'వర్షపు జల్లులు',81:'జల్లులు పడుతున్నాయి',82:'భారీ వర్షపు జల్లులు',95:'ఉరుములతో కూడిన వర్షం',96:'వడగళ్లతో ఉరుముల వర్షం',99:'భారీ ఉరుములు, వడగళ్ల వర్షం'};
  return (lang === 'te-IN' ? te[code] : en[code]) || (lang === 'te-IN' ? 'వాతావరణ వివరాలు అందుబాటులో ఉన్నాయి' : 'weather conditions available');
}
async function getWeather(city: string, lang: Language) {
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.searchParams.set('name', city); geoUrl.searchParams.set('count', '1'); geoUrl.searchParams.set('language', lang === 'te-IN' ? 'te' : 'en'); geoUrl.searchParams.set('format', 'json');
  const geoResponse = await fetch(geoUrl.toString());
  if (!geoResponse.ok) throw new Error('Location search failed');
  const place = (await geoResponse.json())?.results?.[0];
  if (!place) return lang === 'te-IN' ? city + ' అనే ప్రదేశం దొరకలేదు. మరో నగరం పేరు చెప్పండి.' : "I couldn't find " + city + ". Please say another city or town.";
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(place.latitude)); url.searchParams.set('longitude', String(place.longitude));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max'); url.searchParams.set('forecast_days', '1'); url.searchParams.set('timezone', 'auto');
  const response = await fetch(url.toString()); if (!response.ok) throw new Error('Weather service failed');
  const data = await response.json(), c = data.current, d = data.daily, desc = weatherDescription(c.weather_code, lang);
  if (lang === 'te-IN') return place.name + ' లో ప్రస్తుత వాతావరణం: ' + desc + '. ఉష్ణోగ్రత ' + Math.round(c.temperature_2m) + ' డిగ్రీల సెల్సియస్, అనిపించే ఉష్ణోగ్రత ' + Math.round(c.apparent_temperature) + ' డిగ్రీలు, తేమ ' + c.relative_humidity_2m + ' శాతం, గాలి వేగం గంటకు ' + Math.round(c.wind_speed_10m) + ' కిలోమీటర్లు. ఈ రోజు గరిష్ఠం ' + Math.round(d.temperature_2m_max[0]) + ', కనిష్ఠం ' + Math.round(d.temperature_2m_min[0]) + ' డిగ్రీలు. వర్షం పడే అవకాశం ' + (d.precipitation_probability_max[0] ?? 'తెలియదు') + ' శాతం.';
  return 'Current weather in ' + place.name + ', ' + (place.country || '') + ': ' + desc + '. Temperature ' + Math.round(c.temperature_2m) + '°C, feels like ' + Math.round(c.apparent_temperature) + '°C, humidity ' + c.relative_humidity_2m + '%, wind ' + Math.round(c.wind_speed_10m) + ' km/h. Today high ' + Math.round(d.temperature_2m_max[0]) + '°C, low ' + Math.round(d.temperature_2m_min[0]) + '°C; precipitation chance ' + (d.precipitation_probability_max[0] ?? 'unknown') + '%.';
}

function getSearchQuery(text: string) {
  return text
    .replace(/^(hey\s+)?(jarvis|sai|shiva)[,\s]*/i, '')
    .replace(/^(please\s+)?(search (the )?internet for|search for|search|look up|find information about|tell me about|who is|what is|what are|explain)\s+/i, '')
    .replace(/^(గూగుల్|ఇంటర్నెట్|వెతుకు|వెతకండి|చెప్పు|చెప్పండి)\s*/i, '')
    .trim();
}

export default function App() {
  const [lang, setLang] = useState<Language>('te-IN');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: 'assistant', text: welcome }]);
  const [status, setStatus] = useState('సిద్ధంగా ఉంది · Ready');
  const [lastResults, setLastResults] = useState<Result[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [webFallback, setWebFallback] = useState(false);
  const [awaitingWeatherLocation, setAwaitingWeatherLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(2);
  const recognitionRef = useRef<any>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = lang === 'te-IN' ? 'te' : 'en';
  }, [lang]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort?.(); } catch { /* no-op */ }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  function addMessage(role: Message['role'], text: string, result?: Result) {
    const message: Message = { id: nextId.current++, role, text, result };
    setMessages((prev) => [...prev, message].slice(-30));
    return message;
  }

  async function reply(text: string) {
    addMessage('assistant', text);
    setSpeaking(voiceEnabled);
    await speak(text, lang, voiceEnabled);
    setSpeaking(false);
  }

  async function answerQuestion(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setStatus(lang === 'te-IN' ? 'మీ ప్రశ్నను అర్థం చేసుకుంటున్నాను…' : 'Understanding your question…');
    addMessage('user', question);
    setInput('');

    try {
      if (awaitingWeatherLocation) {
        setAwaitingWeatherLocation(false);
        await reply(await getWeather(question, lang));
        return;
      }
      if (isWeatherQuestion(question)) {
        const location = extractWeatherLocation(question);
        if (!location) {
          setAwaitingWeatherLocation(true);
          await reply(lang === 'te-IN' ? 'ఏ ప్రదేశంలో వాతావరణం తెలుసుకోవాలి? దయచేసి నగరం లేదా ఊరి పేరు చెప్పండి.' : 'Which location should I check the weather for? Please say a city or town.');
          return;
        }
        await reply(await getWeather(location, lang));
        return;
      }
      if (/\b(read|open|read out|summarize)\s+(the\s+)?(file|document|pdf|text file)\b/i.test(question) || /ఫైల్ చదువు|ఫైల్ తెరువు|డాక్యుమెంట్ చదువు/.test(question)) {
        await reply(lang === 'te-IN' ? 'చదవాల్సిన టెక్స్ట్ ఫైల్ ఎంచుకోండి. అనుమతి కోసం ఫైల్ ఎంపిక విండో తెరుస్తున్నాను.' : 'Choose the text file you want me to read. The file picker will ask you to select it.');
        fileInputRef.current?.click();
        return;
      }

      const local = localIntent(question, lang);
      if (local) {
        await reply(local);
        return;
      }

      const normalized = question.toLowerCase();
      if (/\b(open|launch)\s+(google|browser|youtube)\b/.test(normalized) || /గూగుల్ ఓపెన్/.test(question)) {
        const target = /youtube/.test(normalized) ? 'https://www.youtube.com' : 'https://www.google.com';
        window.open(target, '_blank', 'noopener,noreferrer');
        await reply(lang === 'te-IN' ? 'మీ కోసం వెబ్‌సైట్ తెరవడానికి ప్రయత్నించాను.' : 'I tried to open the website for you.');
        return;
      }

      const query = getSearchQuery(question);
      setStatus(lang === 'te-IN' ? 'ఇంటర్నెట్‌లో సమాచారం వెతుకుతున్నాను…' : 'Searching the internet…');
      const results = await searchWeb(query || question, lang);
      setLastResults(results);

      if (results.length > 0) {
        const first = results[0];
        const summary = first.extract.replace(/\s+/g, ' ').trim();
        const answer = lang === 'te-IN'
          ? `ఇంటర్నెట్‌లో ${first.title} గురించి సమాచారం దొరికింది. ${summary} పూర్తి సమాచారం కోసం స్క్రీన్‌పై ${first.source} లింక్ ఉంది. తెలుగు అనువాదం అవసరమైతే అడగండి.`
          : `I found information about ${first.title}. ${summary} You can open the source link on screen for the full article.`;
        addMessage('assistant', answer, first);
        setSpeaking(voiceEnabled);
        await speak(answer, lang, voiceEnabled);
        setSpeaking(false);
      } else {
        setWebFallback(true);
        const answer = lang === 'te-IN'
          ? 'ఈ ప్రశ్నకు నమ్మదగిన ఉచిత సమాచారం వెంటనే దొరకలేదు. Googleలో ఈ ప్రశ్నను వెతకడానికి లింక్ సిద్ధంగా ఉంది.'
          : 'I could not find a reliable free summary immediately. I have prepared a Google search link for your question.';
        addMessage('assistant', answer);
        setSpeaking(voiceEnabled);
        await speak(answer, lang, voiceEnabled);
        setSpeaking(false);
      }
    } catch (error) {
      console.error(error);
      setWebFallback(true);
      const msg = lang === 'te-IN'
        ? 'ఇంటర్నెట్‌కు కనెక్ట్ కావడం లేదు లేదా సమాచారం అందుబాటులో లేదు. కనెక్షన్ చెక్ చేసి మళ్లీ ప్రయత్నించండి.'
        : 'I could not reach the online information service. Check your connection and try again.';
      await reply(msg);
    } finally {
      setBusy(false);
      setListening(false);
      inFlightRef.current = false;
      setStatus(lang === 'te-IN' ? 'సిద్ధంగా ఉంది · Ready' : 'Ready');
    }
  }

  async function startListening() {
    if (busy || listening) {
      try {
        if (isNative) await SpeechRecognition.stop();
        else recognitionRef.current?.stop?.();
      } catch { /* no-op */ }
      setListening(false);
      return;
    }
    setWebFallback(false);
    setStatus(lang === 'te-IN' ? 'మీరు మాట్లాడండి…' : 'Listening…');
    try {
      if (isNative) {
        const permission = await SpeechRecognition.requestPermissions();
        if (permission.speechRecognition !== 'granted') {
          await reply(lang === 'te-IN' ? 'మైక్రోఫోన్ మరియు స్పీచ్ అనుమతి ఇవ్వండి. అవసరమైతే టైప్ చేసి పంపవచ్చు.' : 'Please allow microphone and speech recognition permission. You can also type your question.');
          return;
        }
        setListening(true);
        const result = await SpeechRecognition.start({ language: lang, maxResults: 1, partialResults: false, popup: false });
        const matches = (result as any)?.matches || [];
        setListening(false);
        if (matches[0]) await answerQuestion(matches[0]);
        else setStatus(lang === 'te-IN' ? 'మాట వినబడలేదు. మళ్లీ ప్రయత్నించండి.' : 'No speech detected. Try again.');
      } else {
        const Recognition = getRecognitionConstructor();
        if (!Recognition) {
          await reply(lang === 'te-IN'
            ? 'ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు అందుబాటులో లేదు. Android యాప్‌ని ఉపయోగించండి లేదా ప్రశ్నను టైప్ చేయండి.'
            : 'Voice recognition is not supported in this browser. Try the Android app or type your question.');
          setStatus('Voice recognition unavailable');
          return;
        }
        const recognition = new Recognition();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;
        recognition.onresult = (event: any) => {
          const spokenText = event.results?.[0]?.[0]?.transcript || '';
          void answerQuestion(spokenText);
        };
        recognition.onerror = (event: any) => {
          setListening(false);
          setStatus(event.error === 'not-allowed' ? 'Microphone permission denied' : 'Try speaking again');
        };
        recognition.onend = () => setListening(false);
        setListening(true);
        recognition.start();
      }
    } catch (error) {
      console.error(error);
      setListening(false);
      setStatus(lang === 'te-IN' ? 'వాయిస్ ప్రారంభం కాలేదు. టైప్ చేసి పంపండి.' : 'Voice could not start. Type your question instead.');
    }
  }

  const speakAgain = async (text: string) => {
    setSpeaking(true);
    await speak(text, lang, voiceEnabled);
    setSpeaking(false);
  };

  function openGoogle(query: string) {
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <div className="brand" aria-label="SAI Voice OS">
          <div className="brand-mark" aria-hidden="true"><AudioLines size={26} /></div>
          <div><div className="brand-name">SAI <span>Voice OS</span></div><div className="brand-sub">YOUR VOICE-FIRST ASSISTANT</div></div>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setShowHelp((v) => !v)} aria-label="Help and voice commands" title="Help"><CircleHelp /></button>
          <button className="icon-button" onClick={() => setShowSettings((v) => !v)} aria-label="Settings" title="Settings"><Settings2 /></button>
        </div>
      </header>

      <section className="welcome-section" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow"><Accessibility size={16} aria-hidden="true" /> ACCESSIBLE BY DESIGN</p>
          <h1 id="welcome-title">{lang === 'te-IN' ? 'చెప్పండి. నేను వింటున్నాను.' : "Speak. I'm listening."}</h1>
          <p className="welcome-description">{lang === 'te-IN' ? 'మీ చేతులు ఉపయోగించాల్సిన అవసరం లేదు. అడగండి — నేను వెతికి, సమాధానాన్ని గట్టిగా చదువుతాను.' : 'Keep your hands free. Ask a question — I’ll look it up and read the answer aloud.'}</p>
        </div>
        <div className={'orb ' + (listening ? 'orb-listening' : busy ? 'orb-thinking' : '')} aria-hidden="true">
          <span className="orb-ring ring-one" /><span className="orb-ring ring-two" />
          <div className="orb-core"><AudioLines size={44} strokeWidth={1.5} /></div>
        </div>
      </section>

      <section className="voice-panel" aria-label="Voice controls">
        <div className="status-row" role="status" aria-live="polite">
          <span className={'status-dot ' + (listening ? 'dot-live' : busy ? 'dot-busy' : '')} />
          <span>{listening ? (lang === 'te-IN' ? 'వింటున్నాను' : 'Listening') : speaking ? (lang === 'te-IN' ? 'సమాధానం చెబుతున్నాను' : 'Speaking answer') : status}</span>
          {busy && <span className="loading-pulse" aria-hidden="true">•••</span>}
        </div>
        <button className={'mic-button ' + (listening ? 'mic-active' : '')} onClick={() => void startListening()} disabled={busy} aria-label={listening ? 'Stop listening' : 'Tap to ask a question by voice'} aria-pressed={listening}>
          {listening ? <MicOff size={36} /> : <Mic size={36} />}
        </button>
        <p className="mic-hint">{listening ? (lang === 'te-IN' ? 'మాట్లాడటం పూర్తయిన తర్వాత వేచి ఉండండి' : 'Finish speaking, then wait') : (lang === 'te-IN' ? 'మాట్లాడటానికి మైక్ నొక్కండి' : 'Tap the microphone to speak')}</p>
        <div className="quick-actions" aria-label="Quick actions">
          <button onClick={() => void answerQuestion(lang === 'te-IN' ? 'ఇప్పుడు సమయం ఎంత?' : 'What time is it?')}><span>◷</span>{lang === 'te-IN' ? 'సమయం' : 'Time'}</button>
          <button onClick={() => void answerQuestion(lang === 'te-IN' ? 'ఈ రోజు తేదీ ఏమిటి?' : "What's today's date?")}><span>▦</span>{lang === 'te-IN' ? 'తేదీ' : 'Date'}</button>
          <button onClick={() => openGoogle('latest news')}><Globe2 size={16} />{lang === 'te-IN' ? 'వార్తలు' : 'News search'}</button>
        </div>
      </section>

      {showHelp && <section className="utility-panel" aria-labelledby="help-title">
        <h2 id="help-title"><BookOpen size={20} /> {lang === 'te-IN' ? 'ఇలా అడగండి' : 'Try saying'}</h2>
        <div className="examples-grid">
          {(lang === 'te-IN'
            ? ['ఈ రోజు వాతావరణం ఎలా ఉంది?', 'కంప్యూటర్ అంటే ఏమిటి?', 'భారతదేశం గురించి చెప్పు', 'Googleలో తాజా వార్తలు వెతుకు']
            : ['What is artificial intelligence?', 'Tell me about India', 'Search the internet for today’s news', 'What time is it?']
          ).map((example) => <button className="example-button" key={example} onClick={() => void answerQuestion(example)}>{example}<span aria-hidden="true">↗</span></button>)}
        </div>
      </section>}

      {showSettings && <section className="utility-panel settings-panel" aria-labelledby="settings-title">
        <h2 id="settings-title"><Settings2 size={20} /> {lang === 'te-IN' ? 'సెట్టింగ్స్' : 'Settings'}</h2>
        <label className="setting-row"><span><Languages size={18} /> {lang === 'te-IN' ? 'భాష / Language' : 'Language'}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Language)} aria-label="Assistant language">
            <option value="te-IN">తెలుగు (Telugu)</option><option value="en-IN">English (India)</option>
          </select>
        </label>
        <label className="setting-row"><span><Volume2 size={18} /> {lang === 'te-IN' ? 'సమాధానాలు గట్టిగా చదవాలి' : 'Speak answers aloud'}</span>
          <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} aria-label="Speak answers aloud" />
        </label>
        <p className="settings-note">{lang === 'te-IN' ? 'వాయిస్ ఇన్‌పుట్ కోసం మైక్రోఫోన్ అనుమతి అవసరం. భాష ఎంపికను బట్టి ఫోన్‌లో అందుబాటులో ఉన్న వాయిస్ మారవచ్చు.' : 'Microphone permission is required for voice input. Available voices depend on your device.'}</p>
      </section>}

      <input ref={fileInputRef} type="file" className="visually-hidden" accept=".txt,.md,.csv,.json,.log,.html,.xml" aria-label="Choose a text file to read" onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        setBusy(true); setStatus(lang === 'te-IN' ? 'ఫైల్ చదువుతున్నాను…' : 'Reading file…');
        try {
          const contents = (await file.text()).replace(/\s+/g, ' ').trim();
          if (!contents) await reply(lang === 'te-IN' ? 'ఈ ఫైల్‌లో చదవగలిగే టెక్స్ట్ లేదు.' : 'This file has no readable text.');
          else await reply((lang === 'te-IN' ? file.name + ' ఫైల్ చదివాను. ' : 'I read ' + file.name + '. ') + (contents.length > 7000 ? contents.slice(0, 7000) + (lang === 'te-IN' ? '... ఫైల్ పెద్దది కాబట్టి మొదటి భాగం మాత్రమే.' : '... file is long, so only the first part is read.') : contents));
        } catch (error) {
          console.error(error); await reply(lang === 'te-IN' ? 'ఈ ఫైల్ చదవలేకపోయాను. టెక్స్ట్ ఫైల్‌ను ప్రయత్నించండి.' : 'I could not read this file. Please try a text file.');
        } finally { setBusy(false); setStatus(lang === 'te-IN' ? 'సిద్ధంగా ఉంది · Ready' : 'Ready'); event.target.value = ''; }
      }} />

      <section id="main-content" className="conversation" aria-labelledby="conversation-title">
        <div className="section-heading"><h2 id="conversation-title">{lang === 'te-IN' ? 'మన సంభాషణ' : 'Conversation'}</h2><span>{messages.length} {lang === 'te-IN' ? 'సందేశాలు' : 'messages'}</span></div>
        <div className="message-list" aria-live="polite" aria-relevant="additions text">
          {messages.slice(-8).map((message) => <article className={'message message-' + message.role} key={message.id}>
            <div className="message-avatar" aria-hidden="true">{message.role === 'assistant' ? <AudioLines size={19} /> : <span>YOU</span>}</div>
            <div className="message-content">
              <div className="message-role">{message.role === 'assistant' ? 'SAI VOICE OS' : (lang === 'te-IN' ? 'మీరు' : 'YOU')}</div>
              <p>{message.text}</p>
              {message.result && <a className="source-link" href={message.result.url} target="_blank" rel="noreferrer"><BookOpen size={16} /><span>{message.result.source}: {message.result.title}</span><ExternalLink size={14} /></a>}
              {message.role === 'assistant' && <button className="speak-again" onClick={() => void speakAgain(message.text)} aria-label="Read this answer aloud again"><Volume2 size={16} /> {lang === 'te-IN' ? 'మళ్లీ వినండి' : 'Read aloud'}</button>}
            </div>
          </article>)}
          {busy && <div className="thinking" role="status"><span></span><span></span><span></span>{lang === 'te-IN' ? 'సమాచారం వెతుకుతున్నాను…' : 'Looking for information…'}</div>}
        </div>
        <form className="text-form" onSubmit={(e) => { e.preventDefault(); void answerQuestion(input); }}>
          <label className="visually-hidden" htmlFor="question-input">{lang === 'te-IN' ? 'మీ ప్రశ్నను టైప్ చేయండి' : 'Type your question'}</label>
          <input id="question-input" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === 'te-IN' ? 'లేదా ఇక్కడ టైప్ చేయండి…' : 'Or type your question…'} />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send question"><Search size={20} /> <span>{lang === 'te-IN' ? 'పంపు' : 'Ask'}</span></button>
        </form>
      </section>

      {lastResults.length > 0 && <section className="results-section" aria-labelledby="results-title">
        <div className="section-heading"><h2 id="results-title"><Globe2 size={19} /> {lang === 'te-IN' ? 'ఇంటర్నెట్‌లో దొరికిన సమాచారం' : 'Web results'}</h2></div>
        {lastResults.map((item) => <a className="result-card" href={item.url} target="_blank" rel="noreferrer" key={item.url}>
          <span className="result-source">{item.source}</span><strong>{item.title}</strong><p>{item.extract}</p><span className="result-open">{lang === 'te-IN' ? 'మూలాన్ని తెరవండి' : 'Open source'} <ExternalLink size={14} /></span>
        </a>)}
      </section>}

      {webFallback && <section className="utility-panel fallback-panel">
        <h2><Search size={20} /> {lang === 'te-IN' ? 'మరింత వెతకండి' : 'Search more widely'}</h2>
        <p>{lang === 'te-IN' ? 'సమాచారం దొరకకపోతే, ప్రశ్నను Google Searchలో తెరవవచ్చు.' : 'If the summary service cannot find an answer, open a wider Google Search.'}</p>
        <button className="primary-small" onClick={() => openGoogle(messages.filter((m) => m.role === 'user').slice(-1)[0]?.text || '')}>{lang === 'te-IN' ? 'Googleలో వెతకండి' : 'Search with Google'} <ExternalLink size={16} /></button>
      </section>}

      <footer className="footer">
        <div><ShieldCheck size={17} /><span>{lang === 'te-IN' ? 'యాక్సెసిబిలిటీకి ప్రాధాన్యత' : 'Accessibility comes first'}</span></div>
        <p>{lang === 'te-IN' ? 'ఇది సహాయక ప్రోటోటైప్. అత్యవసర పరిస్థితుల్లో లేదా ముఖ్యమైన నిర్ణయాల కోసం సమాచారాన్ని మరోసారి ధృవీకరించండి.' : 'Assistive prototype. Verify important information; do not rely on it for emergencies.'}</p>
      </footer>
    </main>
  );
}
