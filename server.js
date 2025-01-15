const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const CONFIG = {
    CACHE_DURATION: 300, // 5 minutes
    MAX_CACHE_SIZE: 1000,
    MAX_REQUESTS_PER_IP: 100,
    REQUEST_WINDOW: 15 * 60 * 1000, // 15 minutes
    DEFAULT_TIMEOUT: 5000,
    MAX_PAGE_SIZE: 100,
    SUPPORTED_LANGUAGES: ['javascript', 'python', 'java', 'typescript', 'go', 'rust', 'c++', 'php'],
    MAX_LABELS: 5,
    DEFAULT_SORT: 'stars',
    SORT_OPTIONS: ['stars', 'forks', 'updated', 'help-wanted-issues'],
    SEARCH_OPERATORS: {
        language: '@',    // @javascript
        label: '#',       // #good-first-issue
        stars: '>',       // >1000
        forks: '^',       // ^500
        updated: '~',     // ~2024-01
        owner: '@/',      // @/microsoft
        topic: '+',       // +react
    }
};

// Middleware
app.use(cors());
app.use(compression()); // Compression GZIP
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: CONFIG.REQUEST_WINDOW,
    max: CONFIG.MAX_REQUESTS_PER_IP,
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Cache setup avec gestion de la taille
const NodeCache = require('node-cache');
const cache = new NodeCache({ 
    stdTTL: CONFIG.CACHE_DURATION,
    checkperiod: 120,
    maxKeys: CONFIG.MAX_CACHE_SIZE
});

// Middleware de validation amélioré
const validateSearchParams = (req, res, next) => {
    const { 
        q = '', 
        page = 1, 
        per_page = 10,
        language,
        labels,
        sort = CONFIG.DEFAULT_SORT
    } = req.query;

    // Validation de base
    if (q.length < 2) {
        return res.status(400).json({
            error: 'Invalid search query',
            message: 'Search query must be at least 2 characters long'
        });
    }

    // Validation de la pagination
    if (page < 1 || page > 100) {
        return res.status(400).json({
            error: 'Invalid page number',
            message: 'Page number must be between 1 and 100'
        });
    }

    if (per_page < 1 || per_page > CONFIG.MAX_PAGE_SIZE) {
        return res.status(400).json({
            error: 'Invalid page size',
            message: `Page size must be between 1 and ${CONFIG.MAX_PAGE_SIZE}`
        });
    }

    // Validation du langage
    if (language && !CONFIG.SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
        return res.status(400).json({
            error: 'Invalid language',
            message: `Supported languages: ${CONFIG.SUPPORTED_LANGUAGES.join(', ')}`
        });
    }

    // Validation des labels
    if (labels) {
        const labelArray = labels.split(',');
        if (labelArray.length > CONFIG.MAX_LABELS) {
            return res.status(400).json({
                error: 'Too many labels',
                message: `Maximum ${CONFIG.MAX_LABELS} labels allowed`
            });
        }
    }

    // Validation du tri
    if (!CONFIG.SORT_OPTIONS.includes(sort)) {
        return res.status(400).json({
            error: 'Invalid sort option',
            message: `Supported sort options: ${CONFIG.SORT_OPTIONS.join(', ')}`
        });
    }

    next();
};

// Fonction pour parser la requête avec les opérateurs
function parseSearchQuery(rawQuery) {
    const operators = {
        language: null,
        labels: [],
        stars: null,
        forks: null,
        updated: null,
        owner: null,
        topics: [],
        baseQuery: []
    };

    const words = rawQuery.split(' ');

    words.forEach(word => {
        if (word.startsWith(CONFIG.SEARCH_OPERATORS.language)) {
            // @javascript
            operators.language = word.slice(1).toLowerCase();
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.label)) {
            // #good-first-issue
            operators.labels.push(word.slice(1));
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.stars)) {
            // >1000
            operators.stars = word.slice(1);
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.forks)) {
            // ^500
            operators.forks = word.slice(1);
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.updated)) {
            // ~2024-01
            operators.updated = word.slice(1);
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.owner)) {
            // @/microsoft
            operators.owner = word.slice(2);
        }
        else if (word.startsWith(CONFIG.SEARCH_OPERATORS.topic)) {
            // +react
            operators.topics.push(word.slice(1));
        }
        else {
            operators.baseQuery.push(word);
        }
    });

    return operators;
}

// Fonction pour construire la requête GitHub
function buildGitHubQuery(params) {
    const { q = '', sort = CONFIG.DEFAULT_SORT } = params;
    
    // Parser la requête pour extraire les opérateurs
    const operators = parseSearchQuery(q);
    
    // Construire la requête GitHub
    let query = operators.baseQuery.join(' ');

    // Ajouter le langage
    if (operators.language) {
        query += ` language:${operators.language}`;
    }

    // Ajouter les labels
    if (operators.labels.length > 0) {
        operators.labels.forEach(label => {
            query += ` label:"${label.trim()}"`;
        });
    }

    // Ajouter le filtre de stars
    if (operators.stars) {
        query += ` stars:${operators.stars}`;
    }

    // Ajouter le filtre de forks
    if (operators.forks) {
        query += ` forks:${operators.forks}`;
    }

    // Ajouter le filtre de date de mise à jour
    if (operators.updated) {
        query += ` pushed:${operators.updated}`;
    }

    // Ajouter le filtre de propriétaire
    if (operators.owner) {
        query += ` user:${operators.owner}`;
    }

    // Ajouter les topics
    if (operators.topics.length > 0) {
        operators.topics.forEach(topic => {
            query += ` topic:${topic}`;
        });
    }

    return {
        queryString: `${query.trim()}+is:public`,
        sort: sort,
        parsedOperators: operators
    };
}

// Route principale pour la recherche modifiée
app.get('/api/search', validateSearchParams, async (req, res) => {
    try {
        const { q, page = 1, per_page = 10, language, labels, sort = CONFIG.DEFAULT_SORT } = req.query;
        
        // Créer une clé de cache qui inclut tous les paramètres
        const cacheKey = `${q}-${language || ''}-${labels || ''}-${sort}-${page}-${per_page}`;
        
        // Vérifier le cache
        const cachedResults = cache.get(cacheKey);
        if (cachedResults) {
            console.log(`Cache hit for: ${cacheKey}`);
            return res.json({
                ...cachedResults,
                cached: true
            });
        }

        console.log(`Cache miss for: ${cacheKey}`);

        // Construire la requête avec les opérateurs
        const { queryString, sort: sortOption, parsedOperators } = buildGitHubQuery(req.query);

        // Créer un timeout pour la requête
        const source = axios.CancelToken.source();
        const timeout = setTimeout(() => {
            source.cancel('Request timeout');
        }, CONFIG.DEFAULT_TIMEOUT);

        // Faire la requête à l'API GitHub
        const response = await axios.get(
            'https://api.github.com/search/repositories',
            {
                params: {
                    q: queryString,
                    sort: sortOption,
                    order: 'desc',
                    page,
                    per_page
                },
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Open-Source-Hub'
                },
                cancelToken: source.token
            }
        );

        clearTimeout(timeout);

        // Nettoyer et transformer les données avec plus d'informations
        const cleanedData = {
            total_count: response.data.total_count,
            items: response.data.items.map(item => ({
                id: item.id,
                name: item.name,
                full_name: item.full_name,
                description: item.description,
                html_url: item.html_url,
                stargazers_count: item.stargazers_count,
                watchers_count: item.watchers_count,
                forks_count: item.forks_count,
                language: item.language,
                topics: item.topics,
                open_issues_count: item.open_issues_count,
                has_issues: item.has_issues,
                has_projects: item.has_projects,
                has_wiki: item.has_wiki,
                created_at: item.created_at,
                updated_at: item.updated_at,
                license: item.license?.name,
                default_branch: item.default_branch
            }))
        };

        // Mettre en cache les résultats nettoyés
        cache.set(cacheKey, cleanedData);
        
        res.json({
            ...cleanedData,
            query_info: {
                original_query: q,
                parsed_operators: parsedOperators,
                final_query: queryString,
                sort: sortOption
            },
            rate_limit: {
                remaining: response.headers['x-ratelimit-remaining'],
                reset: new Date(response.headers['x-ratelimit-reset'] * 1000).toISOString()
            },
            cached: false
        });

    } catch (error) {
        handleError(error, res);
    }
});

// Ajouter une route pour obtenir les langages supportés
app.get('/api/languages', (req, res) => {
    res.json({
        languages: CONFIG.SUPPORTED_LANGUAGES
    });
});

// Ajouter une route pour obtenir les options de tri
app.get('/api/sort-options', (req, res) => {
    res.json({
        sort_options: CONFIG.SORT_OPTIONS
    });
});

// Ajouter une route pour la documentation de la recherche
app.get('/api/search-syntax', (req, res) => {
    res.json({
        operators: {
            '@language': 'Filter by programming language (e.g., @javascript)',
            '#label': 'Filter by issue label (e.g., #good-first-issue)',
            '>stars': 'Filter by minimum stars (e.g., >1000)',
            '^forks': 'Filter by minimum forks (e.g., ^500)',
            '~date': 'Filter by last update (e.g., ~2024-01)',
            '@/owner': 'Filter by repository owner (e.g., @/microsoft)',
            '+topic': 'Filter by repository topic (e.g., +react)'
        },
        examples: [
            'react @javascript #help-wanted >1000',
            'cli @rust ^100 ~2024-01',
            'web framework @/microsoft +typescript',
            'database @python #good-first-issue >500'
        ]
    });
});

// Gestionnaire d'erreurs amélioré
function handleError(error, res) {
    console.error('API Error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data
    });

    if (error.code === 'ECONNABORTED' || error.message === 'Request timeout') {
        return res.status(504).json({
            error: 'Request timeout',
            message: 'The request took too long to complete'
        });
    }

    if (error.response?.status === 403) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const resetDate = new Date(resetTime * 1000);
        return res.status(403).json({
            error: 'Rate limit exceeded',
            message: `API rate limit exceeded. Try again after ${resetDate.toLocaleTimeString()}`,
            reset_time: resetDate.toISOString()
        });
    }

    res.status(error.response?.status || 500).json({
        error: 'Search error',
        message: error.response?.data?.message || error.message
    });
}

// Monitoring des performances
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        cache: {
            keys: cache.keys().length,
            hits: cache.getStats().hits,
            misses: cache.getStats().misses
        },
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
}); 