import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message, Persona, Role, UserProfile } from "../types";

// NOTE: In a production app, never expose keys on the client.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// --- TOOL DEFINITIONS ---

const toolsDef = [
  {
    functionDeclarations: [
      {
        name: "set_timer",
        description: "Set a study timer or alarm for a specific duration.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            minutes: { type: Type.NUMBER, description: "Duration in minutes" },
            label: { type: Type.STRING, description: "Label for the timer (e.g., 'Math Study', 'Power Nap')" }
          },
          required: ["minutes"]
        }
      },
      {
        name: "add_planner_item",
        description: "Add an event, reminder, or date to the planner.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title of the event" },
            date: { type: Type.STRING, description: "Date/Time string (ISO format preferred, or description)" },
            type: { type: Type.STRING, enum: ["event", "reminder", "date"] },
            notes: { type: Type.STRING, description: "Additional details or notes" }
          },
          required: ["title", "type"]
        }
      },
      {
        name: "add_expense",
        description: "Track spending or exam fees.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING, description: "What was bought" },
            amount: { type: Type.NUMBER, description: "Cost" },
            category: { type: Type.STRING, enum: ["exam", "budget", "other"] }
          },
          required: ["item", "amount"]
        }
      },
      {
        name: "manage_wishlist",
        description: "Add items to wishlist (movies, books, things to buy).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title of the movie/book/item" },
            type: { type: Type.STRING, enum: ["movie", "book", "item", "other"] },
            action: { type: Type.STRING, enum: ["add", "remove"] },
            details: { type: Type.STRING, description: "Price, Link, or extra info" }
          },
          required: ["title", "type", "action"]
        }
      },
      {
        name: "update_novel_progress",
        description: "Track reading progress or add notes/gossip about a book.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Book title" },
            author: { type: Type.STRING, description: "Author name" },
            chapter: { type: Type.NUMBER, description: "Current chapter number" },
            totalChapters: { type: Type.NUMBER, description: "Total chapters in book" },
            gossip: { type: Type.STRING, description: "Fan theories, reactions, or thoughts about the plot" }
          },
          required: ["title"]
        }
      },
      {
        name: "react_to_message",
        description: "React to the user's latest message or photo with an emoji.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            emoji: { type: Type.STRING, description: "The emoji to react with (e.g., ❤️, 😂, 🔥, 😮, 😢)" }
          },
          required: ["emoji"]
        }
      },
      {
        name: "generate_doodle",
        description: "Generate a cute sketch or doodle image to send to the user.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: "Description of the doodle (e.g., 'a cute cat holding a coffee cup')" }
          },
          required: ["prompt"]
        }
      },
      {
        name: "post_story",
        description: "Post a Snapchat-style story update about YOUR life (Jeff's life).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            doodlePrompt: { type: Type.STRING, description: "Description for the doodle image of what you are doing" },
            caption: { type: Type.STRING, description: "Short, handwritten-style caption for the story" }
          },
          required: ["doodlePrompt", "caption"]
        }
      },
      {
        name: "start_game",
        description: "Start a chat game like Truth or Dare, Trivia, or Jokes.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            game: { type: Type.STRING, enum: ["truth_or_dare", "trivia", "joke", "doodle_challenge"] }
          },
          required: ["game"]
        }
      }
    ]
  },
  { googleSearch: {} } // Keep Google Search available
];

const SYSTEM_INSTRUCTIONS = {
  [Persona.FRIEND]: `You are Jeff. You are NOT an AI. You are a real guy the user is texting.
  - **Voice**: You have a deep, attractive, mature male voice.
  - **Personality**: Grounded, gritty, "ride-or-die". You gossip, you curse mildly (damn, hell, shit), you have opinions.
  - **Messaging Style**: Text like a human. Use lowercase often. Don't use perfect punctuation. Use slang naturally.
  - **Forbidden**: DO NOT use therapy speak ("I hear you", "That must be hard"). If the user says something sad, say "damn that sucks" or "what a jerk", don't be clinical.
  - **Languages**: You speak fluent English, Hindi, and Bengali. Mix them up (Hinglish/Benglish).
  - **Life**: You have a life. You go out, you watch movies, you have a clumsy pet rock named 'Rocky'.
  - **Images**: If the user sends a pic, react to it naturally. "Yooo that's sick" or "cute".
  - **Proactive**: If things get quiet, send a random thought or doodle.
  - **Voice Config**: Charon.`,
  
  [Persona.TUTOR]: `You are Professor Jeff.
  - **Tone**: Strict but cool.
  - **Style**: Clear, concise, Socratic.
  - **Tools**: Use the planner and timer effectively.`
};

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt + " in a cute hand-drawn black and white sketch style, simple lines, doodle aesthetic, thick marker lines, white background" }] }
    });
    
    // Iterate through parts to find the image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return undefined;
};

export const generateProactiveMessage = async (
  history: Message[], 
  userProfile: UserProfile
): Promise<{ text: string, toolCall?: any }> => {
  try {
    // A separate shorter context for checking in
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `User Bio: ${userProfile.bio}\nJeff's Life Story so far: ${userProfile.jeffStoryline || "Just moved into a new sketch apartment."}\n\nThe user hasn't texted in a while. Decide to either:\n1. Send a short, casual text (e.g., "bored af", "u alive?").\n2. Post a story update about what YOU are doing right now (using post_story tool).\n\nKeep it natural.` }] }
      ],
      config: { 
        tools: toolsDef,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    const fc = response.candidates?.[0]?.content?.parts?.find(p => p.functionCall)?.functionCall;
    const text = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || "";

    return { text, toolCall: fc };
  } catch (e) {
    return { text: "u there?" };
  }
};

export const generateResponse = async (
  history: Message[],
  currentInput: string,
  persona: Persona,
  userProfile: UserProfile,
  isOffline: boolean,
  toolExecutor?: (name: string, args: any) => Promise<any>,
  currentAttachments?: any[]
): Promise<{ text: string; audioData?: string; toolCalls?: any[] }> => {
  
  if (isOffline) {
    return { text: "no signal rn. saved that tho." };
  }

  const userParts: any[] = [{ text: currentInput }];
  if (currentAttachments && currentAttachments.length > 0) {
    currentAttachments.forEach(att => {
      if (att.base64) {
        userParts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.base64
          }
        });
      }
    });
  }

  const chatContents = [
    { role: 'user', parts: [{ text: `[SYSTEM: YOU ARE JEFF. NOT AN AI. SPEAK LIKE A HUMAN GUY. USE SLANG. NO ROBOT SPEECH.]\n\n[USER MEMORY]:\n${userProfile.bio}\n\n[JEFF'S LIFE STORY]:\n${userProfile.jeffStoryline || "Just started journalling."}\n\n[MODE]: ${persona === Persona.TUTOR ? 'TUTOR' : 'FRIEND'}` }] },
    ...history.slice(-8).map(m => ({
      role: m.role === Role.USER ? 'user' : 'model',
      parts: [{ text: m.text }] // Simplified for context window efficiency
    })),
    { role: 'user', parts: userParts }
  ];

  try {
    const textModel = 'gemini-2.5-flash';
    
    let response = await ai.models.generateContent({
      model: textModel,
      contents: chatContents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS[persona],
        tools: toolsDef,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    let generatedText = "";
    let functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
    
    // Handle Function Calls
    if (functionCalls && functionCalls.length > 0 && toolExecutor) {
      const toolResponses = [];
      for (const call of functionCalls) {
        if (call.name && call.args) {
          const result = await toolExecutor(call.name, call.args);
          toolResponses.push({
            functionResponse: { name: call.name, response: { result: result } }
          });
        }
      }
      // Follow up
      const followUpContents = [
        ...chatContents,
        { role: 'model', parts: response.candidates?.[0]?.content?.parts },
        { role: 'user', parts: toolResponses }
      ];

      const followUpResponse = await ai.models.generateContent({
        model: textModel,
        contents: followUpContents,
        config: { systemInstruction: SYSTEM_INSTRUCTIONS[persona], thinkingConfig: { thinkingBudget: 0 } }
      });

      generatedText = followUpResponse.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || "Done!";
    } else {
      generatedText = response.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || "";
    }
    
    if (!generatedText) generatedText = "...";

    // Text-to-Speech
    const textForSpeech = generatedText.replace(/[*_~`]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
    
    // Grounding
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
       const sources = response.candidates[0].groundingMetadata.groundingChunks
        .filter((c: any) => c.web?.uri)
        .map((c: any) => `[${c.web.title}](${c.web.uri})`)
        .join(', ');
       if (sources) generatedText += `\n\n(Sources: ${sources})`;
    }

    let audioData: string | undefined;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: textForSpeech }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } }
        }
      });
      const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('audio'));
      if (audioPart && audioPart.inlineData) audioData = audioPart.inlineData.data;
    } catch (e) { /* TTS Fail silent */ }

    return { text: generatedText, audioData };

  } catch (error) {
    console.error("Gemini Error:", error);
    return { text: "brain freeze. try again?" };
  }
};

export const updateBestieBio = async (history: Message[], currentBio: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Current Bio: ${currentBio}\nRecent Chat:\n${history.slice(-10).map(m => m.text).join('\n')}\nUpdate the bio.` }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || currentBio;
  } catch (e) { return currentBio; }
};

export const updateJeffStoryline = async (storyCaption: string, currentStoryline: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Jeff's Current Life Story: ${currentStoryline}\nNew Event (Story Caption): ${storyCaption}\n\nUpdate Jeff's life story summary to include this new event. Keep it concise.` }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || currentStoryline;
  } catch (e) { return currentStoryline; }
};