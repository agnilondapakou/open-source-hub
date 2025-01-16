document.addEventListener('DOMContentLoaded', function() {
    const helpIcon = document.getElementById('helpIcon');
    const searchHelp = document.getElementById('searchHelp');

    helpIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        searchHelp.classList.toggle('visible');
    });

    document.addEventListener('click', function(e) {
        if (!searchHelp.contains(e.target) && e.target !== helpIcon) {
            searchHelp.classList.remove('visible');
        }
    });
});

// Constantes de configuration
const CONFIG = {
    DEBOUNCE_DELAY: 300,
    MIN_SEARCH_INTERVAL: 500,
    ITEMS_PER_PAGE: 10,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    MIN_SEARCH_LENGTH: 2,
    MAX_PAGES: 100 // GitHub limite à 1000 résultats (100 pages de 10)
};

// Gestionnaire de cache amélioré
const searchCache = {
    data: new Map(),
    
    set(key, value) {
        // Limiter la taille du cache
        if (this.data.size > 100) {
            const oldestKey = this.data.keys().next().value;
            this.data.delete(oldestKey);
        }
        
        this.data.set(key, {
            value,
            timestamp: Date.now()
        });
    },
    
    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > CONFIG.CACHE_DURATION) {
            this.data.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    clear() {
        this.data.clear();
    }
};

// État global de l'application
const state = {
    currentPage: 1,
    isLoading: false,
    lastQuery: '',
    lastSearchTime: 0,
    searchTimeout: null,
    totalPages: 0,
    pendingRequest: null
};

// Fonction de recherche optimisée
async function searchProjects(page = 1) {
    const searchInput = document.getElementById('searchInput').value.trim();
    const projectsContainer = document.getElementById('projects');
    
    // Validations de base
    if (!isValidSearch(searchInput)) {
        projectsContainer.innerHTML = '';
        return;
    }

    // Éviter les recherches en double
    if (shouldSkipSearch(searchInput, page)) return;

    // Vérifier le cache
    const cacheKey = `${searchInput}-${page}`;
    const cachedResults = searchCache.get(cacheKey);
    
    if (cachedResults) {
        displayResults(cachedResults, page);
        return;
    }

    // Afficher l'état de chargement
    updateLoadingState(page);
    
    try {
        // Annuler la requête précédente si elle existe
        if (state.pendingRequest) {
            state.pendingRequest.abort();
        }

        // Créer un nouveau contrôleur d'abandon
        const controller = new AbortController();
        state.pendingRequest = controller;

        const response = await fetchWithTimeout(
            buildSearchUrl(searchInput, page),
            {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Open-Source-Hub'
                }
            }
        );
        
        const data = await response.json();
        
        // Mettre en cache les résultats
        searchCache.set(cacheKey, data);
        
        // Afficher les résultats
        displayResults(data, page);

    } catch (error) {
        handleSearchError(error, page);
    } finally {
        state.isLoading = false;
        state.pendingRequest = null;
    }
}

// Fonctions utilitaires
function isValidSearch(query) {
    return query.length >= CONFIG.MIN_SEARCH_LENGTH;
}

function shouldSkipSearch(query, page) {
    return state.isLoading || 
           (page === 1 && query === state.lastQuery) ||
           page > CONFIG.MAX_PAGES;
}

function buildSearchUrl(query, page) {
    return `https://api.github.com/search/repositories?` +
           `q=${encodeURIComponent(query)}+is:public` +
           `&sort=stars&order=desc&page=${page}&per_page=${CONFIG.ITEMS_PER_PAGE}`;
}

async function fetchWithTimeout(url, options, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Gestionnaire de recherche amélioré
function handleSearch() {
    clearTimeout(state.searchTimeout);
    
    const now = Date.now();
    const timeElapsed = now - state.lastSearchTime;
    
    const debounceDelay = Math.max(
        CONFIG.DEBOUNCE_DELAY,
        CONFIG.MIN_SEARCH_INTERVAL - timeElapsed
    );

    state.searchTimeout = setTimeout(() => {
        state.currentPage = 1;
        state.lastSearchTime = Date.now();
        searchProjects(state.currentPage);
    }, debounceDelay);
}

// Event listeners optimisés
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', handleSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !state.isLoading) {
            clearTimeout(state.searchTimeout);
            state.currentPage = 1;
            state.lastSearchTime = Date.now();
            searchProjects(state.currentPage);
        }
    });
}

// Initialisation
setupEventListeners();

function displayResults(data, page) {
    const projectsContainer = document.getElementById('projects');
    
    if (page === 1) {
        projectsContainer.innerHTML = '';
    }
    
    if (data.items.length === 0) {
        projectsContainer.innerHTML = '<div class="no-results">No projects found</div>';
        return;
    }

    // Calculer le nombre total de pages
    state.totalPages = Math.ceil(data.total_count / CONFIG.ITEMS_PER_PAGE);

    // Afficher les résultats
    let resultsHTML = `
        <div class="results-info">
            Showing ${((page - 1) * CONFIG.ITEMS_PER_PAGE) + 1} - ${Math.min(page * CONFIG.ITEMS_PER_PAGE, data.total_count)} 
            of ${data.total_count.toLocaleString()} repositories
        </div>
        <div class="projects-list">
    `;

    data.items.forEach(project => {
        resultsHTML += `
            <div class="project-card">
                <a href="${project.html_url}" target="_blank">
                    <h2>${project.name}</h2>
                    <span class="url">${project.html_url}</span>
                </a>
                <p>${truncateDescription(project.description)}</p>
                <div class="project-stats">
                    <span>⭐ ${project.stargazers_count.toLocaleString()} stars</span>
                    <span>👁 ${project.watchers_count.toLocaleString()} watchers</span>
                    <span>🔄 ${project.forks_count.toLocaleString()} forks</span>
                    <span>📝 ${project.language || 'Not specified'}</span>
                </div>
            </div>
        `;
    });

    resultsHTML += '</div>';

    // Ajouter la pagination
    resultsHTML += createPaginationControls(page, state.totalPages);

    projectsContainer.innerHTML = resultsHTML;

    // Ajouter les event listeners pour la pagination
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', () => {
            const newPage = parseInt(button.dataset.page);
            if (newPage !== state.currentPage) {
                searchProjects(newPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

function createPaginationControls(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    let paginationHTML = '<div class="pagination">';

    // Bouton précédent
    paginationHTML += `
        <button class="pagination-button" 
                data-page="${currentPage - 1}"
                ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
    `;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Première page
    if (startPage > 1) {
        paginationHTML += `
            <button class="pagination-button" data-page="1">1</button>
            ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
        `;
    }

    // Pages numérotées
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-button ${i === currentPage ? 'active' : ''}" 
                    data-page="${i}">
                ${i}
            </button>
        `;
    }

    // Dernière page
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
            <button class="pagination-button" data-page="${totalPages}">${totalPages}</button>
        `;
    }

    // Bouton suivant
    paginationHTML += `
        <button class="pagination-button" 
                data-page="${currentPage + 1}"
                ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationHTML += '</div>';
    return paginationHTML;
}

function truncateDescription(description, maxLength = 150) {
    if (!description) return 'No description available';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength).trim() + '...';
}

function updateLoadingState(page) {
    const projectsContainer = document.getElementById('projects');
    if (page === 1) {
        projectsContainer.innerHTML = `
            <div class="loading">
                ${searchCache.data.size > 0 ? 
                    `<small>(${searchCache.data.size} results cached)</small>` : 
                    ''}
                Searching...
            </div>
        `;
    }
}

document.getElementById('toggleDarkMode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    this.textContent = isDarkMode ? '🌞' : '🌙'; // Change l'icône en fonction du mode
}); 