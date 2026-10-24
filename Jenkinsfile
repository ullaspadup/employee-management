
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout Verification') {
            steps {
                echo 'Jenkins successfully checked out the repository.'
                sh '''
                    echo "Repository: $GIT_URL"
                    echo "Branch: $BRANCH_NAME"
                    echo "Commit: $(git rev-parse --short HEAD)"
                    test -f backend/Dockerfile
                    test -f frontend/Dockerfile
                    test -f docker-compose.yml
                    test -d k8s
                    echo "Project structure verified."
                '''
            }
        }
    }

    post {
        success {
            echo 'Initial CI pipeline completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Review the console output.'
        }
    }
}
