
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout Verification') {
            steps {
                echo 'Repository checked out successfully.'
                sh '''
                    git rev-parse --short HEAD
                    test -f backend/Dockerfile
                    test -f frontend/Dockerfile
                    test -f docker-compose.yml
                    test -d k8s
                    echo "Project structure verified."
                '''
            }
        }

        stage('Backend Tests') {
            steps {
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE/backend:/app" \
                      -w /app \
                      -e DATABASE_URL="sqlite://" \
                      -e JWT_SECRET_KEY="ci-test-only-secret-not-for-production" \
                      python:3.12-slim \
                      sh -c 'pip install --quiet -r requirements.txt && pytest -q'
                '''
            }
        }

        stage('Frontend Lint') {
            steps {
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE/frontend:/app" \
                      -w /app \
                      node:22-bookworm-slim \
                      sh -c 'npm ci && npm run lint'
                '''
            }
        }

        stage('Frontend Production Build') {
            steps {
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE/frontend:/app" \
                      -w /app \
                      node:22-bookworm-slim \
                      sh -c 'npm ci && npm run build'
                '''
            }
        }
    }

    post {
        success {
            echo 'All CI checks passed.'
        }
        failure {
            echo 'CI failed. Review the stage console output.'
        }
    }
}
