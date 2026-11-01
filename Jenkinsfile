
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        GCP_REGISTRY = 'asia-south1-docker.pkg.dev'
        GCP_PROJECT = 'employee-management-learning'
        GCP_REPOSITORY = 'employee-images'
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

        stage('Push Images to Artifact Registry') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'gcp-artifact-publisher-key',
                        variable: 'GCP_KEY_FILE'
                    )
                ]) {
                    sh '''
                        set +x

                        export DOCKER_CONFIG="$(mktemp -d)"

                        trap 'docker logout "$GCP_REGISTRY" >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT

                        IMAGE_TAG="$(git rev-parse --short=12 HEAD)"

                        BACKEND_IMAGE="${GCP_REGISTRY}/${GCP_PROJECT}/${GCP_REPOSITORY}/employee-management-backend"
                        FRONTEND_IMAGE="${GCP_REGISTRY}/${GCP_PROJECT}/${GCP_REPOSITORY}/employee-management-frontend"

                        echo "Authenticating with Google Artifact Registry..."

                        docker login \
                          -u _json_key \
                          --password-stdin \
                          "https://${GCP_REGISTRY}" < "$GCP_KEY_FILE"

                        echo "Tagging Docker images..."

                        docker tag employee-management-backend:ci \
                          "${BACKEND_IMAGE}:${IMAGE_TAG}"

                        docker tag employee-management-frontend:ci \
                          "${FRONTEND_IMAGE}:${IMAGE_TAG}"

                        docker tag employee-management-backend:ci \
                          "${BACKEND_IMAGE}:ci"

                        docker tag employee-management-frontend:ci \
                          "${FRONTEND_IMAGE}:ci"

                        echo "Pushing backend image..."

                        docker push "${BACKEND_IMAGE}:${IMAGE_TAG}"
                        docker push "${BACKEND_IMAGE}:ci"

                        echo "Pushing frontend image..."

                        docker push "${FRONTEND_IMAGE}:${IMAGE_TAG}"
                        docker push "${FRONTEND_IMAGE}:ci"

                        echo "Both images pushed successfully."

                        echo "Published image tag: ${IMAGE_TAG}"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'All CI checks, Docker builds and Artifact Registry pushes passed.'
        }

        failure {
            echo 'CI/CD failed. Review the stage console output.'
        }

        always {
            echo 'Jenkins pipeline execution completed.'
        }
    }
}
