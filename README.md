# Open Source Hub

Open Source Hub is a web application that allows users to search for open source projects on GitHub using various filters and search operators. The application provides a user-friendly interface to explore repositories based on programming languages, issue labels, stars, forks, and more.

## Features

- Search for open source projects using various parameters.
- Filter results by programming language, issue labels, stars, forks, and more.
- Pagination for easy navigation through search results.
- Caching for improved performance and reduced API calls.
- Responsive design for optimal viewing on all devices.

## Live Demo

You can access the live version of the application here: [Open Source Hub](https://opensource-hub.netlify.app/)

## Getting Started

To get a local copy of the project up and running, follow these steps:

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node package manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/open-source-hub.git
   ```
2. Navigate to the project directory:

   ```bash
   cd open-source-hub
   ```
3. Install the required dependencies:

   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory and add your GitHub token:

   ```plaintext
   GITHUB_TOKEN=your_github_token_here
   PORT=3000
   ```

### Running the Application

1. Start the server:

   ```bash
   node server.js
   ```
2. Open your browser and navigate to:

   ```
   http://localhost:3000
   ```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

### Steps to Contribute

1. **Fork the Project**: Click on the "Fork" button at the top right of the repository page.
2. **Create your Feature Branch**:

   ```bash
   git checkout -b feature/YourFeature
   ```
3. **Commit your Changes**:

   ```bash
   git commit -m 'Add some feature'
   ```
4. **Push to the Branch**:

   ```bash
   git push origin feature/YourFeature
   ```
5. **Open a Pull Request**: Go to the original repository and click on "New Pull Request". Select your branch and submit the pull request.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgements

- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Express.js](https://expressjs.com/)
- [Axios](https://axios-http.com/)
- [Node.js](https://nodejs.org/)
