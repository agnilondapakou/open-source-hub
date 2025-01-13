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
        projectsContainer.innerHTML = '<div class="loading">Searching...</div>';
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
                projectsContainer.innerHTML = '<div class="no-results">No projects found</div>';
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
                    <p>${project.description || 'No description available'}</p>
                    <div class="project-stats">
                        <span>⭐ ${project.stargazers_count.toLocaleString()} stars</span>
                        <span>👁 ${project.watchers_count.toLocaleString()} watchers</span>
                        <span>🔄 ${project.forks_count.toLocaleString()} forks</span>
                        <span>📝 ${project.language || 'Not specified'}</span>
                    </div>
                </div>
            `;
            projectsContainer.innerHTML += projectCard;
        });

        if (data.total_count > page * 10) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.className = 'load-more';
            loadMoreButton.textContent = 'Load more results';
            loadMoreButton.onclick = () => searchProjects(page + 1);
            projectsContainer.appendChild(loadMoreButton);
        }

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