let currentPage = 1;
let isLoading = false;
let searchTimeout;

async function searchProjects(page = 1) {
    const searchInput = document.getElementById('searchInput').value;
    const projectsContainer = document.getElementById('projects');
    
    if (!searchInput.trim()) {
        projectsContainer.innerHTML = '';
        return;
    }

    if (page === 1) {
        projectsContainer.innerHTML = '<div class="loading">Recherche en cours...</div>';
    }
    
    isLoading = true;
    
    try {
        const response = await fetch(
            `http://localhost:3000/api/search?q=${encodeURIComponent(searchInput)}&page=${page}&per_page=10`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (page === 1) {
            projectsContainer.innerHTML = '';
        }
        
        if (data.items.length === 0) {
            if (page === 1) {
                projectsContainer.innerHTML = '<div class="no-results">Aucun projet trouvé</div>';
            }
            return;
        }

        data.items.forEach(project => {
            const projectCard = `
                <div class="project-card">
                    <a href="${project.html_url}" target="_blank">
                        <h2>${project.name}</h2>
                        <span class="url">${project.html_url}</span>
                    </a>
                    <p>${project.description || 'Aucune description disponible'}</p>
                    <div class="project-stats">
                        <span>⭐ ${project.stargazers_count.toLocaleString()} étoiles</span>
                        <span>👁 ${project.watchers_count.toLocaleString()} observateurs</span>
                        <span>🔄 ${project.forks_count.toLocaleString()} forks</span>
                        <span>📝 ${project.language || 'Non spécifié'}</span>
                    </div>
                </div>
            `;
            projectsContainer.innerHTML += projectCard;
        });

        // Ajouter le bouton "Voir plus" si il y a plus de résultats
        if (data.total_count > page * 10) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.className = 'load-more';
            loadMoreButton.textContent = 'Voir plus de résultats';
            loadMoreButton.onclick = () => searchProjects(page + 1);
            projectsContainer.appendChild(loadMoreButton);
        }

    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        if (page === 1) {
            projectsContainer.innerHTML = `
                <div class="error">
                    Une erreur est survenue lors de la recherche.
                    Veuillez réessayer plus tard.
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Recherche instantanée avec debouncing
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        searchProjects(currentPage);
    }, 300);
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', handleSearch);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        currentPage = 1;
        searchProjects(currentPage);
    }
}); 