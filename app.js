// Cache côté client
const clientCache = {
    data: new Map(),
    maxAge: 5 * 60 * 1000, // 5 minutes en millisecondes
    
    set(key, value) {
        this.data.set(key, {
            value,
            timestamp: Date.now()
        });
    },
    
    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.maxAge) {
            this.data.delete(key);
            return null;
        }
        
        return item.value;
    },
    
    clear() {
        this.data.clear();
    }
};

let currentPage = 1;
let isLoading = false;
let searchTimeout;
let lastQuery = '';
let totalPages = 0;
const ITEMS_PER_PAGE = 10;

async function searchProjects(page = 1) {
    const searchInput = document.getElementById('searchInput').value.trim();
    const projectsContainer = document.getElementById('projects');
    
    if (!searchInput) {
        projectsContainer.innerHTML = '';
        return;
    }

    // Éviter les recherches en double
    if (isLoading || (page === 1 && searchInput === lastQuery)) {
        return;
    }

    // Vérifier le cache pour cette recherche
    const cacheKey = `${searchInput}-${page}`;
    const cachedResults = clientCache.get(cacheKey);
    
    if (cachedResults) {
        displayResults(cachedResults, page);
        return;
    }

    if (page === 1) {
        projectsContainer.innerHTML = '<div class="loading">Searching...</div>';
    }
    
    isLoading = true;
    lastQuery = searchInput;
    
    try {
        const response = await fetch(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(searchInput)}+is:public&sort=stars&order=desc&page=${page}&per_page=10`,
            {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Open-Source-Hub'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Mettre en cache les résultats
        clientCache.set(cacheKey, data);
        
        displayResults(data, page);

    } catch (error) {
        console.error('Search error:', error);
        if (page === 1) {
            projectsContainer.innerHTML = `
                <div class="error">
                    An error occurred while searching.
                    Please try again later.
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

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
    totalPages = Math.ceil(data.total_count / ITEMS_PER_PAGE);

    // Afficher les résultats
    let resultsHTML = `
        <div class="results-info">
            Showing ${((page - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(page * ITEMS_PER_PAGE, data.total_count)} 
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
    resultsHTML += createPaginationControls(page, totalPages);

    projectsContainer.innerHTML = resultsHTML;

    // Ajouter les event listeners pour la pagination
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', () => {
            const newPage = parseInt(button.dataset.page);
            if (newPage !== currentPage) {
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

// Debouncing amélioré avec délai minimum
let lastSearchTime = 0;
const MIN_SEARCH_INTERVAL = 500; // 500ms minimum entre les recherches

function handleSearch() {
    clearTimeout(searchTimeout);
    
    const now = Date.now();
    const timeElapsed = now - lastSearchTime;
    
    // Calculer le délai de debounce en fonction du temps écoulé
    const debounceDelay = timeElapsed < MIN_SEARCH_INTERVAL ? 
        MIN_SEARCH_INTERVAL : 
        300;

    searchTimeout = setTimeout(() => {
        currentPage = 1;
        lastSearchTime = Date.now();
        searchProjects(currentPage);
    }, debounceDelay);
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', handleSearch);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        currentPage = 1;
        lastSearchTime = Date.now();
        searchProjects(currentPage);
    }
});

function truncateDescription(description, maxLength = 150) {
    if (!description) return 'No description available';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength).trim() + '...';
} 