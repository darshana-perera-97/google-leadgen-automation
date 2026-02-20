const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { q } = req.body;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const data = JSON.stringify({
      "q": q,
      "page": 1
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://google.serper.dev/places',
      headers: { 
        'X-API-KEY': '7487b809906615f8ce1b03f61c0394a6c783bb99', 
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios.request(config);
    res.json(response.data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform search', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

