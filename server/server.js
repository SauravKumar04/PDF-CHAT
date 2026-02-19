import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getChatResponse } from './chatbot.js';
import { indexUploadedDocument } from './prepare.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory chat history storage
const chatHistory = new Map();
let sessionCounter = 1;

// Helper function to create new session
function createNewSession() {
  const sessionId = `session_${sessionCounter++}`;
  const timestamp = new Date().toISOString();
  chatHistory.set(sessionId, {
    id: sessionId,
    title: `Chat ${sessionCounter - 1}`,
    createdAt: timestamp,
    messages: []
  });
  return sessionId;
}

// Helper function to add message to session
function addMessageToSession(sessionId, message, type) {
  if (!chatHistory.has(sessionId)) {
    sessionId = createNewSession();
  }
  
  const session = chatHistory.get(sessionId);
  session.messages.push({
    id: Date.now() + Math.random(),
    type: type,
    content: message,
    timestamp: new Date().toISOString()
  });
  
  // Auto-generate session title from first user message
  if (type === 'user' && session.messages.length === 1) {
    session.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
  }
  
  return sessionId;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://docchat.ai', 'https://www.docchat.ai'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Rate limiting (simple implementation)
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // max 100 requests per window
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
  
  validRequests.push(now);
  requestCounts.set(ip, validRequests);
  next();
});

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Received message:', message, 'Session:', sessionId);
    
    // Add user message to session
    const currentSessionId = addMessageToSession(sessionId || null, message, 'user');
    
    const response = await getChatResponse(message);
    
    // Add bot response to session
    addMessageToSession(currentSessionId, response, 'bot');
    
    res.json({ 
      response,
      sessionId: currentSessionId
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// Get all chat sessions
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(chatHistory.values())
    .map(session => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      messageCount: session.messages.length
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(sessions);
});

// Get specific session with messages
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = chatHistory.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session);
});

// Delete session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (chatHistory.delete(sessionId)) {
    res.json({ message: 'Session deleted successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Create new session
app.post('/api/sessions', (req, res) => {
  const sessionId = createNewSession();
  const session = chatHistory.get(sessionId);
  res.json(session);
});

// Upload PDF endpoint
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing uploaded file:', req.file.filename);
    
    // Index the uploaded document (replaces any previous uploaded document)
    await indexUploadedDocument(req.file.path);
    
    // Clean up uploaded file after processing
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      message: 'Document uploaded and indexed successfully! Now chatting with your uploaded document.',
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if indexing failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to process document' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});