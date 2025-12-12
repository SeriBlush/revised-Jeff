
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Smile, BookOpen, WifiOff, Volume2, Pause, Info, Play,
  Calendar, CreditCard, Book, Trash2, ArrowLeft, Plus, X, List, Target, SquareCheck, Headphones, Paperclip, Image as ImageIcon, Gamepad2, Palette,
  CircleDashed, User, Phone, MessageCircle, Image as PhotoIcon, Users, Grid, Battery, Wifi, Signal, ChevronLeft, MoreVertical, Search
} from 'lucide-react';
import { 
  Message, Persona, Role, UserProfile, 
  PlannerItem, Expense, WishlistItem, NovelLog, TimerState, Attachment, Reaction, Story
} from './types';
import { generateResponse, updateBestieBio, generateProactiveMessage, generateImage, updateJeffStoryline } from './services/geminiService';
import { decodeAudioData, base64ToUint8Array } from './services/audioUtils';

// --- Sound Effects ---
const SOUNDS = {
  SEND: 'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
  RECEIVE: 'https://assets.mixkit.co/sfx/preview/mixkit-happy-bells-notification-937.mp3', 
  ALARM: 'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3',
  REACT: 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3',
  STORY_POP: 'https://assets.mixkit.co/sfx/preview/mixkit-camera-shutter-click-1133.mp3',
  UNLOCK: 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-click-900.mp3',
  KEYPAD: 'https://assets.mixkit.co/sfx/preview/mixkit-single-key-type-2533.mp3'
};

const playSound = (url: string) => {
  const audio = new Audio(url);
  audio.volume = 0.5;
  audio.play().catch(e => console.log("Audio play failed (interaction required)", e));
};

// --- Helper Components ---

const ModalInput = ({ name, placeholder, type = "text", required = true, onChange, formData }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-bold mb-1 capitalize text-sketch-ink">{name.replace(/([A-Z])/g, ' $1').trim()}</label>
    <input
      type={type}
      required={required}
      className="w-full border-2 border-black rounded-lg p-2 focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-patrick text-lg"
      placeholder={placeholder}
      value={formData[name] || ''}
      onChange={e => onChange({ ...formData, [name]: e.target.value })}
    />
  </div>
);

const ModalSelect = ({ name, options, onChange, formData }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-bold mb-1 capitalize text-sketch-ink">{name}</label>
    <select
      className="w-full border-2 border-black rounded-lg p-2 bg-white font-patrick text-lg"
      value={formData[name] || ''}
      onChange={e => onChange({ ...formData, [name]: e.target.value })}
    >
      <option value="" disabled>Select {name}</option>
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const AddModal = ({ 
  isOpen, onClose, type, onSave 
}: { 
  isOpen: boolean, onClose: () => void, type: string, onSave: (data: any) => void 
}) => {
  const [formData, setFormData] = useState<any>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setFormData({});
    onClose();
  };

  const commonProps = { formData, onChange: setFormData };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 relative animate-in slide-in-from-bottom-10 fade-in font-patrick">
        <button onClick={onClose} className="absolute top-4 right-4"><X size={24} /></button>
        <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">Add to {type}</h2>
        
        <form onSubmit={handleSubmit}>
          {type === 'Plans' && (
            <>
              <ModalInput name="title" placeholder="e.g., Dentist Appointment" {...commonProps} />
              <ModalInput name="date" type="datetime-local" {...commonProps} />
              <ModalInput name="notes" placeholder="Details (e.g., bring ID)" required={false} {...commonProps} />
              <ModalSelect name="type" options={['event', 'reminder', 'date']} {...commonProps} />
            </>
          )}
          {type === 'Expenses' && (
            <>
              <ModalInput name="item" placeholder="e.g., Textbooks" {...commonProps} />
              <ModalInput name="amount" type="number" placeholder="0.00" {...commonProps} />
              <ModalSelect name="category" options={['exam', 'budget', 'other']} {...commonProps} />
            </>
          )}
          {type === 'Reading' && (
            <>
              <ModalInput name="title" placeholder="e.g., The Great Gatsby" {...commonProps} />
              <ModalInput name="author" placeholder="e.g., F. Scott Fitzgerald" required={false} {...commonProps} />
              <div className="flex gap-2">
                <ModalInput name="currentChapter" type="number" placeholder="Ch. 1" {...commonProps} />
                <ModalInput name="totalChapters" type="number" placeholder="Total" required={false} {...commonProps} />
              </div>
              <ModalInput name="notes" placeholder="Any gossip/thoughts?" required={false} {...commonProps} />
            </>
          )}
          {type === 'Wishes' && (
            <>
              <ModalInput name="title" placeholder="e.g., New Headphones" {...commonProps} />
              <ModalInput name="details" placeholder="Link or Price" required={false} {...commonProps} />
              <ModalSelect name="type" options={['movie', 'book', 'item', 'other']} {...commonProps} />
            </>
          )}
          <button type="submit" className="w-full bg-black text-white font-bold py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] active:translate-y-1 active:shadow-none transition-all text-xl">
            Save Item
          </button>
        </form>
      </div>
    </div>
  );
};

const DoodleCanvas = ({ isOpen, onClose, onSend }: { isOpen: boolean, onClose: () => void, onSend: (base64: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
      }
    }
  }, [isOpen]);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSend = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
      onSend(dataUrl.split(',')[1]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border-4 border-black p-4 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(255,255,255,0.5)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold font-patrick">Draw Together! 🎨</h3>
          <button onClick={onClose}><X size={24}/></button>
        </div>
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="border-2 border-black touch-none bg-white w-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button onClick={handleSend} className="w-full mt-4 bg-black text-white py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] active:shadow-none font-bold font-patrick text-xl">
          Send Masterpiece
        </button>
      </div>
    </div>
  );
};

const AttachmentMenu = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (id: string) => void }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute bottom-full left-0 mb-3 ml-2 bg-white border-2 border-black rounded-xl p-2 flex flex-col gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 animate-in slide-in-from-bottom-5 w-48 font-patrick">
       {[
         { id: 'photo', label: 'Photo', icon: ImageIcon },
         { id: 'video', label: 'Video', icon: Play },
         { id: 'doodle', label: 'Doodle', icon: Palette },
         { id: 'truth_or_dare', label: 'Truth or Dare', icon: Target },
         { id: 'trivia', label: 'Trivia', icon: Book },
         { id: 'joke', label: 'Tell Joke', icon: Smile },
       ].map(opt => (
         <button 
           key={opt.id} 
           onClick={() => onSelect(opt.id)} 
           className="text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-lg font-bold flex items-center gap-2"
         >
           <opt.icon size={18} /> {opt.label}
         </button>
       ))}
       <button onClick={onClose} className="text-center text-xs text-red-500 pt-1 border-t border-gray-100 mt-1">Cancel</button>
    </div>
  );
};

const JeffProfileModal = ({ isOpen, onClose, profile, stories }: any) => {
  const [tab, setTab] = useState<'bio' | 'life' | 'gallery'>('bio');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-patrick">
      <div className="bg-white w-full max-w-md rounded-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 relative animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-50">
           <h2 className="text-2xl font-bold">Jeff's Profile 👤</h2>
           <button onClick={onClose}><X size={24}/></button>
        </div>
        
        <div className="flex border-b-2 border-black">
           {['bio', 'life', 'gallery'].map(t => (
             <button 
               key={t} 
               onClick={() => setTab(t as any)} 
               className={`flex-1 py-3 font-bold text-lg capitalize transition-colors ${tab === t ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
             >
               {t}
             </button>
           ))}
        </div>

        <div className="p-6 overflow-y-auto">
           {tab === 'bio' && (
             <div>
               <h3 className="text-xl font-bold mb-2">Memory of You 🧠</h3>
               <p className="whitespace-pre-wrap text-lg leading-relaxed">{profile.bio}</p>
             </div>
           )}
           {tab === 'life' && (
             <div>
               <h3 className="text-xl font-bold mb-2">Jeff's Life Story 📖</h3>
               <p className="whitespace-pre-wrap text-lg leading-relaxed">{profile.jeffStoryline}</p>
             </div>
           )}
           {tab === 'gallery' && (
             <div className="grid grid-cols-2 gap-2">
               {stories.map((s: Story) => (
                 <div key={s.id} className="aspect-square border-2 border-black rounded-lg overflow-hidden relative group">
                    <img src={s.imageUrl} alt="Story" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-end p-2 transition-opacity">
                      <p className="text-white text-xs">{s.caption}</p>
                    </div>
                 </div>
               ))}
               {stories.length === 0 && <p className="col-span-2 text-center text-gray-400 italic">No stories yet.</p>}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

const TypingBubble = () => (
  <div className="flex w-full mb-6 justify-start px-4">
    <div className="bg-white border-2 border-black p-4 rounded-xl rounded-tl-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 min-h-[50px]">
      <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
    </div>
  </div>
);

const VoiceNoteBubble = ({ audioSrc, isUser }: { audioSrc: string, isUser: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioSrc);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
    return () => { audio.pause(); };
  }, [audioSrc]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border-2 border-black ${isUser ? 'bg-white text-black' : 'bg-gray-100 text-black'} w-full max-w-[220px] mb-2`}>
      <button 
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-black shrink-0 ${isUser ? 'bg-black text-white' : 'bg-white text-black'}`}
      >
        {isPlaying ? <Pause size={18} fill={isUser ? "white" : "black"} /> : <Play size={18} fill={isUser ? "white" : "black"} className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex items-center gap-0.5 h-8">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className={`w-1 bg-current rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
            style={{ 
              height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '30%',
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

const ReactionPicker = ({ onSelect, onClose }: { onSelect: (e: string) => void, onClose: () => void }) => (
  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border-2 border-black rounded-full p-2 flex gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10 animate-in zoom-in duration-200">
    {['❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
      <button 
        key={emoji} 
        onClick={(e) => { e.stopPropagation(); onSelect(emoji); }} 
        className="text-2xl hover:scale-125 transition-transform p-1"
      >
        {emoji}
      </button>
    ))}
    <button onClick={(e) => {e.stopPropagation(); onClose();}} className="border-l-2 border-gray-200 pl-2 text-gray-400 hover:text-red-500"><X size={16}/></button>
  </div>
);

const ReactionBadge = ({ reactions }: { reactions: Reaction[] }) => {
  if (!reactions || reactions.length === 0) return null;
  const counts: Record<string, number> = {};
  reactions.forEach(r => counts[r.emoji] = (counts[r.emoji] || 0) + 1);

  return (
    <div className="absolute -bottom-3 right-2 flex gap-1 z-10">
      {Object.entries(counts).map(([emoji, count]) => (
        <div key={emoji} className="bg-white border-2 border-black rounded-full px-1.5 py-0.5 text-xs font-bold shadow-sm flex items-center gap-1">
          <span>{emoji}</span>
          {count > 1 && <span className="text-gray-500">{count}</span>}
        </div>
      ))}
    </div>
  );
};

// --- Story Components ---
const StoryViewer = ({ stories, onClose }: { stories: Story[], onClose: () => void }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (index < stories.length - 1) setIndex(index + 1);
      else onClose();
    }, 5000); 
    return () => clearTimeout(timer);
  }, [index, stories, onClose]);

  const currentStory = stories[index];
  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-patrick" onClick={onClose}>
      <div className="absolute top-2 left-2 right-2 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-white' : 'bg-gray-600'}`}></div>
        ))}
      </div>
      <div className="w-full max-w-md bg-white p-4 pb-12 rounded-lg border-4 border-black rotate-1 shadow-[0_0_20px_rgba(255,255,255,0.2)]" onClick={e => e.stopPropagation()}>
         <img src={currentStory.imageUrl} alt="Story" className="w-full aspect-square object-cover border-2 border-black mb-4 rounded-sm" />
         <p className="text-2xl font-bold text-center handwriting">{currentStory.caption}</p>
         <p className="text-xs text-center mt-4 text-gray-500">{new Date(currentStory.timestamp).toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

// --- Music Player Component ---

const MusicPlayer = ({ 
  spotifyUrl, setSpotifyUrl, onPlay, onClose 
}: { 
  spotifyUrl: string | null, setSpotifyUrl: (url: string) => void, onPlay: (url: string) => void, onClose: () => void 
}) => {
  const [input, setInput] = useState('');
  
  const handleLoad = () => {
    let embedUrl = input;
    if (input.includes('spotify.com') && !input.includes('/embed')) {
      embedUrl = input.replace('spotify.com/', 'spotify.com/embed/');
    }
    onPlay(embedUrl);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 animate-in slide-in-from-bottom-10 font-patrick">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold flex items-center gap-2"><Headphones size={20} /> Vibe Station</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      
      {!spotifyUrl ? (
        <div className="flex gap-2">
           <input 
             type="text" 
             placeholder="Paste Spotify Link..." 
             className="flex-1 border-2 border-black rounded-lg px-2 py-1 focus:outline-none"
             value={input}
             onChange={e => setInput(e.target.value)}
           />
           <button onClick={handleLoad} className="bg-black text-white px-3 py-1 rounded-lg border-2 border-black font-bold">Play</button>
        </div>
      ) : (
        <div className="w-full">
          <iframe 
            style={{ borderRadius: '12px' }} 
            src={spotifyUrl} 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowFullScreen 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy"
          ></iframe>
          <button onClick={() => setSpotifyUrl('')} className="mt-2 text-xs text-red-500 font-bold underline">Change Track</button>
        </div>
      )}
    </div>
  );
};


// --- Layout Components ---

const GlobalHeader = ({ 
  view, setView, persona, onToggleProfile, onToggleMusic, hasNewStory, onOpenStory, onBack 
}: { 
  view: string, setView: (v: any) => void, persona: Persona, onToggleProfile: () => void, onToggleMusic: () => void, hasNewStory: boolean, onOpenStory: () => void, onBack: () => void
}) => {
  return (
    <div className="bg-white border-b-2 border-black p-2 flex items-center justify-between shrink-0 shadow-sm z-30 h-16 font-patrick">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={28} className="text-black" />
        </button>
        <button 
          onClick={() => {
            if (hasNewStory) onOpenStory();
            else onToggleProfile();
          }} 
          className="flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="relative">
            <div className={`w-10 h-10 rounded-full border-2 border-black overflow-hidden flex items-center justify-center bg-gray-100 ${hasNewStory ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Jeff${persona === Persona.TUTOR ? 'Tutor' : ''}`} alt="Avatar" className="w-full h-full" />
            </div>
          </div>
          <div className="text-left leading-tight">
            <h1 className="font-bold text-xl">Jeff</h1>
            <p className="text-xs text-gray-500">
              {persona === Persona.TUTOR ? 'Tutor Mode' : 'Online'}
            </p>
          </div>
        </button>
      </div>

      <div className="flex gap-3 text-black items-center pr-2">
        <button onClick={onToggleMusic}><Headphones size={22} /></button>
        <button onClick={() => setView('study')} className={view === 'study' ? 'text-blue-500' : ''}><BookOpen size={22} /></button>
        <button onClick={() => setView('life')} className={view === 'life' ? 'text-blue-500' : ''}><Calendar size={22} /></button>
      </div>
    </div>
  );
};

const ChatInputFooter = ({
  inputText, setInputText, onSendMessage, 
  isRecording, handleVoiceInput, 
  showMoods, setShowMoods,
  onGameClick 
}: any) => {
  const [draftFile, setDraftFile] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAttachments, setShowAttachments] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setDraftFile({
        type: file.type.startsWith('video') ? 'video' : 'image',
        url: reader.result as string,
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    onSendMessage(inputText, undefined, undefined, draftFile);
    setDraftFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMenuSelect = (id: string) => {
    setShowAttachments(false);
    if (id === 'photo' || id === 'video') {
       fileInputRef.current?.click();
    } else {
       onGameClick(id);
    }
  };

  return (
    <div className="bg-white p-2 border-t-2 border-black shrink-0 relative z-40 pb-[max(8px,env(safe-area-inset-bottom))] font-patrick">
        {showMoods && (
          <div className="absolute bottom-full left-4 mb-3 bg-white border-2 border-black rounded-xl p-2 flex flex-col gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-2 z-20">
            {['😊 Happy', '😌 Calm', '😰 Anxious', '😢 Sad', '🥰 Loved'].map(m => (
              <button key={m} onClick={() => onSendMessage(`I'm feeling ${m}`, m)} className="text-left px-3 py-2 hover:bg-gray-100 rounded-lg font-bold text-lg">{m}</button>
            ))}
          </div>
        )}

        <AttachmentMenu 
          isOpen={showAttachments} 
          onClose={() => setShowAttachments(false)} 
          onSelect={handleMenuSelect}
        />
        
        {draftFile && (
          <div className="absolute bottom-full left-4 mb-3 bg-white border-2 border-black rounded-xl p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 animate-in zoom-in">
             <div className="relative">
                <button onClick={() => setDraftFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 border-2 border-black z-10"><X size={12}/></button>
                {draftFile.type === 'video' ? <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded"><Play /></div> : <img src={draftFile.url} alt="Draft" className="w-24 h-24 object-cover rounded border border-black" />}
             </div>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
          
          <button onClick={() => setShowAttachments(!showAttachments)}><Plus size={24} className="text-black" /></button>

          <button onClick={() => setShowMoods(!showMoods)}><Smile size={24} className="text-black" /></button>
          
          <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center border-2 border-black focus-within:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isRecording ? "Listening..." : ""}
              className="bg-transparent w-full focus:outline-none text-lg font-patrick placeholder-gray-400"
            />
          </div>
          
          {inputText.trim() || draftFile ? (
            <button onClick={handleSend} className="p-2 bg-black text-white rounded-full border-2 border-black active:scale-95 transition-all"><Send size={18} /></button>
          ) : (
             <button onClick={handleVoiceInput} className={`p-2 rounded-full border-2 border-black transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-black bg-white'}`}><Mic size={24} /></button>
          )}
        </div>
    </div>
  );
};

// --- OS Screens ---

const AppIcon = ({ icon: Icon, label, color, onClick, badge }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 active:scale-95 transition-transform group w-16">
    <div className={`w-14 h-14 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center ${color} relative overflow-visible`}>
      <Icon size={28} strokeWidth={2.5} className="text-black" />
      {badge > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-black">{badge}</div>
      )}
    </div>
    <span className="text-xs font-bold font-patrick text-black drop-shadow-sm bg-white/50 px-1 rounded border border-black">{label}</span>
  </button>
);

const HomeScreen = ({ onOpenApp }: { onOpenApp: (app: any) => void }) => {
  return (
    <div className="h-full flex flex-col bg-white" style={{ backgroundImage: 'radial-gradient(#e5e7eb 2px, transparent 2px)', backgroundSize: '24px 24px' }}>
      {/* Status Bar Fake */}
      <div className="h-8 flex justify-between items-center px-4 text-xs font-bold font-patrick pt-2">
        <span>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        <div className="flex gap-1">
          <Signal size={12} />
          <Wifi size={12} />
          <Battery size={12} />
        </div>
      </div>
      
      <div className="flex-1 p-6 grid grid-cols-4 gap-6 content-start mt-4">
         <AppIcon icon={PhotoIcon} label="Photos" color="bg-yellow-200" onClick={() => onOpenApp('photos')} />
         <AppIcon icon={Calendar} label="Calendar" color="bg-white" onClick={() => {}} />
         <AppIcon icon={CreditCard} label="Wallet" color="bg-black text-white" onClick={() => {}} />
      </div>

      {/* Doodle Dock */}
      <div className="m-4 mb-8 bg-white rounded-xl p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-around">
         <AppIcon icon={Phone} label="Phone" color="bg-green-400" onClick={() => onOpenApp('phone')} />
         <AppIcon icon={Users} label="Contacts" color="bg-gray-300" onClick={() => onOpenApp('contacts')} />
         <AppIcon icon={MessageCircle} label="Messages" color="bg-green-500" onClick={() => onOpenApp('messages')} badge={1} />
         <AppIcon icon={Grid} label="Apps" color="bg-blue-300" onClick={() => {}} />
      </div>
    </div>
  );
};

const MessageList = ({ onSelectChat }: { onSelectChat: () => void }) => {
  const [lastMsg, setLastMsg] = useState<string>('Hey!');
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const msgs = JSON.parse(localStorage.getItem('jeff_msgs') || '[]');
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      setLastMsg(last.text || (last.attachments ? 'Sent an attachment' : 'Voice Message'));
      setTime(new Date(last.timestamp).toLocaleDateString());
    }
  }, []);

  return (
    <div className="h-full bg-white font-patrick flex flex-col">
       <div className="p-4 border-b-2 border-black flex justify-between items-end pb-2">
          <button className="text-black font-bold text-lg">Edit</button>
          <h1 className="text-3xl font-bold">Chats</h1>
          <button className="text-black"><Plus size={24}/></button>
       </div>
       <div className="p-4">
         <div className="bg-white border-2 border-black rounded-xl p-2 flex items-center gap-2 text-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
           <Search size={18} /> <span className="text-lg">Search</span>
         </div>
       </div>
       <div className="flex-1 overflow-y-auto px-4">
          <button onClick={onSelectChat} className="w-full flex items-center gap-3 p-4 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all mb-4">
             <div className="w-16 h-16 rounded-full border-2 border-black overflow-hidden bg-gray-200">
                <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Jeff" alt="Jeff" className="w-full h-full" />
             </div>
             <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                   <h3 className="font-bold text-xl">Jeff</h3>
                   <span className="text-sm text-gray-400 font-bold">{time}</span>
                </div>
                <p className="text-gray-500 truncate text-lg leading-tight">{lastMsg}</p>
             </div>
          </button>
       </div>
       <div className="p-4 border-t-2 border-black flex justify-around text-black font-bold">
          <div className="flex flex-col items-center"><MessageCircle />Status</div>
          <div className="flex flex-col items-center"><Phone />Calls</div>
          <div className="flex flex-col items-center"><Users />People</div>
       </div>
    </div>
  );
};

const PhotosApp = ({ onBack }: { onBack: () => void }) => {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('jeff_stories') || '[]');
    setStories(s);
  }, []);

  return (
    <div className="h-full bg-white font-patrick flex flex-col">
       <div className="p-4 border-b-2 border-black flex items-center gap-2">
          <button onClick={onBack} className="flex items-center text-black text-xl font-bold"><ChevronLeft size={24} /> Back</button>
          <h1 className="text-2xl font-bold ml-auto mr-auto translate-x-[-20px]">Jeff's Album</h1>
       </div>
       <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4">
             {stories.map(s => (
               <div key={s.id} className="aspect-square bg-white border-2 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-1">
                 <img src={s.imageUrl} className="w-full h-full object-cover border border-black" />
               </div>
             ))}
             {stories.length === 0 && <div className="col-span-2 text-center py-20 text-gray-400 text-xl">No doodles yet!</div>}
          </div>
       </div>
    </div>
  );
};

const ContactsApp = ({ onBack, onChat }: { onBack: () => void, onChat: () => void }) => (
  <div className="h-full bg-white font-patrick flex flex-col">
     <div className="p-4 border-b-2 border-black flex items-center">
        <button onClick={onBack} className="text-black text-xl font-bold flex items-center"><ChevronLeft /> Home</button>
     </div>
     <div className="p-4">
        <h1 className="text-3xl font-bold mb-4">Contacts</h1>
        <div className="bg-white border-2 border-black rounded-xl p-2 mb-6 text-gray-500 flex gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"><Search /> Search</div>
        
        <div className="border-t-2 border-black">
           <div className="py-2 bg-gray-100 border-b-2 border-black px-4 font-bold text-black">J</div>
           <button onClick={onChat} className="w-full text-left p-4 text-xl font-bold border-b-2 border-black flex items-center gap-3 bg-white hover:bg-yellow-50">
              <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden"><img src="https://api.dicebear.com/7.x/notionists/svg?seed=Jeff" /></div>
              Jeff
           </button>
        </div>
     </div>
  </div>
);

const PhoneApp = ({ onBack }: { onBack: () => void }) => {
  const [num, setNum] = useState('');
  const playKey = () => playSound(SOUNDS.KEYPAD);
  
  return (
    <div className="h-full bg-white font-patrick flex flex-col">
       <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold mb-8 h-10">{num}</div>
          <div className="grid grid-cols-3 gap-6">
             {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(n => (
               <button key={n} onClick={() => { setNum(prev => prev + n); playKey(); }} className="w-20 h-20 rounded-full bg-white border-2 border-black flex items-center justify-center text-3xl font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
                 {n}
               </button>
             ))}
          </div>
          <button className="mt-8 w-20 h-20 rounded-full bg-green-500 border-2 border-black text-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">
             <Phone size={32} fill="white" />
          </button>
          <button onClick={onBack} className="mt-8 text-black font-bold text-xl underline">Cancel</button>
       </div>
    </div>
  );
};

const MessageBubble = ({ 
  msg, isUser, playAudio, playingId, onReact 
}: { 
  msg: Message, isUser: boolean, playAudio: (m: Message) => void, playingId: string | null, onReact: (id: string, e: string) => void 
}) => {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} group relative px-2 font-patrick`}>
       <div 
         className={`max-w-[80%] rounded-2xl p-4 relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isUser ? 'bg-black text-white rounded-tr-none' : 'bg-white text-black rounded-tl-none'}`}
         onClick={() => setShowReactions(!showReactions)}
       >
          {showReactions && <ReactionPicker onSelect={(e) => { onReact(msg.id, e); setShowReactions(false); }} onClose={() => setShowReactions(false)} />}
          
          {msg.attachments?.map((att, i) => (
            <div key={i} className="mb-2 rounded-lg overflow-hidden border-2 border-black bg-gray-100 p-1">
               {att.type === 'video' ? (
                 <video src={att.url} controls className="w-full" />
               ) : (
                 <img src={att.url} alt="Attachment" className="w-full" />
               )}
            </div>
          ))}

          {msg.text && <p className="text-lg leading-tight whitespace-pre-wrap">{msg.text}</p>}
          
          {msg.audioData && (
             <button 
               onClick={(e) => { e.stopPropagation(); playAudio(msg); }} 
               className={`mt-2 flex items-center gap-2 px-3 py-1 rounded-full border-2 border-current font-bold text-sm ${isUser ? 'bg-white text-black' : 'bg-gray-100 text-black'}`}
             >
               {playingId === msg.id ? <Pause size={14}/> : <Volume2 size={14}/>} 
               {playingId === msg.id ? 'Playing...' : 'Listen'}
             </button>
          )}

          <ReactionBadge reactions={msg.reactions || []} />
       </div>
       {/* Timestamp moved OUTSIDE the bubble */}
       <span className={`text-xs absolute -bottom-5 ${isUser ? 'right-2' : 'left-2'} text-gray-500 font-bold`}>
            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
       </span>
    </div>
  );
};

const ChatMessageList = ({ messages, playAudio, playingId, chatEndRef, isTyping, onReact }: any) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-sketch-bg scroll-smooth">
      {messages.map((msg: Message) => (
        <MessageBubble 
          key={msg.id} 
          msg={msg} 
          isUser={msg.role === Role.USER} 
          playAudio={playAudio} 
          playingId={playingId}
          onReact={onReact}
        />
      ))}
      {isTyping && <TypingBubble />}
      <div ref={chatEndRef} />
    </div>
  );
};

const StudyView = ({ timer, setTimer, planner }: any) => {
  useEffect(() => {
    let interval: any;
    if (timer.isActive && timer.remaining > 0) {
      interval = setInterval(() => setTimer((t: any) => ({ ...t, remaining: t.remaining - 1 })), 1000);
    } else if (timer.remaining === 0 && timer.isActive) {
      playSound(SOUNDS.ALARM);
      setTimer((t: any) => ({ ...t, isActive: false }));
    }
    return () => clearInterval(interval);
  }, [timer.isActive, timer.remaining]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 p-4 bg-sketch-bg overflow-y-auto font-patrick">
      <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-2 bg-gray-200"><div className="h-full bg-black transition-all duration-1000" style={{ width: `${(timer.remaining / timer.duration) * 100}%` }}></div></div>
         <h2 className="text-xl font-bold mb-2 uppercase tracking-widest text-gray-500">{timer.label || 'Focus Timer'}</h2>
         <div className="text-6xl font-bold mb-4 font-mono">{formatTime(timer.remaining)}</div>
         <div className="flex justify-center gap-4">
            <button onClick={() => setTimer((t: any) => ({ ...t, isActive: !t.isActive }))} className="bg-black text-white px-6 py-2 rounded-full font-bold text-xl active:scale-95 transition-transform border-2 border-black">
              {timer.isActive ? 'Pause' : 'Start'}
            </button>
            <button onClick={() => setTimer((t: any) => ({ ...t, isActive: false, remaining: t.duration }))} className="bg-white border-2 border-black px-4 py-2 rounded-full font-bold text-xl active:scale-95 transition-transform">
              Reset
            </button>
         </div>
      </div>

      <h3 className="text-2xl font-bold mb-4 flex items-center gap-2"><Calendar /> Up Next</h3>
      <div className="space-y-3">
         {planner.filter((p: any) => !p.completed).slice(0, 3).map((item: any) => (
           <div key={item.id} className="bg-white border-2 border-black p-4 rounded-xl flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div>
                 <h4 className="font-bold text-lg">{item.title}</h4>
                 <p className="text-sm text-gray-500">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold border-2 border-black ${item.type === 'event' ? 'bg-yellow-200' : 'bg-blue-200'}`}>{item.type}</div>
           </div>
         ))}
         {planner.length === 0 && <p className="text-center text-gray-400 italic">Nothing planned. You're free!</p>}
      </div>
    </div>
  );
};

const LifeView = ({ subView, setSubView, planner, expenses, novels, wishlist, onDelete, onAdd }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');

  const openAdd = (type: string) => { setModalType(type); setIsModalOpen(true); };
  const getTitle = () => {
    switch(subView) {
      case 'planner': return 'Plans';
      case 'budget': return 'Expenses';
      case 'library': return 'Reading';
      case 'wishlist': return 'Wishes';
      default: return '';
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-sketch-bg font-patrick overflow-hidden">
       <div className="flex border-b-2 border-black bg-white overflow-x-auto shrink-0">
          {['planner', 'budget', 'library', 'wishlist'].map(t => (
            <button 
              key={t} 
              onClick={() => setSubView(t)} 
              className={`flex-1 py-3 px-4 font-bold text-lg capitalize whitespace-nowrap ${subView === t ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
            >
              {t}
            </button>
          ))}
       </div>

       <div className="flex-1 overflow-y-auto p-4 pb-20">
          {subView === 'planner' && (
             <div className="space-y-3">
               {planner.map((item: any) => (
                  <div key={item.id} className="bg-white border-2 border-black p-3 rounded-xl flex justify-between items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                     <div><p className="font-bold text-lg">{item.title}</p><p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString()}</p></div>
                     <button onClick={() => onDelete(item.id, 'planner')} className="text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
               ))}
             </div>
          )}
          {subView === 'budget' && (
            <div className="space-y-3">
              {expenses.map((item: any) => (
                 <div key={item.id} className="bg-white border-2 border-black p-3 rounded-xl flex justify-between items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div><p className="font-bold text-lg">{item.item}</p><p className="text-xs text-gray-500 capitalize">{item.category}</p></div>
                    <div className="flex items-center gap-3"><span className="font-bold text-green-600 font-mono">${item.amount}</span><button onClick={() => onDelete(item.id, 'budget')} className="text-red-500"><Trash2 size={18}/></button></div>
                 </div>
              ))}
            </div>
          )}
          {subView === 'library' && (
            <div className="grid grid-cols-2 gap-3">
              {novels.map((book: any) => (
                 <div key={book.id} className="bg-white border-2 border-black p-3 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                    <div><h4 className="font-bold leading-tight">{book.title}</h4><p className="text-xs text-gray-500 mb-2">{book.author}</p><p className="text-xs font-bold text-right">{book.currentChapter} / {book.totalChapters || '?'}</p></div>
                    <button onClick={() => onDelete(book.id, 'novels')} className="self-end text-red-500 mt-2"><Trash2 size={16}/></button>
                 </div>
              ))}
            </div>
          )}
          {subView === 'wishlist' && (
            <div className="space-y-3">
              {wishlist.map((item: any) => (
                 <div key={item.id} className="bg-white border-2 border-black p-3 rounded-xl flex justify-between items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div><p className="font-bold text-lg">{item.title}</p><p className="text-xs text-gray-500 capitalize">{item.type}</p></div>
                    <button onClick={() => onDelete(item.id, 'wishlist')} className="text-red-500 p-2"><Trash2 size={18}/></button>
                 </div>
              ))}
            </div>
          )}
       </div>

       <div className="absolute bottom-20 right-4 z-10">
          <button 
            onClick={() => openAdd(getTitle())} 
            className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:scale-95 transition-transform border-2 border-black"
          >
            <Plus size={32} />
          </button>
       </div>

       <AddModal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)} 
         type={modalType} 
         onSave={(data: any) => { onAdd(data); setIsModalOpen(false); }} 
       />
    </div>
  );
};


// --- Jeff Chat App (The Original App Logic) ---

const JeffChat = ({ onBack }: { onBack: () => void }) => {
  const [view, setView] = useState<'chat' | 'study' | 'life'>('chat');
  const [lifeSubView, setLifeSubView] = useState('planner');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [persona, setPersona] = useState<Persona>(Persona.FRIEND);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showProfile, setShowProfile] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showDoodle, setShowDoodle] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: 'Friend', bio: '- Likes journalling', topics: [], jeffStoryline: 'Just started journalling.' });
  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [novels, setNovels] = useState<NovelLog[]>([]);
  const [timer, setTimer] = useState<TimerState>({ isActive: false, duration: 0, remaining: 0, label: '' });
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    if (view === 'study') setPersona(Persona.TUTOR);
    if (view === 'chat') setPersona(Persona.FRIEND);
  }, [view]);

  // Load/Save Logic
  useEffect(() => {
    const load = (key: string, setter: any) => { const data = localStorage.getItem(key); if (data) setter(JSON.parse(data)); };
    load('jeff_msgs', setMessages); 
    load('jeff_bio', (d: any) => setUserProfile({ ...userProfile, bio: d.bio, jeffStoryline: d.jeffStoryline || "Just started journalling." })); 
    load('jeff_planner', setPlanner); load('jeff_expenses', setExpenses); load('jeff_wishlist', setWishlist); load('jeff_novels', setNovels);
    load('jeff_stories', setStories);
    window.addEventListener('online', () => setIsOffline(false)); window.addEventListener('offline', () => setIsOffline(true));
  }, []);

  useEffect(() => {
    localStorage.setItem('jeff_msgs', JSON.stringify(messages)); localStorage.setItem('jeff_bio', JSON.stringify({ bio: userProfile.bio, jeffStoryline: userProfile.jeffStoryline }));
    localStorage.setItem('jeff_planner', JSON.stringify(planner)); localStorage.setItem('jeff_expenses', JSON.stringify(expenses));
    localStorage.setItem('jeff_wishlist', JSON.stringify(wishlist)); localStorage.setItem('jeff_novels', JSON.stringify(novels));
    localStorage.setItem('jeff_stories', JSON.stringify(stories));
    if (view === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userProfile, planner, expenses, wishlist, novels, view, isTyping, stories]);

  // Proactive Logic
  useEffect(() => {
    if (isOffline || messages.length === 0) return;
    const checkInterval = setInterval(async () => {
      const timeSince = Date.now() - lastInteractionRef.current;
      if (timeSince > 30000 && !isTyping) {
        setIsTyping(true);
        const { text, toolCall } = await generateProactiveMessage(messages, userProfile);
        
        if (toolCall?.name === 'post_story') {
          const base64 = await generateImage(toolCall.args.doodlePrompt);
          if (base64) {
            const newStory: Story = { id: Date.now().toString(), imageUrl: `data:image/jpeg;base64,${base64}`, caption: toolCall.args.caption, timestamp: Date.now(), seen: false };
            setStories(prev => [newStory, ...prev]);
            playSound(SOUNDS.STORY_POP);
            const newStoryline = await updateJeffStoryline(toolCall.args.caption, userProfile.jeffStoryline);
            setUserProfile(prev => ({ ...prev, jeffStoryline: newStoryline }));
          }
          setIsTyping(false); lastInteractionRef.current = Date.now();
          return;
        }

        let attachment: Attachment | undefined;
        if (toolCall?.name === 'generate_doodle') {
           const base64 = await generateImage(toolCall.args.prompt);
           if (base64) attachment = { type: 'image', url: `data:image/jpeg;base64,${base64}`, base64: base64, mimeType: 'image/jpeg' };
        }

        const aiMsg: Message = { id: Date.now().toString(), role: Role.MODEL, text: text, timestamp: Date.now(), attachments: attachment ? [attachment] : undefined };
        setMessages(prev => [...prev, aiMsg]); playSound(SOUNDS.RECEIVE); setIsTyping(false); lastInteractionRef.current = Date.now();
      }
    }, 10000);
    return () => clearInterval(checkInterval);
  }, [messages, isOffline, userProfile]);

  const executeTool = async (name: string, args: any) => {
    switch (name) {
      case 'set_timer': setTimer({ isActive: true, duration: args.minutes * 60, remaining: args.minutes * 60, label: args.label || 'Study' }); return `Timer set for ${args.minutes} minutes.`;
      case 'generate_doodle': setIsTyping(true); const base64Img = await generateImage(args.prompt); if (base64Img) { const aiMsg: Message = { id: Date.now().toString(), role: Role.MODEL, text: "Here's a doodle!", timestamp: Date.now(), attachments: [{ type: 'image', url: `data:image/jpeg;base64,${base64Img}`, base64: base64Img, mimeType: 'image/jpeg' }] }; setMessages(prev => [...prev, aiMsg]); return "Sent doodle."; } return "Failed.";
      case 'post_story': const base64Story = await generateImage(args.doodlePrompt); if (base64Story) { const newStory: Story = { id: Date.now().toString(), imageUrl: `data:image/jpeg;base64,${base64Story}`, caption: args.caption, timestamp: Date.now(), seen: false }; setStories(prev => [newStory, ...prev]); playSound(SOUNDS.STORY_POP); const newStoryline = await updateJeffStoryline(args.caption, userProfile.jeffStoryline); setUserProfile(prev => ({ ...prev, jeffStoryline: newStoryline })); return "Posted story!"; } return "Failed.";
      case 'start_game': if (args.game === 'doodle_challenge') setShowDoodle(true); return `Started ${args.game}`;
      case 'add_planner_item': setPlanner(prev => [...prev, { id: Date.now().toString(), title: args.title, date: args.date || new Date().toISOString(), type: args.type, completed: false, notes: args.notes }]); return `Added ${args.title}`;
      case 'add_expense': setExpenses(prev => [...prev, { id: Date.now().toString(), item: args.item, amount: args.amount, category: args.category, date: new Date().toISOString() }]); return `Tracked expense.`;
      case 'manage_wishlist': if (args.action === 'add') { setWishlist(prev => [...prev, { id: Date.now().toString(), title: args.title, type: args.type, status: 'want', notes: args.details }]); return `Added to wishlist.`; } return 'Updated.';
      case 'update_novel_progress': setNovels(prev => { const idx = prev.findIndex(n => n.title === args.title); if (idx >= 0) { const updated = [...prev]; updated[idx] = { ...updated[idx], currentChapter: args.chapter, notes: args.gossip || updated[idx].notes }; return updated; } return [...prev, { id: Date.now().toString(), title: args.title, currentChapter: args.chapter, notes: args.gossip || '' }]; }); return `Updated progress.`;
      case 'react_to_message': playSound(SOUNDS.REACT); setMessages(prev => { const targetId = args.messageId || prev.filter(m => m.role === Role.USER).pop()?.id; if (!targetId) return prev; return prev.map(m => m.id === targetId ? { ...m, reactions: [...(m.reactions || []).filter(r => r.from !== Role.MODEL), { emoji: args.emoji, from: Role.MODEL }] } : m); }); return `Reacted.`;
      default: return "Tool not found.";
    }
  };

  const handleSendMessage = async (text: string, mood?: string, audioBase64?: string, attachment?: Attachment) => {
    if (!text.trim() && !audioBase64 && !attachment) return;
    playSound(SOUNDS.SEND); lastInteractionRef.current = Date.now();
    const userMsg: Message = { id: Date.now().toString(), role: Role.USER, text, timestamp: Date.now(), mood, audioData: audioBase64, attachments: attachment ? [attachment] : undefined };
    setMessages(prev => [...prev, userMsg]); setInputText(''); setShowMoods(false); setIsTyping(true);
    const response = await generateResponse(messages, text, persona, userProfile, isOffline, executeTool, attachment ? [attachment] : undefined);
    setIsTyping(false); playSound(SOUNDS.RECEIVE);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: Role.MODEL, text: response.text, timestamp: Date.now(), audioData: response.audioData };
    setMessages(prev => [...prev, aiMsg]);
    if (!isOffline && Math.random() > 0.7) { const newBio = await updateBestieBio([...messages, userMsg, aiMsg], userProfile.bio); setUserProfile(prev => ({ ...prev, bio: newBio })); }
    if (response.audioData) playAudio(aiMsg);
  };

  const playAudio = async (msg: Message) => {
    if (!msg.audioData) return; if (audioSourceRef.current) { audioSourceRef.current.stop(); setPlayingId(null); }
    if (playingId === msg.id) return;
    try { if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume(); const audioBuffer = await decodeAudioData(base64ToUint8Array(msg.audioData), audioContextRef.current); const source = audioContextRef.current.createBufferSource(); source.buffer = audioBuffer; source.connect(audioContextRef.current.destination); source.onended = () => setPlayingId(null); source.start(); audioSourceRef.current = source; setPlayingId(msg.id); } catch (e) { console.error(e); }
  };
  
  // Handlers for Audio Recording, manual add, games etc... (Shortened for brevity, logic same as before)
  const stopRecording = () => { setIsRecording(false); if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); if (recognitionRef.current) recognitionRef.current.stop(); };
  const handleVoiceInput = async () => { /* Same as before */ 
    if (isRecording) { stopRecording(); return; } setIsRecording(true); setInputText(''); audioChunksRef.current = [];
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); mediaRecorderRef.current = mediaRecorder; mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); }; mediaRecorder.start(); const recognition = new (window as any).webkitSpeechRecognition(); recognitionRef.current = recognition; recognition.continuous = true; recognition.lang = 'en-US'; recognition.onresult = (e: any) => setInputText(e.results[e.results.length -1][0].transcript); recognition.start();
    } catch (e) { console.error(e); setIsRecording(false); }
  };
  useEffect(() => { if (!isRecording && audioChunksRef.current.length > 0) { const blob = new Blob(audioChunksRef.current, {type:'audio/webm'}); const reader = new FileReader(); reader.readAsDataURL(blob); reader.onloadend = () => handleSendMessage(inputText, undefined, reader.result as string); audioChunksRef.current = []; } }, [isRecording]);

  return (
    <div className="flex flex-col h-full bg-sketch-bg">
      <GlobalHeader view={view} setView={setView} persona={persona} onToggleProfile={() => setShowProfile(true)} onToggleMusic={() => setShowMusic(!showMusic)} hasNewStory={stories.some(s => !s.seen)} onOpenStory={() => setViewingStory(true)} onBack={onBack} />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {view === 'chat' && <ChatMessageList messages={messages} playAudio={playAudio} playingId={playingId} chatEndRef={chatEndRef} isTyping={isTyping} onReact={(id: string, e: string) => setMessages(p => p.map(m => m.id === id ? { ...m, reactions: [...(m.reactions || []).filter(r => r.from !== Role.USER), { emoji: e, from: Role.USER }] } : m))} />}
        {view === 'study' && <StudyView timer={timer} setTimer={setTimer} planner={planner} />}
        {view === 'life' && <LifeView subView={lifeSubView} setSubView={setLifeSubView} planner={planner} expenses={expenses} novels={novels} wishlist={wishlist} onDelete={(id: string, type: string) => { if (type === 'planner') setPlanner(p => p.filter(x => x.id !== id)); if (type === 'budget') setExpenses(p => p.filter(x => x.id !== id)); if (type === 'novels') setNovels(p => p.filter(x => x.id !== id)); if (type === 'wishlist') setWishlist(p => p.filter(x => x.id !== id)); }} onBulkDelete={() => {}} onBulkComplete={() => {}} onAdd={(d: any) => { if (lifeSubView === 'planner') executeTool('add_planner_item', d); else if (lifeSubView === 'budget') executeTool('add_expense', d); else if (lifeSubView === 'library') executeTool('update_novel_progress', d); else if (lifeSubView === 'wishlist') executeTool('manage_wishlist', { ...d, action: 'add' }); }} />}
      </main>
      <ChatInputFooter inputText={inputText} setInputText={setInputText} onSendMessage={handleSendMessage} isRecording={isRecording} handleVoiceInput={handleVoiceInput} showMoods={showMoods} setShowMoods={setShowMoods} onGameClick={(g: string) => { if (g === 'doodle') setShowDoodle(true); else handleSendMessage(`Let's play ${g}`); }} />
      {showMusic && <MusicPlayer spotifyUrl={spotifyUrl} setSpotifyUrl={setSpotifyUrl} onPlay={(url) => { setSpotifyUrl(url); handleSendMessage(`Listening to: ${url}`); }} onClose={() => setShowMusic(false)} />}
      <JeffProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} profile={userProfile} stories={stories} />
      {viewingStory && <StoryViewer stories={stories} onClose={() => { setViewingStory(false); setStories(p => p.map(s => ({ ...s, seen: true }))); }} />}
      <DoodleCanvas isOpen={showDoodle} onClose={() => setShowDoodle(false)} onSend={(b64) => handleSendMessage("Check this!", undefined, undefined, { type: 'image', url: `data:image/jpeg;base64,${b64}`, base64: b64, mimeType: 'image/jpeg' })} />
    </div>
  );
};

// --- OS Container ---

const App = () => {
  const [currentApp, setCurrentApp] = useState<'home' | 'messages' | 'photos' | 'contacts' | 'phone' | 'active_chat'>('home');
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  useEffect(() => {
    const handleResize = () => { if (window.visualViewport) setViewportHeight(`${window.visualViewport.height}px`); };
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', handleResize); handleResize(); }
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 w-full bg-black overflow-hidden" style={{ height: viewportHeight }}>
      <div className="w-full h-full bg-white relative overflow-hidden font-patrick">
        {currentApp === 'home' && <HomeScreen onOpenApp={setCurrentApp} />}
        {currentApp === 'messages' && <MessageList onSelectChat={() => setCurrentApp('active_chat')} />}
        {currentApp === 'photos' && <PhotosApp onBack={() => setCurrentApp('home')} />}
        {currentApp === 'contacts' && <ContactsApp onBack={() => setCurrentApp('home')} onChat={() => setCurrentApp('active_chat')} />}
        {currentApp === 'phone' && <PhoneApp onBack={() => setCurrentApp('home')} />}
        {currentApp === 'active_chat' && <JeffChat onBack={() => setCurrentApp('messages')} />}
        
        {/* Sketchy Home Bar */}
        {currentApp !== 'home' && (
          <div 
             className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-2 bg-black rounded-full opacity-50 cursor-pointer active:scale-90 transition-transform"
             onClick={() => setCurrentApp('home')}
          />
        )}
      </div>
    </div>
  );
};

export default App;
