
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
                      -v /var/lib/docker/volumes/jenkins_home/_data/workspace/employee-management-ci-cd/backend:/app \
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
                      -v /var/lib/docker/volumes/jenkins_home/_data/workspace/employee-management-ci-cd/frontend:/app \
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
                      -v /var/lib/docker/volumes/jenkins_home/_data/workspace/employee-management-ci-cd/frontend:/app \
                      -w /app \
                      node:22-bookworm-slim \
                      sh -c 'npm ci && npm run build'
                '''
            }
        }

        stage('Docker Image Build') {
            steps {
                sh '''
                    docker build \
                      -t employee-management-backend:ci \
                      backend/

                    docker build \
                      -t employee-management-frontend:ci \
                      frontend/

                    echo "Both Docker images built successfully."
                '''
            }
        }
    }

    post {
        success {
            echo 'All CI checks and Docker image builds passed.'
        }
        failure {
            echo 'CI failed. Review the stage console output.'
        }
    }
}
