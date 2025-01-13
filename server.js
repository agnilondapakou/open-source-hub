const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Open-Source-Hub'
            }
        });

        // Mettre en cache les résultats
        cache.set(cacheKey, response.data);
        
        // Ajouter les informations de rate limit dans la réponse
        const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
        const rateLimitReset = response.headers['x-ratelimit-reset'];
        
        res.json({
            ...response.data,
            rate_limit: {
                remaining: rateLimitRemaining,
                reset: new Date(rateLimitReset * 1000).toISOString()
            }
        });
    } catch (error) {
        console.error('API Error:', error.message);
        
        // Vérifier si l'erreur est due au rate limiting
        if (error.response?.status === 403) {
            const resetTime = error.response.headers['x-ratelimit-reset'];
            const resetDate = new Date(resetTime * 1000);
            res.status(403).json({
                error: 'Rate limit exceeded',
                message: `API rate limit exceeded. Try again after ${resetDate.toLocaleTimeString()}`,
                reset_time: resetDate.toISOString()
            });
        } else {
            res.status(500).json({
                error: 'Search error',
                message: error.message
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
}); 