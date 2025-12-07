import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, initViolationLogs } from './config/database.js';
import { initMqtt } from './services/mqttService.js';
import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: { 
    origin: '*', 
    methods: ['GET', 'POST', 'DELETE'] 
  } 
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

app.get('/health', (req, res) => { 
  res.json({ status: 'ok' }); 
});

io.on('connection', (socket) => { 
  console.log('🔌 Client connected:', socket.id); 
  socket.on('disconnect', () => { 
    console.log('🔌 Disconnected:', socket.id); 
  }); 
});

async function startServer() {
  try {
    await initDatabase();
    await initViolationLogs();
    initMqtt(io);
    httpServer.listen(PORT, () => { 
      console.log('\n✅ Server running on http://localhost:' + PORT + '\n'); 
    });
  } catch (error) { 
    console.error('❌ Failed:', error); 
    process.exit(1); 
  }
}

startServer();
