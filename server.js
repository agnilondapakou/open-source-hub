const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// GitHub Token from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Cache setup
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // Cache pendant 5 minutes

// Route principale pour la recherche
app.get('/api/search', async (req, res) => {
    try {
        const { q, page = 1, per_page = 10 } = req.query;
        
        // Créer une clé de cache unique
        const cacheKey = `${q}-${page}-${per_page}`;
        
        // Vérifier si les résultats sont en cache
        const cachedResults = cache.get(cacheKey);
        if (cachedResults) {
            return res.json(cachedResults);
        }

        // Faire la requête à l'API GitHub
        const response = await axios.get(
            `https://api.github.com/search/repositories`, {
            params: {
                q: `${q}+is:public`,
                sort: 'stars',
                order: 'desc',
                page,
                per_page
            },
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Mettre en cache les résultats
        cache.set(cacheKey, response.data);
        
        res.json(response.data);
    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
            error: 'Search error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 