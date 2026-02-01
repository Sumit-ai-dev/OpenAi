const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start-record");
const stopBtn = document.getElementById("stop-record");
const captureBtn = document.getElementById("capture-frame");
const analyzeBtn = document.getElementById("analyze");
const transcriptEl = document.getElementById("transcript");
const descriptionEl = document.getElementById("description");
const audioEl = document.getElementById("audio");
const videoEl = document.getElementById("preview");
const canvasEl = document.getElementById("snapshot");

let mediaRecorder;
let audioChunks = [];
let lastAudioBase64 = null;
let lastImageBase64 = null;

const setStatus = (text) => {
  statusEl.textContent = text;
};

const initCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    videoEl.srcObject = stream;
  } catch (error) {
    setStatus("Camera access denied.");
  }
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const base64 = await blobToBase64(blob);
      lastAudioBase64 = base64;
      transcriptEl.textContent = "Transcribing...";
      await transcribeAudio();
      analyzeBtn.disabled = !(lastAudioBase64 && lastImageBase64);
    };

    mediaRecorder.start();
    setStatus("Recording...");
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    setStatus("Microphone access denied.");
  }
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    setStatus("Processing audio...");
  }
  stopBtn.disabled = true;
  startBtn.disabled = false;
};

const captureFrame = () => {
  if (!videoEl.videoWidth) {
    return;
  }
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const ctx = canvasEl.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  lastImageBase64 = canvasEl.toDataURL("image/jpeg", 0.8).split(",")[1];
  setStatus("Frame captured.");
  analyzeBtn.disabled = !(lastAudioBase64 && lastImageBase64);
};

const transcribeAudio = async () => {
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64: lastAudioBase64 }),
    });
    const data = await response.json();
    transcriptEl.textContent = data.text || data.error || "Transcription failed";
    setStatus("Audio ready.");
  } catch (error) {
    transcriptEl.textContent = "Transcription failed.";
  }
};

const analyzeScene = async () => {
  if (!lastImageBase64) {
    return;
  }
  descriptionEl.textContent = "Analyzing...";
  setStatus("Analyzing scene...");
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: lastImageBase64, queryType: "full_scene" }),
    });
    const data = await response.json();
    descriptionEl.textContent = data.description || data.error || "No description.";
    await speakDescription(data.description || "");
    setStatus("Analysis complete.");
  } catch (error) {
    descriptionEl.textContent = "Analysis failed.";
  }
};

const speakDescription = async (text) => {
  if (!text) {
    return;
  }
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, urgency: "normal" }),
    });
    const data = await response.json();
    if (!data.audioBase64) {
      return;
    }
    const audioBlob = base64ToBlob(data.audioBase64, "audio/mpeg");
    const audioUrl = URL.createObjectURL(audioBlob);
    audioEl.src = audioUrl;
    await playSpatial(audioUrl, text);
  } catch (error) {
    console.error(error);
  }
};

const playSpatial = async (audioUrl, text) => {
  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const buffer = await response.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(buffer);
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  const panner = audioContext.createStereoPanner();
  panner.pan.value = extractPan(text);
  source.connect(panner).connect(audioContext.destination);
  source.start(0);
};

const extractPan = (text) => {
  const right = /\b(2|3|4) o'clock\b/i;
  const left = /\b(8|9|10) o'clock\b/i;
  if (right.test(text)) return 0.6;
  if (left.test(text)) return -0.6;
  return 0;
};

const blobToBase64 = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });

const base64ToBlob = (base64, type) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type });
};

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
captureBtn.addEventListener("click", captureFrame);
analyzeBtn.addEventListener("click", analyzeScene);

initCamera();
