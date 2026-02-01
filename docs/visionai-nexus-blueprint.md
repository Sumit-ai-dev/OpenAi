# VisionAI Nexus — Architecture Blueprint for Codex AI

**Purpose:** This document defines the WHAT and WHY, not the HOW or WHERE. Codex AI should use this to create a scalable, modular implementation in its own optimal structure.

**Note:** This is a *concept blueprint*. To ship in a hackathon window, we should prioritize a smaller MVP and keep the architecture thin. The sections below include recommended scope cuts, a phased build plan, and a minimal repo skeleton to keep complexity under control.

## 🎯 System Overview

**What we’re building:** An AI-powered vision assistant that helps people with low vision navigate through voice interaction, computer vision, and spatial audio.

**Core concept**

User speaks → AI listens (Whisper)
             ↓
AI sees → Camera captures scene (GPT-4o Vision analyzes)
             ↓
AI responds → Natural language description
             ↓
AI guides → Spatial audio from object direction (TTS + 3D positioning)

**Key principle:** Multimodal intelligence in a continuous feedback loop.

## ✅ MVP Recommendation (Hackathon-Friendly)
**Goal:** Deliver a compelling end-to-end demo in hours, not days.

**Keep** (MVP must-have)
- **Push-to-talk voice capture** (no continuous listening)
- **Single-frame capture** (camera still frame)
- **One query type** to start: `full_scene`
- **Basic TTS** (no urgency variants at first)
- **Simple spatial audio** (left/center/right panning only)
- **Tiny cache** (TTL 5s, in-memory)

**Defer** (nice-to-have after demo works)
- Multi-command routing
- OCR/Read text
- Hazard-specific urgency voices
- Advanced HRTF/3D audio
- Cost tracking dashboards

## 🧱 Minimal Repo Skeleton (Suggested)
```
visionai-nexus/
  apps/
    web/                 # Frontend UI (React or Vanilla)
  services/
    api/                 # Backend API (FastAPI or Express)
  packages/
    core/                # Shared types & utilities
  docs/
    visionai-nexus-blueprint.md
```

**Lean alternative** (single app):
```
visionai-nexus/
  app/
    ui/
    api/
    shared/
```

## 🧭 Phased Build Plan (Win Strategy)
1. **Phase 1 — “It Works” (2–4 hours)**  
   - Record audio → Whisper → text  
   - Capture image → GPT-4o Vision → description  
   - TTS speaks description (no spatialization yet)
2. **Phase 2 — “It Feels Magical” (2–3 hours)**  
   - Parse clock positions  
   - Apply left/center/right panning  
   - Add short safety-first prompt template
3. **Phase 3 — “Polish + Story” (1–2 hours)**  
   - Accessible UI (contrast + large buttons)  
   - Demo script + short video  
   - README w/ run commands + demo steps

## 🏗️ Architectural Layers (Conceptual)

### Layer 1: Input Management
**Responsibility:** Capture user intent and environmental data.

**Components needed**

**Voice Capture Interface**
- Accepts audio input (microphone or uploaded file)
- Should support streaming for real-time feel
- Handles push-to-talk mechanism
- Returns audio blob/buffer

**Camera Interface**
- Captures video frames from device camera
- Should provide single-frame capture on demand
- Converts frames to base64 or binary format
- Returns image data ready for AI processing

**Interface contract**
```
VoiceCapture {
  method: startRecording()
  method: stopRecording()
  returns: audioBlob
}
CameraCapture {
  method: captureFrame()
  method: startPreview()
  returns: imageData (base64 or binary)
}
```

### Layer 2: AI Brain (Processing Core)
**Responsibility:** Transform raw inputs into meaningful understanding.

**Components needed**

**Speech-to-Text Processor**
- Integrates OpenAI Whisper API
- Takes audio blob
- Returns transcribed text
- Should handle errors gracefully (network failure, invalid audio)

**Interface**
```
SpeechToText {
  method: transcribe(audioBlob)
  returns: { text: string, confidence: number }
}
```

**Vision Analyzer**
- Integrates OpenAI GPT-4o Vision API
- Takes image + contextual prompt
- Returns structured scene description
- Should use different prompts for different query types

**Interface**
```
VisionAnalyzer {
  method: analyzeScene(imageData, queryType)
  queryTypes: ["full_scene", "forward_only", "read_text", "identify_hazards"]
  returns: {
    description: string,
    objects: Array<{name, position, distance, isHazard}>,
    confidence: number
  }
}
```

**Command Router**
- Interprets user voice commands
- Routes to appropriate processing function
- Maps natural language to actions

**Command mapping**
- "What do you see?" → queryType: "full_scene"
- "What’s ahead?" → queryType: "forward_only"
- "Read this" → queryType: "read_text"
- "Any dangers?" → queryType: "identify_hazards"

**Interface**
```
CommandRouter {
  method: parseCommand(text)
  returns: { action: string, queryType: string, parameters: object }
}
```

**Prompt Manager**
- Stores and manages GPT-4o Vision prompts
- Each query type has optimized prompt template
- Should support prompt versioning/A-B testing

**Prompt templates**
```
FULL_SCENE_PROMPT = """
Analyze this scene for someone with low vision.
Use CLOCK POSITIONS:
- 12 o'clock = straight ahead
- 3 o'clock = right
- 9 o'clock = left
Provide:
1. Main objects with clock position + distance in feet
2. Any hazards (stairs, obstacles) - mark URGENT
3. Overall context (room type, indoor/outdoor)
Format: "Object at [position], [distance] [direction]. CAUTION: [hazard]."
Be concise, prioritize safety.
"""
FORWARD_ONLY_PROMPT = """
Focus ONLY on what's directly ahead (11-1 o'clock range).
Identify obstacles, hazards, clear path.
Provide distances in feet.
Use urgent language for immediate dangers (<5 feet).
"""
OCR_PROMPT = """
Read ALL visible text in this image.
Include signs, labels, documents, screens.
Read exactly as it appears.
"""
```

### Layer 3: Audio Engine (Output Generation)
**Responsibility:** Convert AI understanding into immersive spatial audio.

**Components needed**

**Text-to-Speech Generator**
- Integrates OpenAI TTS API
- Converts text to natural speech
- Should support urgency variations (different voice/speed)

**Interface**
```
TextToSpeech {
  method: synthesize(text, urgencyLevel)
  urgencyLevels: ["normal", "important", "urgent"]
  returns: audioBlob
}
```

**Spatial Audio Processor**
- Positions audio in 3D space based on object location
- Uses Web Audio API (browser) or equivalent
- Converts angle + distance to 3D coordinates

**Interface**
```
SpatialAudio {
  method: playWithPosition(audioBlob, angle, distance, urgency)
  angle: -180 to 180 degrees (0 = ahead, 90 = right, -90 = left)
  distance: in feet
  returns: audioHandle (can be stopped)
}
```

**Position Calculator**
- Converts clockface positions to angles
- Estimates distance categories
- Calculates 3D audio coordinates

**Interface**
```
PositionCalculator {
  method: clockToAngle(clockPosition)
    // "3 o'clock" → 90 degrees
    // "12 o'clock" → 0 degrees
    // "9 o'clock" → -90 degrees

  method: angleToSpatialCoords(angle, distance)
    // Returns {x, y, z} for Web Audio API
}
```

### Layer 4: Intelligence Cache
**Responsibility:** Optimize API costs and improve response time.

**Components needed**

**Scene Cache Manager**
- Stores recent scene analysis
- TTL (Time To Live): 5 seconds default
- Enables follow-up questions without re-analysis

**Interface**
```
SceneCache {
  method: get(cacheKey)
  method: set(cacheKey, sceneData, ttl)
  method: invalidate(cacheKey)
  returns: cachedData or null
}
```

**Cost Tracker**
- Monitors API usage
- Estimates remaining budget
- Warns when approaching limits

**Interface**
```
CostTracker {
  method: logAPICall(apiType, tokensUsed)
  method: getCurrentSpend()
  method: estimateRemainingBudget()
}
```

### Layer 5: API Gateway (External Integration)
**Responsibility:** Handle all OpenAI API communications.

**Components needed**

**OpenAI Client Wrapper**
- Centralizes all OpenAI API calls
- Handles authentication
- Implements retry logic
- Manages rate limiting

**Interface**
```
OpenAIClient {
  method: callWhisper(audioBlob)
  method: callVision(imageData, prompt)
  method: callTTS(text, voice, speed)

  // Error handling
  onError: (error) => handleGracefully()
  retryPolicy: exponentialBackoff(maxRetries=3)
}
```

**Response Formatter**
- Converts OpenAI raw responses to app format
- Extracts relevant fields
- Validates response structure

**Interface**
```
ResponseFormatter {
  method: formatVisionResponse(rawResponse)
    // Extract description, parse objects, identify hazards

  method: formatWhisperResponse(rawResponse)
    // Extract text, confidence
}
```

## 🔄 Data Flow (End-to-End Journey)

**Scenario:** User asks “What do you see?”

1. **Input layer**
   - User presses "Record" button
   - `VoiceCapture.startRecording()`
   - User speaks: “What do you see?”
   - `VoiceCapture.stopRecording()` → `audioBlob`
2. **AI brain — speech**
   - `SpeechToText.transcribe(audioBlob)`
   - OpenAI Whisper API call
   - Returns: “What do you see?”
3. **AI brain — routing**
   - `CommandRouter.parseCommand("What do you see?")`
   - Returns: `{ action: "analyze", queryType: "full_scene" }`
4. **AI brain — vision**
   - Check `SceneCache.get("recent_scene")`
   - If cached and fresh → use cached data (save API cost)
   - If not cached:
     - `CameraCapture.captureFrame()` → `imageData`
     - `PromptManager.getPrompt("full_scene")`
     - `VisionAnalyzer.analyzeScene(imageData, "full_scene")`
     - OpenAI GPT-4o Vision API call
     - Returns: “Kitchen. Coffee mug at 2 o'clock, 3 feet right..."
     - `SceneCache.set("recent_scene", result, ttl=5)`
5. **Audio engine — synthesis**
   - `TextToSpeech.synthesize(description, urgency="normal")`
   - OpenAI TTS API call
   - Returns: `audioBlob`
6. **Audio engine — spatial**
   - Parse description for object positions
   - For each object:
     - `PositionCalculator.clockToAngle("2 o'clock")` → `60°`
     - `SpatialAudio.playWithPosition(audioBlob, 60, 3, false)`
   - User hears audio from right speaker (indicating 2 o'clock position)
7. **Complete**
   - `CostTracker.logAPICall("whisper", 10s)`
   - `CostTracker.logAPICall("vision", 1 image)`
   - `CostTracker.logAPICall("tts", 50 tokens)`

## 🎨 Feature Specifications

### Feature 1: Voice Command System
**What it must do**
- Continuous listening option OR push-to-talk
- Support multiple command variations:
  - “What do you see?” / “Describe scene” / “Tell me what’s here”
  - “What’s ahead?” / “What’s in front?” / “Clear path?”
  - “Read this” / “Read the sign” / “What does this say?”

**How it should behave**
- Show visual indicator when listening (e.g., pulsing mic icon)
- Provide haptic/audio feedback when recording starts/stops
- Handle silence gracefully (don’t send empty audio to API)
- Show transcription to user for confirmation

**Edge cases to handle**
- Background noise (filter using Whisper’s noise robustness)
- User interruption (stop current audio, process new command)
- Network failure (cache command, retry when online)

### Feature 2: Scene Understanding
**What it must do**
- Analyze camera frame for objects, people, text, hazards
- Provide clockface positioning (12=ahead, 3=right, 9=left)
- Estimate distances (close <3ft, medium 3–10ft, far >10ft)
- Identify hazards (stairs, obstacles, vehicles, drop-offs)
- Describe overall context (indoor/outdoor, room type)

**How it should behave**
- Prioritize safety information first (hazards in response)
- Use natural language (conversational, not robotic)
- Limit to 5 most important objects (avoid overwhelming user)
- Update when scene changes significantly

**Edge cases to handle**
- Empty scene (no objects) → “Clear area, no obstacles detected”
- Poor lighting → “Scene is dark, unable to analyze clearly”
- Complex scene (50+ objects) → Filter to most relevant

### Feature 3: Spatial Audio Guidance
**What it must do**
- Play audio from direction of described object
- Volume corresponds to distance (closer = louder)
- Urgent alerts override normal descriptions
- Support stereo or 3D HRTF audio

**How it should behave**
- Object at 3 o'clock → louder right speaker
- Object at 9 o'clock → louder left speaker
- Object at 12 o'clock → balanced center
- Hazards → interrupt current audio, play immediately

**Edge cases to handle**
- Multiple simultaneous objects → queue or prioritize
- User has mono audio setup → use tone/beep patterns instead
- Headphones vs speakers → adjust spatial algorithm

### Feature 4: Smart Caching
**What it must do**
- Cache scene analysis for 5 seconds
- Reuse for follow-up questions (“How far is the mug?” after “What do you see?”)
- Invalidate when camera moves significantly
- Track cache hit rate

**How it should behave**
- User asks “What do you see?” → analyze + cache
- User asks “How far is the coffee mug?” within 5s → use cache (no API call)
- After 5s → cache expires, next question triggers new analysis
- Camera moves → detect motion, invalidate cache

**Edge cases to handle**
- Cache key collision → use timestamp + queryType
- Memory limits → LRU eviction (least recently used)

### Feature 5: Accessible UI
**What it must do**
- High contrast mode (black bg, white text, yellow accents)
- Large touch targets (minimum 44x44px buttons)
- Keyboard navigation support
- Screen reader compatible
- Visual + audio + haptic feedback

**How it should behave**
- All functions accessible via voice OR touch
- Status always visible (listening, analyzing, speaking)
- Simple 3-button interface: Record, Capture, Settings
- Settings: speech rate, volume, cache duration

**Edge cases to handle**
- User has partial vision → high contrast + large text
- User has no vision → full voice control + screen reader
- Motor impairments → large buttons, sticky keys option

## 🔌 API Integration Patterns

### OpenAI Whisper Integration
**Endpoint:** `https://api.openai.com/v1/audio/transcriptions`

**Request pattern**
```
POST /v1/audio/transcriptions
Headers:
  Authorization: Bearer {OPENAI_API_KEY}
  Content-Type: multipart/form-data
Body:
  file: {audioBlob} (wav, mp3, m4a)
  model: "whisper-1"
  language: "en" (optional, auto-detect if omitted)
  response_format: "json"
```

**Response pattern**
```
{
  "text": "What do you see?"
}
```

**Error handling**
- 401 Unauthorized → Invalid API key, show error to user
- 400 Bad Request → Invalid audio format, ask user to try again
- 429 Rate Limit → Wait and retry with exponential backoff
- 500 Server Error → Fallback to cached responses if available

### OpenAI GPT-4o Vision Integration
**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Request pattern**
```
POST /v1/chat/completions
Headers:
  Authorization: Bearer {OPENAI_API_KEY}
  Content-Type: application/json
Body:
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "{SCENE_ANALYSIS_PROMPT}"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,{BASE64_IMAGE}"
          }
        }
      ]
    }
  ],
  "max_tokens": 300,
  "temperature": 0.5
}
```

**Response pattern**
```
{
  "choices": [
    {
      "message": {
        "content": "Kitchen. Coffee mug at 2 o'clock, 3 feet on your right..."
      }
    }
  ]
}
```

**Optimization**
- Resize images to max 1024x1024 (reduces cost, maintains quality)
- Use JPEG compression (smaller than PNG)
- Set max_tokens wisely (300 is enough for description)
- Lower temperature (0.5) for consistent outputs

### OpenAI TTS Integration
**Endpoint:** `https://api.openai.com/v1/audio/speech`

**Request pattern**
```
POST /v1/audio/speech
Headers:
  Authorization: Bearer {OPENAI_API_KEY}
  Content-Type: application/json
Body:
{
  "model": "tts-1",
  "input": "{TEXT_TO_SPEAK}",
  "voice": "alloy",
  "speed": 1.0
}
```

**Response:** Binary audio data (MP3).

**Voice selection**
- “alloy” → Normal descriptions (warm, neutral)
- “nova” → Urgent alerts (clear, assertive)
- “echo” → Alternative (male voice if user prefers)

## 📊 Scalability Principles
1. **Stateless design**
   - Each request is independent
   - No server-side session storage required
   - Easy to horizontally scale
2. **Modular components**
   - Each component has single responsibility
   - Components communicate via well-defined interfaces
   - Easy to swap implementations (e.g., change TTS provider)
3. **Configuration-driven**
   - All settings externalized (API keys, model names, timeouts)
   - Environment variables for deployment flexibility
   - Feature flags for A/B testing
4. **Graceful degradation**
   - If Vision API fails → use cached scene or fallback message
   - If TTS fails → use browser’s native speech synthesis
   - If Whisper fails → allow text input as backup
5. **Cost-aware**
   - Cache aggressively (90% cost reduction)
   - Batch similar requests when possible
   - Monitor and alert on budget thresholds

## 🔧 Extensibility Hooks

### Future feature: Face Recognition
**Where to add**
- New component in AI Brain: `FaceRecognizer`
- New query type: `identify_people`
- Privacy-first: local encrypted storage of faces

**Interface**
```
FaceRecognizer {
  method: detectFaces(imageData)
  method: recognizeFace(faceData)
  method: registerFace(name, faceData)
  returns: Array<{name, confidence, position}>
}
```

### Future feature: Navigation Mode
**Where to add**
- New component: `NavigationPlanner`
- Continuous scene updates every 2 seconds
- Turn-by-turn guidance

**Interface**
```
NavigationPlanner {
  method: setDestination(objectName)
  method: getNextStep()
  returns: {direction, distance, instruction}
}
```

### Future feature: Multi-Language
**Where to add**
- Update Whisper: add language parameter
- Update TTS: add language parameter
- Update prompts: translate prompt templates

## 🌐 Similar Repos for Reference (Architecture Patterns)
1. **Voice Assistant pattern** — `openai/openai-realtime-console`
   - Shows clean separation: audio capture → API → response
   - Good error handling patterns
   - WebRTC audio streaming (can adapt for Whisper)

2. **Vision Analysis pattern** — `openai/gpt-4-vision-preview`
   - Demonstrates GPT-4o Vision integration
   - Prompt engineering best practices
   - Image preprocessing techniques

3. **Spatial Audio pattern** — `mdn/webaudio-examples`
   - Web Audio API implementation
   - 3D panner positioning
   - Audio graph architecture

4. **Full-Stack Voice App pattern** — `vercel/ai-chatbot`
   - Modern FastAPI/Next.js architecture
   - Streaming responses
   - Real-time updates

### ✅ Practical Skeleton Picks (if we need to move faster)
If time is tight, use one of these as a **starting skeleton** and adapt the components:
- **Next.js starter** for fast UI + API routes in one repo
- **FastAPI + simple React** if the team prefers Python and modular APIs
- **Vercel AI Chatbot** (for streaming + clean UI patterns)

## ✅ Success Criteria for Codex AI
A successful implementation should:

- **Work end-to-end**
  - User can speak → get scene description → hear spatial audio
  - All 3 OpenAI APIs integrated correctly
  - No manual intervention needed

- **Be modular**
  - Components can be tested independently
  - Easy to swap implementations (e.g., use different TTS)
  - Clear separation of concerns

- **Handle errors gracefully**
  - Network failures don’t crash app
  - Invalid inputs show helpful messages
  - Fallbacks available for each feature

- **Be cost-efficient**
  - Caching reduces API calls by 80%+
  - Images resized before sending
  - Tracks spending in real-time

- **Be accessible**
  - High contrast UI
  - Keyboard navigable
  - Screen reader compatible
  - Works with assistive tech

- **Be extensible**
  - Adding new commands is straightforward
  - New features don’t break existing ones
  - Configuration-driven behavior

## 🎯 Codex AI Build Instructions
Use this blueprint to:
- Create optimal file/folder structure (your decision)
- Implement each component with its specified interface
- Connect components following data flow diagram
- Add error handling at each integration point
- Implement caching for cost optimization
- Build accessible UI following guidelines

**Tech stack flexibility**
- Backend: Python/FastAPI, Node.js/Express, or your choice
- Frontend: React, Vue, vanilla JS, or your choice
- Database: Redis, SQLite, in-memory, or your choice

The blueprint specifies **WHAT** to build, not **HOW** or **WHERE**.

You decide the optimal implementation! 🚀

This architecture enables:
- ✅ Rapid development (24 hours achievable)
- ✅ Easy debugging (modular components)
- ✅ Simple extensions (add features without rewrites)
- ✅ Cost efficiency (smart caching)
- ✅ Production readiness (error handling, monitoring)
